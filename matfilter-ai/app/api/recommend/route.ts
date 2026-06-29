import { NextResponse } from "next/server";
import { buildFoodQuery } from "@/lib/food";
import type { Priority, Recommendation, SearchRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

type NaverLocalItem = {
  title: string;
  link: string;
  category: string;
  description: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
};

type NaverLocalResponse = {
  total: number;
  display: number;
  items: NaverLocalItem[];
};

function bad(message: string, code = "VALIDATION_ERROR", extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status: code === "MISSING_API_KEY" ? 500 : 400 });
}

function validate(body: SearchRequest) {
  if (!body.locationText?.trim()) return "지역을 직접 입력해 주세요. 네이버 오픈API 버전은 현재 위치 좌표를 주소로 변환하지 않습니다.";
  if (!body.foodCategory) return "음식 종류를 선택해 주세요.";
  if (body.foodCategory === "기타" && !body.customFood?.trim()) return "기타 음식 종류를 직접 입력해 주세요.";
  if (!body.weekday) return "방문 요일을 선택해 주세요.";
  if (!/^\d{2}:\d{2}$/.test(body.visitTime || "")) return "방문 시간을 선택해 주세요.";
  if (body.priorities.length > 2) return "중요 기준은 최대 2개까지 선택할 수 있습니다.";
  return null;
}

function stripHtml(text: string) {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

function includesFoodCategory(item: NaverLocalItem, request: SearchRequest) {
  const target = request.foodCategory === "기타" ? request.customFood?.trim() || "" : request.foodCategory;
  const haystack = `${stripHtml(item.title)} ${item.category} ${item.description}`.toLowerCase();
  const aliases: Record<string, string[]> = {
    "한식": ["한식", "국밥", "백반", "찌개", "냉면", "갈비", "족발", "보쌈"],
    "양식": ["양식", "파스타", "피자", "스테이크", "브런치", "레스토랑"],
    "일식": ["일식", "초밥", "스시", "라멘", "돈카츠", "이자카야"],
    "중식": ["중식", "중국", "짜장", "짬뽕", "마라", "딤섬"],
    "카페": ["카페", "디저트", "커피"],
    "고기": ["고기", "삼겹살", "갈비", "구이", "정육", "육류"],
    "술집": ["술집", "주점", "호프", "펍", "바", "이자카야"],
    "분식": ["분식", "떡볶이", "김밥", "튀김"],
    "아시안": ["아시안", "태국", "베트남", "인도", "쌀국수", "커리"],
    "베이커리": ["베이커리", "빵", "제과", "제빵"],
    "기타": [target]
  };
  return (aliases[request.foodCategory] || [target]).some((word) => word && haystack.includes(word.toLowerCase()));
}

function priorityScore(item: NaverLocalItem, priorities: Priority[]) {
  const text = `${stripHtml(item.title)} ${item.category} ${item.description} ${item.roadAddress} ${item.address}`;
  return priorities.reduce((score, priority) => {
    if (priority === "거리") return score + 4;
    if (priority === "맛" && /맛|요리|음식|전문|식당/.test(text)) return score + 4;
    if (priority === "가격" && /가성비|저렴|분식|백반/.test(text)) return score + 4;
    if (priority === "분위기" && /카페|레스토랑|바|펍|브런치/.test(text)) return score + 3;
    if (priority === "주차" && /주차/.test(text)) return score + 4;
    if (priority === "대기시간" || priority === "친절도") return score + 1;
    return score + 2;
  }, 0);
}

function naverMapUrl(item: NaverLocalItem) {
  const name = stripHtml(item.title);
  const address = item.roadAddress || item.address;
  return item.link || `https://map.naver.com/p/search/${encodeURIComponent(`${name} ${address}`)}`;
}

function toRecommendation(item: NaverLocalItem, request: SearchRequest, index: number): Recommendation {
  const name = stripHtml(item.title);
  const address = item.roadAddress || item.address || "주소 정보 없음";
  const baseScore = 76 - index * 4;
  const fitScore = Math.max(0, Math.min(100, baseScore + priorityScore(item, request.priorities)));
  const category = item.category || "네이버 지역 검색 결과";

  return {
    rank: index + 1,
    placeId: `${item.mapx}-${item.mapy}-${index}`,
    name,
    address,
    googleMapsRating: null,
    googleMapsReviewCount: null,
    distanceMeters: null,
    selectedDayOpen: null,
    selectedTimeOpen: null,
    openingHours: ["네이버 지역 검색 API는 영업시간을 제공하지 않습니다."],
    regularClosed: "정보 제공 안 됨",
    breakTime: "정보 제공 안 됨",
    foodCategory: category,
    priceLevel: "정보 제공 안 됨",
    reviewStats: {
      apiReviewCount: 0,
      sponsoredReviewCount: 0,
      usableReviewCount: 0,
      positivity: null,
      trustLabel: "네이버 지역 검색 API는 리뷰 본문을 제공하지 않아 리뷰 신뢰도 분석을 수행하지 않았습니다.",
      strengths: ["네이버 지역 검색에 등록된 실제 장소입니다.", category],
      weaknesses: ["평점, 리뷰 본문, 영업시간은 네이버 지역 검색 API에서 제공되지 않습니다."],
      priorityInsights: {
        "맛": "리뷰 본문이 제공되지 않아 맛 평가는 분석하지 않았습니다.",
        "가격": "가격 정보가 제공되지 않습니다.",
        "분위기": "리뷰 본문이 제공되지 않아 분위기 평가는 분석하지 않았습니다.",
        "대기시간": "대기시간 정보는 제공되지 않습니다.",
        "친절도": "친절도 정보는 제공되지 않습니다.",
        "주차": /주차/.test(`${item.description} ${item.category}`) ? "장소 설명 또는 분류에서 주차 관련 단서가 확인됩니다." : "주차 정보는 제공되지 않습니다.",
        "거리": "네이버 지역 검색 API 응답 좌표계 제한으로 정확한 반경 거리 계산은 적용하지 않았습니다."
      },
      insufficient: ["리뷰 분석에 필요한 리뷰 본문이 제공되지 않습니다."]
    },
    fitScore,
    reasons: [
      `네이버 지역 검색에서 "${request.locationText} ${buildFoodQuery(request.foodCategory, request.customFood)}" 조건으로 검색된 실제 장소입니다.`,
      "평점과 리뷰 본문은 제공되지 않아 추천 적합도에는 검색 순위, 음식 분류, 선택 기준 단서만 반영했습니다.",
      "방문 전 네이버 지도에서 최신 영업시간과 휴무일을 확인해 주세요."
    ],
    googleMapsUrl: naverMapUrl(item)
  };
}

async function searchNaverLocal(request: SearchRequest, clientId: string, clientSecret: string) {
  const query = `${request.locationText} ${buildFoodQuery(request.foodCategory, request.customFood)}`;
  const url = new URL("https://openapi.naver.com/v1/search/local.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "comment");

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Naver Local Search 실패: ${response.status} ${detail}`);
  }

  return (await response.json()) as NaverLocalResponse;
}

export async function POST(request: Request) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return bad("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다. Netlify 환경변수에 네이버 오픈API 키를 추가해 주세요.", "MISSING_API_KEY");
  }

  try {
    const body = (await request.json()) as SearchRequest;
    const validationError = validate(body);
    if (validationError) return bad(validationError);

    const data = await searchNaverLocal(body, clientId, clientSecret);
    const filtered = data.items.filter((item) => includesFoodCategory(item, body));
    const source = filtered.length ? filtered : data.items;
    const recommendations = source.slice(0, 3).map((item, index) => toRecommendation(item, body, index));

    return NextResponse.json({
      ok: true,
      resolvedLocation: {
        label: body.locationText,
        lat: body.lat ?? 0,
        lng: body.lng ?? 0
      },
      searchedCount: data.items.length,
      filteredCount: recommendations.length,
      recommendations,
      notice:
        recommendations.length === 0
          ? "선택한 조건을 만족하는 식당을 찾지 못했습니다."
          : "네이버 지역 검색 API는 평점, 리뷰 본문, 영업시간을 제공하지 않아 해당 항목은 분석하지 않았습니다."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "NAVER_API_ERROR",
        message: "네이버 지역 검색 API 요청 중 오류가 발생했습니다.",
        suggestions: ["NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET 값을 확인해 주세요.", "네이버 개발자 센터에서 검색 API 권한이 켜져 있는지 확인해 주세요."],
        detail: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 502 }
    );
  }
}
