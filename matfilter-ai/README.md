# 맛필터 AI

네이버 오픈API 지역 검색을 사용해 사용자가 입력한 지역과 음식 종류에 가까운 실제 식당을 최대 3곳 추천하는 웹앱입니다.

## 현재 데이터 출처

- 네이버 검색 API > 지역 검색
- 요청 URL: `https://openapi.naver.com/v1/search/local.json`
- 공식 문서: https://developers.naver.com/docs/serviceapi/search/local/local.md

## 중요한 제한

네이버 지역 검색 API는 다음 정보를 제공하지 않습니다.

- 평점
- 리뷰 본문
- 전체 리뷰 수
- 영업시간
- 정기휴무
- 브레이크타임
- 가격대
- 좌표 기반 반경 검색

따라서 Google Maps 버전에서 의도했던 “광고성 리뷰 제외”, “리뷰 긍정도”, “영업시간 필터”, “최소 평점 필터”는 네이버 오픈API만으로는 정확히 구현할 수 없습니다. 앱 화면에는 이 제한을 숨기지 않고 “네이버 지역 검색 API 미제공”으로 표시합니다.

## 구현 기능

- Next.js App Router, TypeScript, Tailwind CSS
- Netlify 배포
- 서버 API Route에서 네이버 지역 검색 API 호출
- 지역명 + 음식 종류 기반 실제 장소 검색
- 결과 최대 3곳 표시
- 네이버 지도 링크 제공
- 네이버 API 키 미설정 오류 안내
- 중요 기준 최대 2개 제한
- 네이버 API가 제공하지 않는 평점/리뷰/영업시간 항목은 명확히 미제공 표시

## 환경변수

`.env.example`을 참고해 로컬 `.env.local` 또는 Netlify 환경변수를 설정합니다.

```bash
NAVER_CLIENT_ID=your_naver_openapi_client_id
NAVER_CLIENT_SECRET=your_naver_openapi_client_secret
```

## 네이버 오픈API 키 발급

1. https://developers.naver.com/ 접속
2. 로그인
3. `Application > 애플리케이션 등록`
4. 애플리케이션 이름 입력
5. 사용 API에서 `검색` 선택
6. 비로그인 오픈 API 서비스 환경은 `WEB 설정` 선택
7. 서비스 URL에 배포 URL 입력

```text
https://matfilter-ai.netlify.app
```

8. 등록 후 `Client ID`, `Client Secret` 확인
9. Netlify 프로젝트 `matfilter-ai`의 Environment variables에 추가
10. Netlify에서 재배포

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## Netlify 배포

현재 배포 URL:

```text
https://matfilter-ai.netlify.app
```

배포 설정:

- Base directory: `matfilter-ai`
- Build command: `npm run build`
- Publish directory: `.next`
- Environment variables: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`

## 추천 로직

1. 지역명과 음식 종류를 합쳐 네이버 지역 검색 API 요청
2. 네이버 검색 결과 중 음식 카테고리와 맞는 항목 우선 필터
3. 검색 순위, 카테고리, 선택한 중요 기준 단서를 합산해 추천 적합도 산정
4. 최대 3곳만 표시
5. 제공되지 않는 평점/리뷰/영업시간 정보는 추정하지 않음

랜덤 점수는 사용하지 않습니다.
