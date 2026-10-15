"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { errMessage } from "@/lib/apiClient";

/** 변경 요청 → 성공 문구 → 서버 화면 다시 그리기. 화면 데이터는 서버 컴포넌트가 들고 있으므로 refresh 로 갱신한다. */
export function useMutate() {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    async (fn: () => Promise<unknown>, okText?: string): Promise<boolean> => {
      setBusy(true);
      try {
        await fn();
        if (okText) toast(okText);
        startTransition(() => router.refresh());
        return true;
      } catch (e) {
        toastError(errMessage(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [router, toast, toastError],
  );

  return { run, busy: busy || pending };
}
