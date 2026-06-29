"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ApiResponse, Priority, Recommendation, SearchRequest, Weekday } from "@/lib/types";
import { FOOD_OPTIONS } from "@/lib/food";

const radii = [
  { label: "500m", value: 500 },
  { label: "1km", value: 1000 },
  { label: "3km", value: 3000 },
  { label: "5km", value: 5000 }
] as const;

const weekdays: Weekday[] = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
const minRatings = [
  { label: "5.0", value: 5 },
  { label: "4.5 이상", value: 4.5 },
  { label: "4.0 이상", value: 4 },
  { label: "3.5 이상", value: 3.5 },
  { label: "평점 무관", value: null }
] as const;
const priorities: Priority[] = ["맛", "가격", "분위기", "대기시간", "친절도", "주차", "거리"];
const loadingMessages = [
  "Google Maps에서 식당을 찾고 있어요.",
  "영업시간과 평점을 확인하고 있어요.",
  "대가성 표현이 포함된 리뷰를 제외하고 있어요.",
  "내 조건에 가장 가까운 식당을 비교하고 있어요."
];

type LocationState = {
  label: string;
  lat?: number;
  lng?: number;
};

export default function Home() {
  const [location, setLocation] = useState<LocationState>({ label: "" });
  const [radius, setRadius] = useState<SearchRequest["radius"]>(1000);
  const [foodCategory, setFoodCategory] = useState<SearchRequest["foodCategory"]>("한식");
  const [customFood, setCustomFood] = useState("");
  const [weekday, setWeekday] = useState<Weekday | "">("");
  const [visitTime, setVisitTime] = useState("18:00");
  const [minRating, setMinRating] = useState<number | null>(4);
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>(["맛"]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const inputSummary = useMemo(() => {
    const rating = minRating == null ? "평점 무관" : `${minRating.toFixed(1)} 이상`;
    return `${location.label || "지역 미설정"} · ${radius >= 1000 ? `${radius / 1000}km` : `${radius}m`} · ${foodCategory} · ${weekday || "요일 미선택"} ${visitTime} · ${rating}`;
  }, [foodCategory, location.label, minRating, radius, visitTime, weekday]);

  function togglePriority(priority: Priority) {
    setMessage("");
    setSelectedPriorities((current) => {
      if (current.includes(priority)) return current.filter((item) => item !== priority);
      if (current.length >= 2) {
        setMessage("중요 기준은 최대 2개까지 선택할 수 있습니다.");
        return current;
      }
      return [...current, priority];
    });
  }

  async function useCurrentLocation() {
    setMessage("");
    setResponse(null);

    if (!navigator.geolocation) {
      setMessage("이 브라우저에서는 현재 위치 기능을 사용할 수 없습니다. 지역을 직접 입력해 주세요.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ label: "현재 위치 주소 확인 중", lat, lng });
        try {
          const reverse = await fetch("/api/reverse-geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng })
          });
          const data = await reverse.json();
          if (!reverse.ok || !data.ok) throw new Error(data.message || "주소 변환에 실패했습니다.");
          setLocation({ label: data.label, lat, lng });
          setMessage("현재 위치를 지역 입력값으로 설정했습니다. 조건을 선택한 뒤 검색 버튼을 눌러 주세요.");
        } catch (error) {
          setLocation({ label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
          setMessage(error instanceof Error ? error.message : "현재 위치 주소 변환에 실패했습니다.");
        }
      },
      () => {
        setMessage("위치 권한을 허용하지 않았습니다. 지역을 직접 입력해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setResponse(null);

    if (!location.label.trim()) return setMessage("지역을 입력하거나 현재 위치를 설정해 주세요.");
    if (!foodCategory) return setMessage("음식 종류를 선택해 주세요.");
    if (foodCategory === "기타" && !customFood.trim()) return setMessage("기타 음식 종류를 직접 입력해 주세요.");
    if (!weekday) return setMessage("방문 요일을 선택해 주세요.");
    if (!visitTime) return setMessage("방문 시간을 선택해 주세요.");

    setLoading(true);
    const timer = window.setInterval(() => setLoadingIndex((index) => (index + 1) % loadingMessages.length), 1300);

    try {
      const payload: SearchRequest = {
        locationText: location.label,
        lat: location.lat,
        lng: location.lng,
        radius,
        foodCategory,
        customFood,
        weekday,
        visitTime,
        minRating,
        priorities: selectedPriorities
      };
      const result = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await result.json()) as ApiResponse;
      setResponse(data);
      if (!data.ok) setMessage(data.message);
    } catch {
      setMessage("검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      window.clearInterval(timer);
      setLoading(false);
      setLoadingIndex(0);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      <section className="mb-5 rounded-[28px] bg-white px-5 py-6 shadow-soft sm:px-8">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-coral-100 px-3 py-1 text-sm font-bold text-coral-700">
              광고성 리뷰 자동 제외
            </div>
            <h1 className="text-4xl font-black tracking-normal text-ink sm:text-5xl">맛필터 AI</h1>
            <p className="mt-3 text-lg font-semibold text-stone-700">광고성 리뷰는 빼고, 내 조건에 맞는 식당 3곳만</p>
          </div>
          <p className="max-w-sm rounded-2xl bg-coral-50 px-4 py-3 text-sm leading-6 text-stone-700">
            현재 위치와 검색 조건은 맛집 검색에만 사용되며 별도로 저장되지 않습니다.
          </p>
        </div>

        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <fieldset className="panel">
            <legend>지역</legend>
            <div className="flex gap-2">
              <input
                value={location.label}
                onChange={(event) => setLocation({ label: event.target.value })}
                placeholder="성수동, 강남역, 서울 마포구 연남동"
                className="input"
              />
              <button type="button" onClick={useCurrentLocation} className="secondary whitespace-nowrap">
                현재 위치 설정
              </button>
            </div>
            <p className="hint">현재 위치 설정은 자동 검색이 아니라 지역 입력값만 채웁니다.</p>
          </fieldset>

          <fieldset className="panel">
            <legend>검색 반경</legend>
            <div className="segmented">
              {radii.map((item) => (
                <button key={item.value} type="button" onClick={() => setRadius(item.value)} className={radius === item.value ? "active" : ""}>
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="panel">
            <legend>음식 종류</legend>
            <div className="chip-grid">
              {FOOD_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setFoodCategory(option)}
                  className={foodCategory === option ? "chip selected" : "chip"}
                >
                  {option}
                </button>
              ))}
            </div>
            {foodCategory === "기타" ? (
              <input value={customFood} onChange={(event) => setCustomFood(event.target.value)} placeholder="예: 샤브샤브, 멕시칸" className="input mt-3" />
            ) : null}
          </fieldset>

          <fieldset className="panel">
            <legend>방문 요일과 시간</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={weekday} onChange={(event) => setWeekday(event.target.value as Weekday)} className="input">
                <option value="">요일 선택</option>
                {weekdays.map((day) => (
                  <option key={day}>{day}</option>
                ))}
              </select>
              <input value={visitTime} onChange={(event) => setVisitTime(event.target.value)} type="time" className="input" />
            </div>
          </fieldset>

          <fieldset className="panel">
            <legend>최소 Google Maps 평점</legend>
            <div className="chip-grid">
              {minRatings.map((item) => (
                <button key={item.label} type="button" onClick={() => setMinRating(item.value)} className={minRating === item.value ? "chip selected" : "chip"}>
                  {item.label}
                </button>
              ))}
            </div>
            {minRating === 5 ? <p className="hint warning">5.0을 선택하면 검색 결과가 매우 제한될 수 있습니다.</p> : null}
          </fieldset>

          <fieldset className="panel">
            <legend>중요 기준 최대 2개</legend>
            <div className="chip-grid">
              {priorities.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => togglePriority(priority)}
                  className={selectedPriorities.includes(priority) ? "chip selected" : "chip"}
                >
                  {priority}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="lg:col-span-2">
            <div className="mb-3 rounded-2xl border border-coral-100 bg-coral-50 px-4 py-3 text-sm font-semibold text-stone-700">{inputSummary}</div>
            <button type="submit" disabled={loading} className="primary">
              {loading ? loadingMessages[loadingIndex] : "맛집 3곳 추천받기"}
            </button>
          </div>
        </form>
      </section>

      {message ? <div className="notice">{message}</div> : null}
      {loading ? <LoadingCard text={loadingMessages[loadingIndex]} /> : null}
      {response?.ok ? <Results response={response} priorities={selectedPriorities} /> : null}
      {response && !response.ok ? <ErrorPanel response={response} /> : null}
    </main>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <section className="mt-5 rounded-[24px] bg-white p-6 text-center shadow-soft">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-coral-100">
        <span className="h-7 w-7 animate-spin rounded-full border-4 border-coral-500 border-t-transparent" />
      </div>
      <p className="font-bold text-stone-700">{text}</p>
    </section>
  );
}

function Results({ response, priorities }: { response: Extract<ApiResponse, { ok: true }>; priorities: Priority[] }) {
  if (!response.recommendations.length) {
    return (
      <section className="result-empty">
        <h2>선택한 조건을 만족하는 식당을 찾지 못했습니다.</h2>
        <p>검색 반경 넓히기, 최소 평점 낮추기, 방문 시간 변경하기, 음식 종류 범위 넓히기를 시도해 보세요.</p>
      </section>
    );
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="rounded-[24px] bg-white p-5 shadow-soft">
        <p className="text-sm font-bold text-coral-700">검색 기준 위치: {response.resolvedLocation.label}</p>
        {response.notice ? <p className="mt-2 text-sm text-stone-600">{response.notice}</p> : null}
      </div>
      {response.recommendations.map((item) => (
        <RestaurantCard key={item.placeId} item={item} priorities={priorities} />
      ))}
    </section>
  );
}

function RestaurantCard({ item, priorities }: { item: Recommendation; priorities: Priority[] }) {
  return (
    <article className="rounded-[28px] bg-white p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rank">{item.rank}위</span>
          <h2 className="mt-2 text-2xl font-black text-ink">{item.name}</h2>
          <p className="mt-1 text-sm text-stone-600">{item.address}</p>
        </div>
        <div className="score">{item.fitScore}점</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Google Maps 전체 평점" value={item.googleMapsRating == null ? "정보 없음" : `Google Maps 평점 ${item.googleMapsRating.toFixed(1)}`} />
        <Info label="Google Maps 전체 리뷰 수" value={item.googleMapsReviewCount == null ? "정보 없음" : `Google Maps 리뷰 ${item.googleMapsReviewCount.toLocaleString()}개`} />
        <Info label="거리" value={item.distanceMeters == null ? "정보 없음" : `${Math.round(item.distanceMeters).toLocaleString()}m`} />
        <Info label="선택 요일 영업 여부" value={item.selectedDayOpen == null ? "영업시간 정보 없음" : item.selectedDayOpen ? "영업일" : "정기휴무"} />
        <Info label="선택 시간 영업 여부" value={item.selectedTimeOpen == null ? "영업시간 정보 없음" : item.selectedTimeOpen ? "영업" : "영업하지 않음"} />
        <Info label="음식 종류" value={item.foodCategory} />
        <Info label="정기휴무" value={item.regularClosed} />
        <Info label="브레이크타임" value={item.breakTime} />
        <Info label="가격대" value={item.priceLevel} />
      </div>

      <div className="mt-4 rounded-2xl border border-coral-100 bg-coral-50 p-4">
        <div className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-coral-700">대가성 표현 포함 리뷰 자동 제외</div>
        <div className="grid gap-2 text-sm font-semibold text-stone-700 sm:grid-cols-3">
          <p>API 제공 리뷰: {item.reviewStats.apiReviewCount}개</p>
          <p>대가성 표현 포함 리뷰: {item.reviewStats.sponsoredReviewCount}개 제외</p>
          <p>실제 분석 리뷰: {item.reviewStats.usableReviewCount}개</p>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          남은 리뷰 기반 긍정도: {item.reviewStats.positivity == null ? "분석 가능한 리뷰가 부족합니다." : `${item.reviewStats.positivity}%`} · {item.reviewStats.trustLabel}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TextList title="주요 장점" items={item.reviewStats.strengths} />
        <TextList title="주요 단점" items={item.reviewStats.weaknesses} />
      </div>

      <div className="mt-4 rounded-2xl bg-stone-50 p-4">
        <h3 className="mb-2 text-sm font-black text-stone-800">선택 기준 관련 분석</h3>
        {priorities.length ? (
          <ul className="space-y-1 text-sm text-stone-700">
            {priorities.map((priority) => (
              <li key={priority}>
                <b>{priority}</b>: {item.reviewStats.priorityInsights[priority]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-600">선택한 중요 기준이 없습니다.</p>
        )}
      </div>

      <details className="mt-4 rounded-2xl border border-stone-200 p-4">
        <summary className="cursor-pointer font-bold text-stone-800">영업시간 보기</summary>
        <ul className="mt-3 space-y-1 text-sm text-stone-600">
          {item.openingHours.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-black text-stone-800">추천 이유</h3>
        <ul className="space-y-1 text-sm text-stone-700">
          {item.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <a className="maps-button" href={item.googleMapsUrl} target="_blank" rel="noreferrer">
        Google Maps에서 보기
      </a>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-3">
      <p className="text-xs font-bold text-stone-500">{label}</p>
      <p className="mt-1 font-extrabold text-stone-800">{value}</p>
    </div>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <h3 className="mb-2 text-sm font-black text-stone-800">{title}</h3>
      <ul className="space-y-1 text-sm text-stone-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ErrorPanel({ response }: { response: Extract<ApiResponse, { ok: false }> }) {
  return (
    <section className="result-empty">
      <h2>{response.message}</h2>
      {response.candidates?.length ? (
        <div className="mt-3 text-left">
          <p className="font-bold">가능한 후보 지역</p>
          <ul className="mt-2 space-y-1">
            {response.candidates.map((candidate) => (
              <li key={candidate}>{candidate}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {response.suggestions?.length ? <p className="mt-3">{response.suggestions.join(" ")}</p> : null}
    </section>
  );
}
