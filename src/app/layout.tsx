import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Tool PoC 과제 선정",
  description: "SK hynix × SK AX Replay 생산성 검증 포털",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
