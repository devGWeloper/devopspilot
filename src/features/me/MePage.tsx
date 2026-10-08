"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { ORG_LABEL } from "@/lib/labels";

export function MePage() {
  const { me } = useAuth();
  const { toast, toastError } = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;

  async function change() {
    setBusy(true);
    try {
      await api("/api/auth/password", { body: { current: cur, next } });
      toast("비밀번호를 변경했습니다.");
      setCur("");
      setNext("");
      setConfirm("");
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader eyebrow="My account" title="내 정보" />
      <div style={{ display: "grid", gap: 16 }}>
        <Panel eyebrow="Profile" title="계정">
          {me && (
            <dl style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10, margin: 0 }}>
              <dt className="muted">ID</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{me.userId}</dd>
              <dt className="muted">이름</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{me.userNm}</dd>
              <dt className="muted">소속</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>
                {ORG_LABEL[me.orgCd]}
                {me.deptNm ? ` · ${me.deptNm}` : ""}
              </dd>
              <dt className="muted">역할</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{ROLE_LABEL[me.role]}</dd>
            </dl>
          )}
        </Panel>
        <Panel eyebrow="Security" title="비밀번호 변경">
          <form
            style={{ display: "grid", gap: 14, maxWidth: 360 }}
            onSubmit={(e) => {
              e.preventDefault();
              void change();
            }}
          >
            <Field label="현재 비밀번호">
              <TextInput type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            </Field>
            <Field label="새 비밀번호" hint="8자 이상">
              <TextInput type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="새 비밀번호 확인" error={mismatch ? "새 비밀번호와 다릅니다." : null}>
              <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={mismatch} />
            </Field>
            <div>
              <Button type="submit" variant="primary" loading={busy} disabled={!cur || next.length < 8 || next !== confirm}>
                변경
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
