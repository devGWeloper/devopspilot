"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Callout } from "@/components/ui/Panel";
import { api, resetSessionExpired } from "@/lib/apiClient";
import s from "./login.module.css";

interface Demo {
  demo: boolean;
  accounts: { userId: string; userNm: string; role: string; password: string }[];
}

const STEPS = [
  ["후보 접수", "과제 PM 이 기본정보·기존 실적·지표를 입력"],
  ["적합도 평가", "Major/Minor 지표 프로필로 상·중·하 판정"],
  ["공동 합의", "SK AX·SK hynix 의견과 동의 기록"],
  ["선정·측정", "균형 잡힌 포트폴리오 확정 후 Replay 측정"],
];

function LoginForm() {
  const router = useRouter();
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
      resetSessionExpired();
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : r.home);
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
          <span className={s.kicker}>Replay Productivity Validation</span>
          <h1 className={s.title}>
            AI Tool PoC
            <br />
            과제 선정 포털
          </h1>
          <p className={s.lead}>
            완료된 프로젝트를 AI Tool 로 다시 수행해 생산성 효과를 검증합니다. 과제 유형이 고르게 섞인 포트폴리오를 양사가 함께
            선정하고, 측정까지 한 곳에서 관리합니다.
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
