import { Suspense } from "react";
import { CollectView } from "@/features/measure/collect/CollectView";

export const metadata = { title: "데이터 수집" };

export default function Page() {
  return (
    <Suspense>
      <CollectView />
    </Suspense>
  );
}
