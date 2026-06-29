import type { Priority, Recommendation, ReviewStats } from "./types";

const POSITIVE = ["맛있", "좋", "친절", "깔끔", "추천", "만족", "훌륭", "재방문", "신선", "고소", "부드럽", "괜찮", "넓", "편하"];
const NEGATIVE = ["별로", "불친절", "비싸", "아쉽", "늦", "기다", "대기", "불편", "시끄럽", "좁", "짜", "느끼", "실망", "복잡"];

const TOPICS: Record<Priority, { positive: string[]; negative: string[]; fallback: string }> = {
  "맛": {
    positive: ["맛있", "신선", "고소", "부드럽", "풍미", "식감", "소스", "육즙"],
    negative: ["짜", "느끼", "싱겁", "질기", "맛없", "비리"],
    fallback: "맛 관련 언급이 충분하지 않습니다."
  },
  "가격": {
    positive: ["가성비", "저렴", "합리", "푸짐", "가격 좋"],
    negative: ["비싸", "가격대", "부담", "양이 적"],
    fallback: "가격 관련 언급이 충분하지 않습니다."
  },
  "분위기": {
    positive: ["분위기", "인테리어", "깔끔", "아늑", "예쁘", "조용"],
    negative: ["시끄럽", "어수선", "좁", "불편"],
    fallback: "분위기 관련 언급이 충분하지 않습니다."
  },
  "대기시간": {
    positive: ["대기 없", "금방", "빠르", "회전율", "바로"],
    negative: ["웨이팅", "기다", "늦", "오래 걸"],
    fallback: "대기시간 정보는 확인되지 않았습니다."
  },
  "친절도": {
    positive: ["친절", "응대", "서비스 좋", "세심"],
    negative: ["불친절", "응대 아쉽", "서비스 별로"],
    fallback: "친절도 관련 언급이 충분하지 않습니다."
  },
  "주차": {
    positive: ["주차 가능", "주차 편", "발렛", "주차장"],
    negative: ["주차 불가", "주차 어렵", "주차 힘"],
    fallback: "주차 정보는 확인되지 않았습니다."
  },
  "거리": {
    positive: ["가깝", "역 근처", "접근성", "찾기 쉬"],
    negative: ["멀", "찾기 어렵", "골목"],
    fallback: "거리 관련 리뷰 언급은 충분하지 않습니다."
  }
};

function countHits(text: string, words: string[]) {
  return words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
}

function summarizeTopic(text: string, topic: Priority) {
  const positive = countHits(text, TOPICS[topic].positive);
  const negative = countHits(text, TOPICS[topic].negative);

  if (positive + negative === 0) return TOPICS[topic].fallback;
  if (positive >= negative) return `${topic} 관련 긍정 언급이 상대적으로 많습니다.`;
  return `${topic} 관련 아쉬운 언급이 확인됩니다.`;
}

export function analyzeReviews(texts: string[], sponsoredCount: number): ReviewStats {
  const joined = texts.join(" ");
  const positiveHits = countHits(joined, POSITIVE);
  const negativeHits = countHits(joined, NEGATIVE);
  const usableReviewCount = texts.length;
  const positivity = usableReviewCount === 0 ? null : Math.round((positiveHits / Math.max(1, positiveHits + negativeHits)) * 100);

  const topicLabels: Record<string, string[]> = {
    "맛": ["맛있", "신선", "고소", "부드럽", "소스", "식감", "육즙"],
    "가격": ["가성비", "저렴", "합리", "푸짐"],
    "분위기": ["분위기", "깔끔", "아늑", "예쁘", "조용"],
    "친절도": ["친절", "응대", "세심"],
    "주차": ["주차", "발렛"],
    "재방문": ["재방문", "또 오", "다시"]
  };

  const strengths = Object.entries(topicLabels)
    .filter(([, words]) => countHits(joined, words) > 0)
    .map(([topic]) => topic)
    .slice(0, 4);

  const weaknessLabels: Record<string, string[]> = {
    "대기시간": ["웨이팅", "기다", "오래 걸", "늦"],
    "가격": ["비싸", "부담"],
    "공간": ["좁", "시끄럽", "복잡"],
    "응대": ["불친절", "응대 아쉽"]
  };

  const weaknesses = Object.entries(weaknessLabels)
    .filter(([, words]) => countHits(joined, words) > 0)
    .map(([topic]) => topic)
    .slice(0, 4);

  const priorityInsights = Object.fromEntries(
    (Object.keys(TOPICS) as Priority[]).map((topic) => [topic, summarizeTopic(joined, topic)])
  ) as Record<Priority, string>;

  const insufficient = [];
  if (usableReviewCount === 0) insufficient.push("분석 가능한 리뷰가 부족합니다.");
  if (!joined.includes("가격") && !joined.includes("가성비") && !joined.includes("비싸")) insufficient.push("가격 관련 언급이 충분하지 않습니다.");
  if (!joined.includes("대기") && !joined.includes("웨이팅") && !joined.includes("기다")) insufficient.push("대기시간 정보는 확인되지 않았습니다.");

  return {
    apiReviewCount: usableReviewCount + sponsoredCount,
    sponsoredReviewCount: sponsoredCount,
    usableReviewCount,
    positivity,
    trustLabel: usableReviewCount >= 4 ? "분석 가능 리뷰가 비교적 충분합니다." : "Google Places API가 제공한 일부 리뷰만 분석했습니다.",
    strengths: strengths.length ? strengths : ["확인된 장점 언급이 충분하지 않습니다."],
    weaknesses: weaknesses.length ? weaknesses : ["확인된 단점 언급이 충분하지 않습니다."],
    priorityInsights,
    insufficient
  };
}

export function scoreRecommendation(input: {
  rating: number | null;
  reviewCount: number | null;
  distanceMeters: number | null;
  selectedTimeOpen: boolean | null;
  stats: ReviewStats;
  priorities: Priority[];
}) {
  const ratingScore = input.rating == null ? 0 : Math.min(40, (input.rating / 5) * 40);
  const reviewScore = input.reviewCount == null ? 0 : Math.min(15, Math.log10(input.reviewCount + 1) * 5);
  const distanceScore =
    input.distanceMeters == null ? 5 : Math.max(0, 15 - Math.min(15, input.distanceMeters / 350));
  const openScore = input.selectedTimeOpen === true ? 10 : input.selectedTimeOpen === null ? 3 : 0;
  const positivityScore = input.stats.positivity == null ? 3 : (input.stats.positivity / 100) * 10;
  const priorityScore = input.priorities.reduce((score, priority) => {
    const insight = input.stats.priorityInsights[priority] || "";
    if (insight.includes("긍정")) return score + 5;
    if (insight.includes("아쉬운")) return score + 1;
    if (priority === "거리" && input.distanceMeters != null && input.distanceMeters <= 1000) return score + 4;
    return score + 2;
  }, 0);

  return Math.round(Math.max(0, Math.min(100, ratingScore + reviewScore + distanceScore + openScore + positivityScore + priorityScore)));
}

export function buildReasons(reco: Pick<Recommendation, "googleMapsRating" | "selectedTimeOpen" | "distanceMeters" | "reviewStats">, priorities: Priority[]) {
  const reasons = [];
  if (reco.googleMapsRating != null) reasons.push(`Google Maps 평점 ${reco.googleMapsRating.toFixed(1)} 조건을 충족합니다.`);
  if (reco.selectedTimeOpen) reasons.push("선택한 요일과 시간에 영업 중으로 확인됩니다.");
  if (reco.distanceMeters != null) reasons.push(`설정 지역 기준 약 ${Math.round(reco.distanceMeters)}m 거리입니다.`);
  for (const priority of priorities) {
    reasons.push(reco.reviewStats.priorityInsights[priority]);
  }
  if (!reasons.length) reasons.push("Google Maps 장소 정보와 제공 리뷰를 기준으로 조건에 가장 가깝습니다.");
  return reasons.slice(0, 4);
}
