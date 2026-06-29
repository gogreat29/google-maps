# 맛필터 AI

광고성 리뷰는 빼고, 내 조건에 맞는 식당 3곳만 추천하는 Google Maps 기반 맛집 추천 웹앱입니다.

## 구현 범위

- Next.js App Router, TypeScript, Tailwind CSS 기반 모바일 우선 웹앱
- 브라우저 Geolocation API로 현재 위치 권한 요청
- 서버 API Route에서 Google Geocoding API, Places API(New)를 호출
- 직접 입력 지역을 좌표로 변환하고 반경 내 장소 검색
- 음식 종류, 방문 요일, 방문 시간, 최소 Google Maps 평점 필터
- Google Places API가 제공한 일부 리뷰에서 대가성 표현 포함 리뷰를 보수적으로 제외
- Google Maps 전체 평점과 전체 리뷰 수를 API 제공 리뷰 분석 결과와 분리 표시
- 최대 3곳만 추천
- 조건에 맞는 결과 없음, API 키 미설정, Google API 오류, 중요 기준 3개 이상 선택 등 예외 안내

## 중요 제한

Google Places API는 전체 리뷰 본문을 제공하지 않고 일부 리뷰만 제공할 수 있습니다. 이 앱은 Google Maps 전체 평점을 다시 계산하지 않으며, 다음 항목을 분리해서 표시합니다.

- Google Maps 전체 평점
- Google Maps 전체 리뷰 수
- API로 불러온 분석 가능 리뷰 수
- 대가성 표현 포함으로 제외한 리뷰 수
- 남은 리뷰 기반 긍정도 또는 리뷰 신뢰도

브레이크타임은 Google 영업시간 periods에서 같은 요일에 영업 구간이 2개 이상 확인될 때만 표시합니다. 확실히 확인되지 않으면 `브레이크타임 정보 확인 필요`로 표시합니다.

## 필요 Google API

Google Cloud Console에서 다음 API를 활성화하세요.

1. Places API 또는 Places API (New)
2. Geocoding API
3. 선택 사항: Maps JavaScript API

이 앱의 현재 구현은 지도 렌더링을 하지 않으므로 Maps JavaScript API는 필수는 아닙니다. 비용은 Google Maps Platform의 현재 과금 정책과 무료 사용량을 직접 확인하세요. 무료라고 단정하지 않습니다.

## Google Cloud 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 생성합니다.
2. Google Maps Platform 사용을 위해 결제 계정 연결 상태를 확인합니다.
3. `APIs & Services > Library`에서 Places API(New)와 Geocoding API를 활성화합니다.
4. `APIs & Services > Credentials`에서 API 키를 생성합니다.
5. 서버용 키를 만들고 API 제한을 `Places API`, `Geocoding API`로 설정합니다.
6. 서버 배포 환경이 고정 IP를 제공한다면 서버 IP 제한을 적용합니다. Vercel처럼 고정 IP가 기본 제공되지 않는 환경에서는 API 제한을 반드시 적용하고, 필요 시 별도 프록시 또는 VPC egress 구성을 검토합니다.
7. 브라우저용 키가 필요한 기능을 추가할 경우 별도 키를 만들고 HTTP referrer 제한을 적용합니다.
8. 로컬 개발용 referrer 예시는 `http://localhost:3000/*`입니다.
9. 배포용 referrer 예시는 `https://your-domain.vercel.app/*`입니다.

## 환경변수

`.env.example`을 참고해 `.env.local`을 만듭니다.

```bash
GOOGLE_MAPS_API_KEY=your_server_restricted_google_maps_api_key
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=your_http_referrer_restricted_browser_key
```

현재 구현에서 필수 값은 `GOOGLE_MAPS_API_KEY`입니다. `.env.local`은 Git에 커밋하지 마세요.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다. Geolocation API는 HTTPS 또는 localhost에서 동작합니다.

## Netlify 온라인 배포

Netlify 권장 절차:

1. 이 폴더를 GitHub 저장소에 push합니다.
2. [Netlify](https://app.netlify.com/)에서 `Add new site > Import an existing project`를 선택합니다.
3. GitHub 저장소를 연결합니다.
4. 저장소 루트에 다른 파일이 함께 있다면 `Base directory`를 `matfilter-ai`로 설정합니다.
5. Build command는 `npm run build`로 설정합니다.
6. Publish directory는 `.next`로 설정합니다.
7. Environment variables에 `GOOGLE_MAPS_API_KEY`를 추가합니다.
8. Deploy를 실행합니다.
9. 배포 URL을 Google API 키 제한 설정에 반영합니다.
10. 시크릿 창과 모바일 화면에서 공개 URL 접속, 현재 위치 권한, 직접 지역 검색, Google Maps 링크를 테스트합니다.

`netlify.toml`과 `@netlify/plugin-nextjs`를 포함했기 때문에 Netlify가 Next.js API Route를 서버리스 함수로 처리합니다. 이 구조에서는 Google API 키가 프론트엔드에 직접 포함되지 않습니다.

## 추천 로직

1. 현재 위치 또는 직접 입력 지역을 좌표로 변환
2. 선택 반경과 음식 종류를 반영해 Google Places Text Search 실행
3. Google Maps 최소 평점 적용
4. Place Details로 영업시간과 리뷰 조회
5. 선택 요일과 방문 시간에 영업하지 않는 식당 제외
6. 명시적 대가성 표현 포함 리뷰 제외
7. 남은 리뷰에서 규칙 기반 장점, 단점, 긍정도, 중요 기준 적합도 분석
8. Google Maps 평점, 전체 리뷰 수, 거리, 영업 여부, 리뷰 긍정도, 중요 기준을 합산해 100점 만점 추천 적합도 산정
9. 최대 3곳만 반환

랜덤 점수는 사용하지 않습니다.

## 광고성 리뷰 탐지 기준

리뷰 본문에 다음과 같은 명시 표현 또는 유사 표현이 직접 포함된 경우에만 제외합니다.

- 업체로부터 서비스를 제공받았습니다
- 제품을 제공받았습니다
- 식사권을 제공받았습니다
- 원고료를 제공받았습니다
- 협찬받았습니다
- 체험단으로 방문했습니다
- 광고입니다
- 유료 광고
- 내돈내산이 아닌
- 협찬
- 체험단
- 원고료
- 식사권 제공
- 제품 제공
- 서비스 제공
- 초대받아 방문
- 지원받아 작성

단순히 칭찬이 많거나 문체가 홍보성이라는 이유만으로 제외하지 않습니다.

## 테스트 체크리스트

실제 Google API 키를 설정한 뒤 다음을 확인하세요.

- 공개 URL 접속 가능
- 모바일 화면 정상 표시
- 현재 위치 권한 요청 정상 작동
- 지역 직접 입력 정상 작동
- 검색 반경 선택 정상 작동
- 음식 종류 선택 정상 작동
- 요일, 시간 선택 정상 작동
- 최소 평점 선택 정상 작동
- 중요 기준 최대 2개 제한 작동
- Google Maps 실제 식당 검색
- 영업 여부 필터 작동
- 광고성 리뷰 탐지 작동
- 최대 3곳 결과 제한
- Google Maps 링크 작동
- 결과 없음 안내 작동
- API 오류 안내 작동
- 새로고침 후 오류 없음
- 시크릿 창에서도 공개 URL 접속 가능

## 현재 작업 환경에서 확인하지 못한 것

이 작업 환경에는 `npm`과 `netlify` CLI가 없고, Netlify 계정 인증과 `GOOGLE_MAPS_API_KEY`도 제공되지 않았습니다. 따라서 의존성 설치, Next.js 빌드, Google API 실호출, Netlify 실제 배포는 이 환경에서 수행하지 못했습니다. API 키와 Netlify 프로젝트 권한을 제공한 환경에서는 위 절차대로 배포할 수 있습니다.
