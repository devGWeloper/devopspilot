"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Callout, EmptyState, Panel } from "@/components/ui/Panel";
import { api } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import type { DaySt } from "@/lib/measure/metrics";
import { ACT_LABEL, type ActType } from "@/lib/measure/types";
import { STAGE_LABEL } from "@/lib/types";
import type { DayLineVM, EffortDayVM, PendingVM } from "@/lib/views";
import { useMutate } from "../common/useMutate";
import { AddTimeDialog, type AddTarget } from "./AddTimeDialog";
import s from "./effort.module.css";
import { UploadDialog } from "./UploadDialog";

const ST_TEXT: Record<DaySt, string> = { none: "입력 없음", need: "확정 필요", edit: "재확정 필요", conf: "확정됨" };

export function EffortDay({ vm, editable }: { vm: EffortDayVM; editable: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [nav, start] = useTransition();
  const { run, busy } = useMutate();
  const [add, setAdd] = useState<AddTarget | null>(null);
  const [upload, setUpload] = useState(false);

  const canEdit = editable && vm.st !== "conf";
  const go = (patch: { d?: string; u?: string }) => {
    const q = new URLSearchParams();
    const u = patch.u ?? (editable ? "" : vm.userId);
    if (u) q.set("u", u);
    if (patch.d) q.set("d", patch.d);
    start(() => router.push(`${path}?${q}`, { scroll: false }));
  };

  const confirm = () => run(() => api("/api/effort/date", { body: { date: vm.date, action: "confirm" } }), `${fmtDay(vm.date)} 공수를 확정했습니다.`);
  const reopen = () => run(() => api("/api/effort/date", { body: { date: vm.date, action: "reopen" } }), "확정을 풀었습니다. 고친 뒤 다시 확정해 주세요.");

  const needDays = vm.days.filter((d) => d.st === "need" || d.st === "edit").length;

  return (
    <>
      <PageHeader
        eyebrow="Phase 2"
        title="공수 입력"
        description="날짜를 고르고, 자동으로 들어온 AI 사용 시간을 확인한 뒤 AI 없이 한 일을 더해 확정합니다. 확정한 날만 측정 결과에 들어갑니다."
        actions={
          editable ? (
            <Button icon="upload" onClick={() => setUpload(true)}>
              AI 사용 기록 올리기
            </Button>
          ) : (
            <Select value={vm.userId} onChange={(e) => go({ u: e.target.value })} aria-label="개발자" style={{ minWidth: 180 }}>
              {vm.devs.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.userNm} ({d.userId})
                </option>
              ))}
            </Select>
          )
        }
      >
        {(needDays > 0 || vm.pendingAll > 0) && (
          <Callout tone="warn">
            {editable ? "할 일" : `${vm.userNm} 님`}: {needDays > 0 && <b>확정이 필요한 날 {needDays}일</b>}
            {needDays > 0 && vm.pendingAll > 0 && " · "}
            {vm.pendingAll > 0 && <b>어느 일인지 정해야 하는 AI 사용 {vm.pendingAll}건</b>}
            {" — 왼쪽 날짜 목록에서 주황색 날을 눌러 처리하세요."}
          </Callout>
        )}
      </PageHeader>

      <div className={s.layout} style={{ opacity: nav ? 0.6 : 1 }}>
        <Panel flush title="날짜">
          <div className={s.days}>
            {vm.days.map((d) => {
              const warn = d.st === "need" || d.st === "edit" || d.pending > 0;
              return (
                <button key={d.date} className={`${s.day} ${d.date === vm.date ? s.dayOn : ""}`} onClick={() => go({ d: d.date })}>
                  <span className={s.dayDate}>
                    {fmtDay(d.date)} {d.date === vm.today && <span className="subtle">오늘</span>}
                  </span>
                  <span className={s.dayHours}>{d.hours ? `${f1(d.hours)}h` : ""}</span>
                  <span className={`${s.daySt} ${warn ? s.warn : ""}`}>
                    {d.pending > 0 ? `확인 필요 ${d.pending}건` : d.st === "conf" ? "✓ 확정됨" : d.st === "none" ? "—" : ST_TEXT[d.st]}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Panel
            title={
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {fmtDay(vm.date)}
                <Chip tone={vm.st === "conf" ? "ok" : vm.st === "none" ? "neutral" : "warn"}>{ST_TEXT[vm.st]}</Chip>
              </span>
            }
            actions={
              editable &&
              (vm.st === "conf" ? (
                <Button onClick={reopen} loading={busy}>
                  수정하기
                </Button>
              ) : (
                <Button variant="primary" icon="check" onClick={confirm} loading={busy} disabled={vm.total === 0 || vm.pending.length > 0} title={vm.pending.length ? "확인 필요한 AI 사용을 먼저 처리해 주세요" : undefined}>
                  이 날 확정
                </Button>
              ))
            }
            flush
          >
            {vm.pending.length > 0 && (
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                <Callout tone="warn">
                  <b>어느 일인지 정해지지 않은 AI 사용 {vm.pending.length}건</b> — 브랜치·대화에 요구사항 코드가 없거나 여러 개였습니다. {editable ? "골라 주세요." : "개발자가 고릅니다."}
                  <div className={s.pend}>
                    {vm.pending.map((p) => (
                      <PendingRow key={p.datId} p={p} editable={editable} />
                    ))}
                  </div>
                </Callout>
              </div>
            )}

            {vm.lines.length === 0 ? (
              <EmptyState title="담당한 단계가 없습니다">과제 현황에서 관리자가 요구사항 단계의 담당자로 지정하면 여기에 나타납니다.</EmptyState>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>요구사항 · 단계</th>
                    <th className={s.r}>AI 사용 (자동)</th>
                    <th>AI 없이 한 일 (직접 입력)</th>
                    <th className={s.r}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {vm.lines.map((l) => (
                    <Line key={l.unit} l={l} date={vm.date} canEdit={canEdit && !l.done} onAdd={() => setAdd({ unit: l.unit, date: vm.date, title: `${l.reqName} · ${STAGE_LABEL[l.stage]}`, cell: l.cell })} />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>이 날 합계</td>
                    <td className={s.r}>{f1(vm.total)}h</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Panel>

          <p className="subtle" style={{ fontSize: 12 }}>
            AI 사용 시간은 텔레메트리나 업로드로 자동으로 들어옵니다. 작업 브랜치명이나 AI 대화 첫 줄에 단계 코드(예: REQ-0047-DV, 위 표의 회색 코드)를 넣으면 그 단계로 자동 배정됩니다.
            자리를 비운 시간 등은 &apos;줄이기&apos;로 빼고, 수집되지 않은 AI 사용은 &apos;AI 없이 한 일&apos;의 A7 로 넣어 주세요.
          </p>
        </div>
      </div>

      {add && <AddTimeDialog t={add} onClose={() => setAdd(null)} />}
      {upload && <UploadDialog onClose={() => setUpload(false)} />}
    </>
  );
}

function Line({ l, date, canEdit, onAdd }: { l: DayLineVM; date: string; canEdit: boolean; onAdd: () => void }) {
  const { run, busy } = useMutate();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(f1(l.cell.inT));
  const c = l.cell;
  const types = Object.entries(c.add).filter(([, h]) => (h ?? 0) > 0);

  async function saveAi() {
    const ok = await run(() => api("/api/effort/entry", { body: { unit: l.unit, date, inT: Number(v) } }));
    if (ok) setEdit(false);
  }

  return (
    <tr>
      <td>
        <b>{l.reqName}</b>
        <div className={s.sub}>
          {l.prjNm} · {STAGE_LABEL[l.stage]}
          {l.workType ? ` (${l.workType})` : ""} · <span className={s.code}>{l.unit}</span>
          {l.done && " · 측정 완료"}
        </div>
      </td>
      <td className={s.r}>
        {edit ? (
          <span className={s.aiEdit} style={{ justifyContent: "flex-end" }}>
            <input type="number" step="0.1" min="0" max={c.ai} value={v} autoFocus onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveAi()} aria-label="AI 사용 시간" />h
            <Button size="sm" variant="primary" loading={busy} onClick={saveAi}>
              저장
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
              취소
            </Button>
          </span>
        ) : (
          <>
            <span className={s.hours}>{c.ai > 0 ? `${f1(c.inT)}h` : "—"}</span>
            {c.mn > 0 && <div className={s.sub}>수집 {f1(c.ai)}h − 줄임 {f1(c.mn)}h</div>}
            {canEdit && c.ai > 0 && (
              <div>
                <button className="subtle" style={{ border: 0, background: "none", fontSize: 12, textDecoration: "underline", padding: 0 }} onClick={() => (setV(f1(c.inT)), setEdit(true))}>
                  줄이기
                </button>
              </div>
            )}
          </>
        )}
      </td>
      <td>
        <button className={`${s.addBtn} ${c.out ? s.addBtnOn : ""}`} disabled={!canEdit} onClick={onAdd}>
          {c.out > 0 ? (
            <>
              <b>{f1(c.out)}h</b>
              <span className={s.sub} style={{ display: "block" }}>
                {types.map(([k, h]) => `${ACT_LABEL[k as ActType]} ${f1(h ?? 0)}`).join(", ")}
              </span>
            </>
          ) : canEdit ? (
            "＋ 시간 입력"
          ) : (
            <span className="subtle">—</span>
          )}
        </button>
      </td>
      <td className={s.r}>
        <span className={s.hours}>{c.tot > 0 ? `${f1(c.tot)}h` : "—"}</span>
      </td>
    </tr>
  );
}

function PendingRow({ p, editable }: { p: PendingVM; editable: boolean }) {
  const { run, busy } = useMutate();
  const assign = (code: string) => run(() => api("/api/effort/sessions", { body: { datId: p.datId, parts: [{ unit: code, min: p.minutes }] } }), "배정했습니다.");
  const off = () => run(() => api("/api/effort/sessions", { body: { datId: p.datId, off: true } }), "업무 외 사용으로 표시했습니다.");
  return (
    <div className={s.pendRow}>
      <span style={{ minWidth: 220 }}>
        <b>
          {p.start}
          {p.end ? `~${p.end}` : ""} · {f1(p.minutes / 60)}h
        </b>{" "}
        <span className="subtle">
          {p.tool}
          {p.branch ? ` · ${p.branch}` : ""}
        </span>
      </span>
      {editable ? (
        <>
          <Select value="" disabled={busy} onChange={(e) => e.target.value && assign(e.target.value)} aria-label="요구사항 단계 선택">
            <option value="">어느 일이었나요?</option>
            {p.options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.cand ? "추천 · " : ""}
                {o.label}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="ghost" disabled={busy} onClick={off}>
            업무 외 사용
          </Button>
        </>
      ) : (
        <span className="subtle">{p.why}</span>
      )}
    </div>
  );
}
