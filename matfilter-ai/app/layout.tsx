import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "맛필터 AI",
  description: "네이버 지역 검색으로 내 조건에 가까운 식당 3곳만"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
