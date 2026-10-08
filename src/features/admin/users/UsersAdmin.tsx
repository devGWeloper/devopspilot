"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Callout, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { useApi } from "@/lib/hooks";
import { fmtRelative, ORG_LABEL } from "@/lib/labels";
import { ROLES, type OrgCd, type PublicUser, type Role } from "@/lib/types";

const ROLE_DESC: Record<Role, string> = {
  AX_ADMIN: "전체 관리 · 지표 설정 · 적합도 확정 · 선정",
  HX_REVIEWER: "전체 열람 · 하이닉스 의견/동의",
  PM: "본인 과제 등록·입력·제출",
  DEVELOPER: "담당 기능 공수 입력",
  TESTER: "결함 등록",
  VIEWER: "열람만",
};

interface Form {
  userId: string;
  userNm: string;
  orgCd: OrgCd;
  deptNm: string;
  role: Role;
  password: string;
}

const EMPTY: Form = { userId: "", userNm: "", orgCd: "SKAX", deptNm: "", role: "PM", password: "" };

export function UsersAdmin() {
  const { toast, toastError } = useToast();
  const { data, error, reload } = useApi<PublicUser[]>("/api/admin/users");
  const [edit, setEdit] = useState<{ mode: "new" | "edit"; form: Form; useYn: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ userId: string; password: string } | null>(null);

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      if (edit.mode === "new") {
        await api("/api/admin/users", { body: edit.form });
        toast(`계정 ${edit.form.userId} 을(를) 만들었습니다.`);
      } else {
        const { userNm, orgCd, deptNm, role } = edit.form;
        await api(`/api/admin/users/${edit.form.userId}`, { method: "PUT", body: { userNm, orgCd, deptNm, role, useYn: edit.useYn } });
        toast("계정을 수정했습니다.");
      }
      setEdit(null);
      await reload();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset(userId: string) {
    try {
      const r = await api<{ password: string }>(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      setIssued({ userId, password: r.password });
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  const columns: Column<PublicUser>[] = [
    { key: "id", header: "ID", width: 110, render: (u) => <b>{u.userId}</b>, sortValue: (u) => u.userId },
    { key: "nm", header: "이름", render: (u) => u.userNm, sortValue: (u) => u.userNm },
    { key: "org", header: "소속", width: 150, render: (u) => `${ORG_LABEL[u.orgCd]}${u.deptNm ? ` · ${u.deptNm}` : ""}`, sortValue: (u) => u.orgCd },
    {
      key: "role",
      header: "역할",
      width: 120,
      render: (u) => <Chip tone={u.role === "AX_ADMIN" ? "accent" : u.role === "HX_REVIEWER" ? "danger" : "outline"}>{ROLE_LABEL[u.role]}</Chip>,
      sortValue: (u) => ROLES.indexOf(u.role),
    },
    { key: "use", header: "상태", width: 80, render: (u) => (u.useYn ? <Chip tone="ok">사용</Chip> : <Chip>중지</Chip>), sortValue: (u) => (u.useYn ? 0 : 1) },
    { key: "login", header: "최근 로그인", width: 110, render: (u) => <span className="subtle">{u.lastLoginAt ? fmtRelative(u.lastLoginAt) : "없음"}</span>, sortValue: (u) => u.lastLoginAt ?? "" },
    {
      key: "act",
      header: "",
      width: 170,
      align: "right",
      render: (u) => (
        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setEdit({ mode: "edit", form: { ...EMPTY, ...u, password: "" }, useYn: u.useYn })}>
            수정
          </Button>
          <Button size="sm" variant="ghost" onClick={() => reset(u.userId)}>
            비밀번호 초기화
          </Button>
        </div>
      ),
    },
  ];

  const f = edit?.form;
  const setF = (patch: Partial<Form>) => edit && setEdit({ ...edit, form: { ...edit.form, ...patch } });

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="계정"
        description="포털 사용자와 역할을 관리합니다. 역할 변경과 사용 중지는 즉시 반영됩니다."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setEdit({ mode: "new", form: EMPTY, useYn: true })}>
            계정 추가
          </Button>
        }
      />
      {error && <Callout tone="danger">{error}</Callout>}
      <Panel flush>{data ? <DataTable columns={columns} rows={data} rowKey={(u) => u.userId} initialSort={{ key: "role", dir: "asc" }} /> : <Skeleton h={300} />}</Panel>

      <Modal
        open={!!edit}
        title={edit?.mode === "new" ? "계정 추가" : `계정 수정 — ${f?.userId}`}
        onClose={() => setEdit(null)}
        footer={
          <>
            <Button onClick={() => setEdit(null)}>취소</Button>
            <Button variant="primary" loading={busy} onClick={save}>
              저장
            </Button>
          </>
        }
      >
        {f && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="ID" required hint={edit?.mode === "new" ? "사번 권장 · 영문·숫자" : undefined}>
              <TextInput value={f.userId} disabled={edit?.mode === "edit"} onChange={(e) => setF({ userId: e.target.value.trim() })} />
            </Field>
            <Field label="이름" required>
              <TextInput value={f.userNm} onChange={(e) => setF({ userNm: e.target.value })} />
            </Field>
            <Field label="소속" required>
              <Select value={f.orgCd} onChange={(e) => setF({ orgCd: e.target.value as OrgCd })}>
                <option value="SKAX">SK AX</option>
                <option value="SKHYNIX">SK hynix</option>
              </Select>
            </Field>
            <Field label="부서">
              <TextInput value={f.deptNm} onChange={(e) => setF({ deptNm: e.target.value })} />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="역할" required hint={ROLE_DESC[f.role]}>
                <Select value={f.role} onChange={(e) => setF({ role: e.target.value as Role })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {edit?.mode === "new" ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="초기 비밀번호" required hint="8자 이상. 사용자에게 전달 후 '내 정보'에서 바꾸도록 안내하세요.">
                  <TextInput type="text" autoComplete="off" value={f.password} onChange={(e) => setF({ password: e.target.value })} />
                </Field>
              </div>
            ) : (
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="사용 여부">
                  <Select value={edit?.useYn ? "Y" : "N"} onChange={(e) => edit && setEdit({ ...edit, useYn: e.target.value === "Y" })}>
                    <option value="Y">사용</option>
                    <option value="N">중지 (로그인 차단)</option>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!issued} title="임시 비밀번호" eyebrow={issued?.userId} onClose={() => setIssued(null)} footer={<Button variant="primary" onClick={() => setIssued(null)}>확인</Button>}>
        <p className="muted" style={{ marginBottom: 12 }}>
          이 창을 닫으면 다시 볼 수 없습니다. 사용자에게 안전하게 전달해 주세요.
        </p>
        <code style={{ display: "block", fontSize: 20, fontWeight: 700, padding: "12px 16px", background: "var(--bg-deep)", borderRadius: 8, letterSpacing: "0.04em" }}>
          {issued?.password}
        </code>
      </Modal>
    </>
  );
}
