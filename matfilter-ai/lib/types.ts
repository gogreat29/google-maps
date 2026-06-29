export type FoodCategory =
  | "한식"
  | "양식"
  | "일식"
  | "중식"
  | "카페"
  | "고기"
  | "술집"
  | "분식"
  | "아시안"
  | "베이커리"
  | "기타";

export type Weekday =
  | "월요일"
  | "화요일"
  | "수요일"
  | "목요일"
  | "금요일"
  | "토요일"
  | "일요일";

export type Priority = "맛" | "가격" | "분위기" | "대기시간" | "친절도" | "주차" | "거리";

export type SearchRequest = {
  locationText: string;
  lat?: number;
  lng?: number;
  radius: 500 | 1000 | 3000 | 5000;
  foodCategory: FoodCategory;
  customFood?: string;
  weekday: Weekday;
  visitTime: string;
  minRating: number | null;
  priorities: Priority[];
};

export type ReviewStats = {
  apiReviewCount: number;
  sponsoredReviewCount: number;
  usableReviewCount: number;
  positivity: number | null;
  trustLabel: string;
  strengths: string[];
  weaknesses: string[];
  priorityInsights: Record<Priority, string>;
  insufficient: string[];
};

export type Recommendation = {
  rank: number;
  placeId: string;
  name: string;
  address: string;
  googleMapsRating: number | null;
  googleMapsReviewCount: number | null;
  distanceMeters: number | null;
  selectedDayOpen: boolean | null;
  selectedTimeOpen: boolean | null;
  openingHours: string[];
  regularClosed: string;
  breakTime: string;
  foodCategory: string;
  priceLevel: string;
  reviewStats: ReviewStats;
  fitScore: number;
  reasons: string[];
  googleMapsUrl: string;
};

export type ApiErrorCode =
  | "MISSING_API_KEY"
  | "VALIDATION_ERROR"
  | "AMBIGUOUS_LOCATION"
  | "GOOGLE_API_ERROR"
  | "NAVER_API_ERROR"
  | "NO_RESULTS";

export type ApiResponse =
  | {
      ok: true;
      resolvedLocation: {
        label: string;
        lat: number;
        lng: number;
      };
      searchedCount: number;
      filteredCount: number;
      recommendations: Recommendation[];
      notice?: string;
    }
  | {
      ok: false;
      code: ApiErrorCode;
      message: string;
      suggestions?: string[];
      candidates?: string[];
    };
