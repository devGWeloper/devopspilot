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
          <span className={s.kicker}>과제 선정 · Replay 측정 포털</span>
          <h1 className={s.title}>
            AI 활용
            <br />
            생산성 향상 PoC
          </h1>
          <p className={s.lead}>
            AI 를 활용했을 때 개발 생산성이 얼마나 향상되는지 측정하기 위한 PoC 입니다. 이미 완료된 과제를 AI 로 다시 개발해
            기존 실적과 비교하며, 과제 선정부터 측정까지 양사가 한 곳에서 함께 관리합니다.
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
