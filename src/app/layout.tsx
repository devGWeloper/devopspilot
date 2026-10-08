import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-sans",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AI Tool PoC 과제 선정", template: "%s · AI Tool PoC" },
  description: "SK hynix × SK AX Replay 생산성 검증 포털",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
