"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Callout } from "@/components/ui/Panel";
import { ApiError, api, errMessage, resetSessionExpired } from "@/lib/apiClient";
import s from "./login.module.css";

interface Demo {
  demo: boolean;
  accounts: { userId: string; userNm: string; role: string; password: string }[];
}

const STEPS = [
  ["과제 현황", "선정된 과제·요구사항과 SDLC 단계별 기준 공수"],
  ["공수 입력", "Codex 사용 시간 자동 수집 + AI 없이 한 시간 입력, 날마다 확정"],
  ["측정 결과", "확정된 값으로 공수 절감률·순절감률·AI 활용률"],
];

const SESSION_FAIL: Record<string, string> = {
  NO_COOKIE:
    "로그인은 성공했지만 브라우저가 세션 쿠키를 보내지 않습니다. 브라우저 쿠키 차단 정책이나 PC 보안 프로그램을 확인해 주세요 (F12 › Network › login 요청 › Cookies 탭에 차단 사유가 표시됩니다).",
  BAD_SIGNATURE: "세션 서명이 맞지 않습니다. 서버의 서명 키(auth.secret · AUTH_SECRET)가 서로 다르게 읽히고 있습니다.",
  EXPIRED: "세션이 발급 즉시 만료되었습니다. 서버 시계를 확인해 주세요.",
  MALFORMED: "세션 쿠키 값이 바뀌어 도착했습니다. 보안 프로그램·프록시가 쿠키를 고치고 있을 수 있습니다.",
  BAD_PAYLOAD: "세션 쿠키 값이 바뀌어 도착했습니다. 보안 프로그램·프록시가 쿠키를 고치고 있을 수 있습니다.",
  ERROR: "세션 검증 중 서버 오류가 났습니다. 서버 터미널의 [auth] 로그를 확인해 주세요.",
};

// 쿠키가 다음 요청에 실리지 않으면 화면을 옮겨도 로그인 화면으로 조용히 되돌아와 원인이 보이지 않는다 — 옮기기 전에 확인한다.
async function confirmSession() {
  try {
    await api("/api/auth/me");
  } catch (err) {
    const reason = err instanceof ApiError ? (err.details as { reason?: string } | undefined)?.reason : undefined;
    throw new Error((reason && SESSION_FAIL[reason]) || `로그인은 성공했지만 세션 확인에 실패했습니다: ${errMessage(err)}`);
  }
}

function LoginForm() {
  const params = useSearchParams();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<Demo | null>(null);

  useEffect(() => {
    api<Demo>("/api/auth/demo").then(setDemo).catch(() => setDemo(null));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ home: string }>("/api/auth/login", { body: { userId, password } });
      await confirmSession();
      resetSessionExpired();
      const next = params.get("next");
      // 클라이언트 라우팅(RSC fetch)은 사내 보안 에이전트·느린 dev 컴파일에서 멈춘 듯 보여, 전체 페이지 이동으로 쿠키를 확실히 싣는다.
      window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : r.home);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div className={s.heroTop}>
          <span className={s.mark}>PoC</span>
          <span className={s.org}>SK hynix × SK AX</span>
        </div>
        <div className={s.heroBody}>
          <span className={s.kicker}>과제 현황 · 공수 입력 · 측정 결과</span>
          <h1 className={s.title}>
            AI 활용
            <br />
            생산성 향상 PoC
          </h1>
          <p className={s.lead}>
            AI 를 활용했을 때 개발 생산성이 얼마나 향상되는지 측정하기 위한 PoC 입니다. 선정된 요구사항의 기준 공수와
            실제 공수를 SDLC 단계별로 비교합니다.
          </p>
          <ol className={s.steps}>
            {STEPS.map(([t, d], i) => (
              <li key={t} className={s.stepItem}>
                <span className={s.stepNo}>{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <b>{t}</b>
                  <span className={s.stepDesc}>{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <span className={s.heroFoot}>업무용 시스템 · 인가된 사용자만 접근할 수 있습니다</span>
      </section>

      <section className={s.formSide}>
        <form className={s.form} onSubmit={submit}>
          <div className={s.formHead}>
            <span className="eyebrow">Sign in</span>
            <h2 className={s.formTitle}>로그인</h2>
            <p className="muted">발급받은 계정으로 로그인해 주세요.</p>
          </div>
          {error && <Callout tone="danger">{error}</Callout>}
          <Field label="아이디" htmlFor="uid">
            <TextInput id="uid" autoComplete="username" value={userId} onChange={(e) => setUserId(e.target.value)} autoFocus />
          </Field>
          <Field label="비밀번호" htmlFor="pwd">
            <TextInput
              id="pwd"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" loading={busy} disabled={!userId || !password} className={s.submit}>
            로그인
          </Button>
        </form>

        {demo?.demo && (
          <div className={s.demo}>
            <div className={s.demoHead}>
              <span className="eyebrow">Local demo</span>
              <span className="subtle">DB 미연결 상태 — 클릭하면 입력됩니다</span>
            </div>
            <div className={s.demoGrid}>
              {demo.accounts.map((a) => (
                <button
                  key={a.userId}
                  type="button"
                  className={s.demoItem}
                  onClick={() => (setUserId(a.userId), setPassword(a.password))}
                >
                  <b>{a.userId}</b>
                  <span>
                    {a.userNm} · {a.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
