import { Suspense } from "react";
import { DefectsView } from "@/features/measure/defects/DefectsView";

export const metadata = { title: "결함 관리" };

export default function Page() {
  return (
    <Suspense>
      <DefectsView />
    </Suspense>
  );
}
