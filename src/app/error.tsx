"use client";

import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorScreen code="500" title="화면을 표시하지 못했습니다" message="일시적인 오류일 수 있습니다. 다시 시도해도 같으면 관리자에게 알려 주세요.">
      <button onClick={reset}>다시 시도</button>
    </ErrorScreen>
  );
}
