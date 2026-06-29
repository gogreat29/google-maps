import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "맛필터 AI",
  description: "광고성 리뷰는 빼고, 내 조건에 맞는 식당 3곳만"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
