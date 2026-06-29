import { NextResponse } from "next/server";
import { hasSponsoredDisclosure } from "@/lib/ads";
import { buildFoodQuery } from "@/lib/food";
import { analyzeReviews, buildReasons, scoreRecommendation } from "@/lib/scoring";
import type { Priority, Recommendation, SearchRequest, Weekday } from "@/lib/types";

export const dynamic = "force-dynamic";

type GoogleGeocodeResult = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  partial_match?: boolean;
  types?: string[];
};

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  googleMapsUri?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
    periods?: OpeningPeriod[];
  };
  currentOpeningHours?: {
    weekdayDescriptions?: string[];
    periods?: OpeningPeriod[];
  };
  reviews?: Array<{
    text?: { text?: string };
    rating?: number;
  }>;
};

type OpeningPeriod = {
  open?: { day?: number; hour?: number; minute?: number };
  close?: { day?: number; hour?: number; minute?: number };
};

const WEEKDAY_TO_GOOGLE_DAY: Record<Weekday, number> = {
  "일요일": 0,
  "월요일": 1,
  "화요일": 2,
  "수요일": 3,
  "목요일": 4,
  "금요일": 5,
  "토요일": 6
};

const PRICE_LEVEL_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: "무료 또는 정보 없음",
  PRICE_LEVEL_INEXPENSIVE: "저렴한 편",
  PRICE_LEVEL_MODERATE: "보통",
  PRICE_LEVEL_EXPENSIVE: "높은 편",
  PRICE_LEVEL_VERY_EXPENSIVE: "매우 높은 편"
};

function bad(message: string, code = "VALIDATION_ERROR", extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status: code === "MISSING_API_KEY" ? 500 : 400 });
}

function validate(body: SearchRequest) {
  if (!body.locationText?.trim() && (body.lat == null || body.lng == null)) return "지역을 입력하거나 현재 위치를 설정해 주세요.";
  if (!body.foodCategory) return "음식 종류를 선택해 주세요.";
  if (body.foodCategory === "기타" && !body.customFood?.trim()) return "기타 음식 종류를 직접 입력해 주세요.";
  if (!body.weekday) return "방문 요일을 선택해 주세요.";
  if (!/^\d{2}:\d{2}$/.test(body.visitTime || "")) return "방문 시간을 선택해 주세요.";
  if (body.priorities.length > 2) return "중요 기준은 최대 2개까지 선택할 수 있습니다.";
  return null;
}

async function geocodeLocation(locationText: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", locationText);
  url.searchParams.set("region", "kr");
  url.searchParams.set("language", "ko");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  const data = await response.json();
  if (data.status !== "OK") {
    throw new Error(data.error_message || `Geocoding API 오류: ${data.status}`);
  }

  const results = data.results as GoogleGeocodeResult[];
  const candidates = results.slice(0, 4).map((result) => result.formatted_address);
  const looksAmbiguous = results.length > 1 && locationText.length <= 4;

  if (looksAmbiguous) {
    return { ambiguous: true, candidates };
  }

  const first = results[0];
  return {
    ambiguous: false,
    label: first.formatted_address,
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng
  };
}

async function searchPlaces(request: SearchRequest, center: { lat: number; lng: number }, apiKey: string) {
  const query = `${request.locationText} ${buildFoodQuery(request.foodCategory, request.customFood)}`;
  const includedType =
    request.foodCategory === "카페" ? "cafe" : request.foodCategory === "베이커리" ? "bakery" : request.foodCategory === "술집" ? "bar" : "restaurant";
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types"
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "ko",
      regionCode: "KR",
      includedType,
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: request.radius
        }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Places Text Search 실패: ${response.status} ${text}`);
  }

  const data = await response.json();
  return (data.places || []) as GooglePlace[];
}

async function getPlaceDetails(placeId: string, apiKey: string) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=ko&regionCode=KR`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,types,googleMapsUri,regularOpeningHours,currentOpeningHours,reviews"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Place Details 실패: ${response.status} ${text}`);
  }

  return (await response.json()) as GooglePlace;
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function periodContains(period: OpeningPeriod, day: number, visitMinutes: number) {
  if (period.open?.day == null || period.open.hour == null || period.open.minute == null) return false;
  const openDay = period.open.day;
  const closeDay = period.close?.day ?? openDay;
  const openMinutes = period.open.hour * 60 + period.open.minute;
  const closeMinutes = period.close ? period.close.hour! * 60 + period.close.minute! : 24 * 60;

  if (openDay === day && closeDay === day) return visitMinutes >= openMinutes && visitMinutes < closeMinutes;
  if (openDay === day && closeDay !== day) return visitMinutes >= openMinutes;
  if (openDay !== day && closeDay === day) return visitMinutes < closeMinutes;
  return false;
}

function openingStatus(place: GooglePlace, weekday: Weekday, visitTime: string) {
  const hours = place.currentOpeningHours || place.regularOpeningHours;
  if (!hours?.periods?.length) {
    return {
      selectedDayOpen: null,
      selectedTimeOpen: null,
      regularClosed: "정보 없음",
      breakTime: "브레이크타임 정보 확인 필요",
      openingHours: hours?.weekdayDescriptions || ["영업시간 정보 없음"]
    };
  }

  const day = WEEKDAY_TO_GOOGLE_DAY[weekday];
  const sameDayPeriods = hours.periods.filter((period) => period.open?.day === day);
  const selectedDayOpen = sameDayPeriods.length > 0;
  const selectedTimeOpen = hours.periods.some((period) => periodContains(period, day, toMinutes(visitTime)));
  const closedDays = Object.entries(WEEKDAY_TO_GOOGLE_DAY)
    .filter(([, googleDay]) => !hours.periods?.some((period) => period.open?.day === googleDay))
    .map(([label]) => label);

  const gaps = sameDayPeriods
    .filter((period) => period.close)
    .sort((a, b) => (a.open!.hour! * 60 + a.open!.minute!) - (b.open!.hour! * 60 + b.open!.minute!))
    .map((period, index, sorted) => {
      const next = sorted[index + 1];
      if (!next || !period.close) return null;
      const close = `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`;
      const open = `${String(next.open!.hour).padStart(2, "0")}:${String(next.open!.minute).padStart(2, "0")}`;
      return `${close}~${open}`;
    })
    .filter(Boolean);

  return {
    selectedDayOpen,
    selectedTimeOpen,
    regularClosed: closedDays.length ? closedDays.join(", ") : "정보 없음",
    breakTime: gaps.length ? gaps.join(", ") : "브레이크타임 정보 확인 필요",
    openingHours: hours.weekdayDescriptions || ["영업시간 정보 없음"]
  };
}

function distanceMeters(a: { lat: number; lng: number }, b?: { latitude: number; longitude: number }) {
  if (!b) return null;
  const earth = 6371000;
  const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
  const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function typeLabel(types?: string[]) {
  if (!types?.length) return "Google Maps 음식점";
  const known: Record<string, string> = {
    restaurant: "음식점",
    cafe: "카페",
    bakery: "베이커리",
    bar: "술집",
    meal_takeaway: "테이크아웃",
    meal_delivery: "배달 가능"
  };
  return types.map((type) => known[type]).filter(Boolean).join(", ") || "Google Maps 음식점";
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return bad("GOOGLE_MAPS_API_KEY가 설정되지 않았습니다. 서버 환경변수에 Google Maps API 키를 추가해 주세요.", "MISSING_API_KEY");
  }

  try {
    const body = (await request.json()) as SearchRequest;
    const validationError = validate(body);
    if (validationError) return bad(validationError);

    let center = { lat: body.lat!, lng: body.lng! };
    let label = body.locationText;
    if (body.lat == null || body.lng == null) {
      const geocoded = await geocodeLocation(body.locationText, apiKey);
      if (geocoded.ambiguous) {
        return bad(`"${body.locationText}"이 여러 지역에서 검색됩니다. 가능한 후보를 선택해 주세요.`, "AMBIGUOUS_LOCATION", {
          candidates: geocoded.candidates
        });
      }
      if (geocoded.lat == null || geocoded.lng == null || !geocoded.label) {
        return bad("지역 좌표를 확인하지 못했습니다. 더 구체적인 지역명이나 랜드마크를 입력해 주세요.", "VALIDATION_ERROR");
      }
      center = { lat: geocoded.lat, lng: geocoded.lng };
      label = geocoded.label;
    }

    const searched = await searchPlaces(body, center, apiKey);
    const radiusFiltered = searched.filter((place) => {
      const meters = distanceMeters(center, place.location);
      return meters == null || meters <= body.radius;
    });
    const ratingFiltered = radiusFiltered.filter((place) => body.minRating == null || (place.rating ?? 0) >= body.minRating);
    const detailCandidates = ratingFiltered.slice(0, 10);
    const detailed = await Promise.all(detailCandidates.map((place) => getPlaceDetails(place.id, apiKey)));

    const recommendations = detailed
      .map((place) => {
        const status = openingStatus(place, body.weekday, body.visitTime);
        if (status.selectedDayOpen === false || status.selectedTimeOpen === false) return null;

        const reviewTexts = (place.reviews || []).map((review) => review.text?.text || "").filter(Boolean);
        const usableReviews = reviewTexts.filter((text) => !hasSponsoredDisclosure(text));
        const sponsoredCount = reviewTexts.length - usableReviews.length;
        const stats = analyzeReviews(usableReviews, sponsoredCount);
        const meters = distanceMeters(center, place.location);
        const partial: Recommendation = {
          rank: 0,
          placeId: place.id,
          name: place.displayName?.text || "이름 정보 없음",
          address: place.formattedAddress || "주소 정보 없음",
          googleMapsRating: place.rating ?? null,
          googleMapsReviewCount: place.userRatingCount ?? null,
          distanceMeters: meters,
          selectedDayOpen: status.selectedDayOpen,
          selectedTimeOpen: status.selectedTimeOpen,
          openingHours: status.openingHours,
          regularClosed: status.regularClosed,
          breakTime: status.breakTime,
          foodCategory: typeLabel(place.types),
          priceLevel: place.priceLevel ? PRICE_LEVEL_LABEL[place.priceLevel] || "가격대 정보 있음" : "가격대 정보 없음",
          reviewStats: stats,
          fitScore: 0,
          reasons: [],
          googleMapsUrl: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName?.text || "")}&query_place_id=${place.id}`
        };
        partial.fitScore = scoreRecommendation({
          rating: partial.googleMapsRating,
          reviewCount: partial.googleMapsReviewCount,
          distanceMeters: partial.distanceMeters,
          selectedTimeOpen: partial.selectedTimeOpen,
          stats,
          priorities: body.priorities as Priority[]
        });
        partial.reasons = buildReasons(partial, body.priorities as Priority[]);
        return partial;
      })
      .filter((place): place is Recommendation => Boolean(place))
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 3)
      .map((place, index) => ({ ...place, rank: index + 1 }));

    if (!recommendations.length) {
      return NextResponse.json({
        ok: true,
        resolvedLocation: { label, ...center },
        searchedCount: searched.length,
        filteredCount: 0,
        recommendations: [],
        notice: "선택한 조건을 만족하는 식당을 찾지 못했습니다."
      });
    }

    return NextResponse.json({
      ok: true,
      resolvedLocation: { label, ...center },
      searchedCount: searched.length,
      filteredCount: recommendations.length,
      recommendations,
      notice: recommendations.length < 3 ? `선택한 조건을 만족하는 식당이 ${recommendations.length}곳만 검색되었습니다.` : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      {
        ok: false,
        code: "GOOGLE_API_ERROR",
        message: "Google API 요청 중 오류가 발생했습니다.",
        suggestions: ["API 키와 활성화된 API 목록을 확인해 주세요.", "사용량 한도 또는 결제 계정 상태를 확인해 주세요."],
        detail: message
      },
      { status: 502 }
    );
  }
}
