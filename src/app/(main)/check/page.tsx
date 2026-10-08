import { Suspense } from "react";
import { CheckView } from "@/features/measure/check/CheckView";

export const metadata = { title: "데이터 점검" };

export default function Page() {
  return (
    <Suspense>
      <CheckView />
    </Suspense>
  );
}
