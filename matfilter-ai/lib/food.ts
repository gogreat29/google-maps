import type { FoodCategory } from "./types";

export const FOOD_OPTIONS: FoodCategory[] = [
  "한식",
  "양식",
  "일식",
  "중식",
  "카페",
  "고기",
  "술집",
  "분식",
  "아시안",
  "베이커리",
  "기타"
];

export function buildFoodQuery(category: FoodCategory, customFood?: string) {
  if (category === "기타") {
    return customFood?.trim() || "맛집";
  }

  const keywordMap: Record<FoodCategory, string> = {
    "한식": "한식 식당",
    "양식": "양식 레스토랑",
    "일식": "일식 식당 스시 라멘",
    "중식": "중식 중국집",
    "카페": "카페 디저트",
    "고기": "고기집 삼겹살 구이",
    "술집": "술집 이자카야 펍",
    "분식": "분식 떡볶이 김밥",
    "아시안": "아시안 음식 태국 베트남 인도",
    "베이커리": "베이커리 빵집",
    "기타": "맛집"
  };

  return keywordMap[category];
}
