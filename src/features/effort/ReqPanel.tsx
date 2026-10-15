"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import { ACT_LABEL, type ActType } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import type { CellVM, DayRowVM, EffortReqVM, OwnerVM } from "@/lib/views";
import { StatusText } from "../common/bits";
import b from "../common/board.module.css";
import { useMutate } from "../common/useMutate";
import { AddTimeDialog, type AddTarget } from "./AddTimeDialog";
import s from "./effort.module.css";

const ST_NAME = { DONE: "완료", ING: "진행 중", WAIT: "대기" } as const;

function tip(date: string, cd: StageCd, c: CellVM) {
  const lines = [`${fmtDay(date)} · ${STAGE_LABEL[cd]}`, `AI 수집 ${f1(c.ai)}h${c.mn ? ` − 감소 ${f1(c.mn)}h` : ""} = AI 도구 내 ${f1(c.inT)}h`];
  if (c.out)
    lines.push(
      `AI 도구 외 ${f1(c.out)}h · ${Object.entries(c.add)
        .map(([k, h]) => `${k} ${ACT_LABEL[k as ActType]} ${f1(h ?? 0)}`)
        .join(", ")}`,
    );
  if (c.memo) lines.push(`메모: ${c.memo}`);
  return lines.join("\n");
}

export function ReqPanel({
  r,
  me,
  today,
  onClose,
}: {
  r: EffortReqVM;
  me: { userId: string; role: string };
  today: string;
  onClose?: () => void;
}) {
  const { toast } = useToast();
  const dev = me.role === "DEVELOPER";
  const myStages = r.stages.filter((x) => x.ownerId === me.userId);
  const codes = dev && !r.done ? myStages.map((x) => `${r.reqId}-${x.cd}`) : [];

  function copy(t: string) {
    navigator.clipboard?.writeText(t).then(
      () => toast(`'${t}' 복사됨 — 브랜치명이나 AI 도구 대화 첫 줄에 넣으세요`),
      () => toast(`복사: ${t}`),
    );
  }

  return (
    <article className={s.panel}>
      <div className={s.rqh}>
        <div>
          <div className={b.xs}>
            {r.prjNm} <span className={b.pill}>{r.kind}</span> · {r.sysNm} · {r.teamNm}
          </div>
          <h3>
            {r.name} <span className={b.mono} style={{ color: "var(--muted)", fontWeight: 400 }}>{r.reqId}</span>
          </h3>
        </div>
        <div className={s.rqs}>
          <StatusText s={r.status} />
          <span>
            투입 <b className="num">{f1(r.md)}</b> / 기준 <b className="num">{f1(r.baseMd)}</b> M/D
          </span>
          <span>
            AI 도구 내 <b className="num">{f1(r.inT)}h</b> · 외 <b className="num">{f1(r.out)}h</b>
          </span>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              닫기
            </Button>
          )}
        </div>
      </div>

      <div className={s.strip}>
        {STAGES.map((cd) => {
          const st = r.stages.find((x) => x.cd === cd);
          if (!st)
            return (
              <div key={cd} className={`${s.sbox} ${s.sboxOff}`}>
                <b>{STAGE_LABEL[cd]}</b>
                <span>측정 대상 아님</span>
              </div>
            );
          const ratio = st.baseMd > 0 ? st.md / st.baseMd : 0;
          return (
            <div key={cd} className={`${s.sbox} ${dev && st.ownerId === me.userId ? s.sboxMine : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{STAGE_LABEL[cd]}</b>
                <span className={b.xs}>{ST_NAME[st.status]}</span>
              </div>
              <span className={s.wt} title={st.workType}>
                {st.workType}
              </span>
              <span className={b.xs}>{st.ownerNm}</span>
              <span className="num">
                {f1(st.md)} / {f1(st.baseMd)} M/D
              </span>
              <div className={b.hbar}>
                <i className={ratio > 1 ? b.over : ""} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {codes.length > 0 && (
        <div className={s.cmds}>
          <span className="muted">AI 시간 자동 배정 코드 — 브랜치명 또는 대화 첫 줄에</span>
          {codes.map((c) => (
            <span key={c} className={s.cmd}>
              {c}
              <button onClick={() => copy(c)}>복사</button>
            </span>
          ))}
        </div>
      )}

      {r.owners.length === 0 && <p className="muted">담당자가 지정된 단계가 없습니다.</p>}
      {r.owners.map((o) => (
        <EffortTable key={o.userId} r={r} o={o} editable={dev && o.userId === me.userId && !r.done} showOwner={!dev && r.owners.length > 1} today={today} />
      ))}
    </article>
  );
}

function EffortTable({ r, o, editable, showOwner, today }: { r: EffortReqVM; o: OwnerVM; editable: boolean; showOwner: boolean; today: string }) {
  const { run, busy } = useMutate();
  const [histOpen, setHistOpen] = useState(false);
  const [add, setAdd] = useState<AddTarget | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraDate, setExtraDate] = useState(today);
  const [reopenDate, setReopenDate] = useState<string | null>(null);

  // 오늘 줄은 기록이 없어도 보여 준다 — AI 없이 한 일을 바로 넣을 수 있게.
  const rows: DayRowVM[] = [...o.rows];
  if (editable && !rows.some((x) => x.date === today)) rows.unshift({ date: today, st: "need", revCount: 0, changed: false, cells: {}, tot: 0 });
  const act = rows.filter((x) => x.st !== "conf");
  const hist = rows.filter((x) => x.st === "conf");
  const needN = act.filter((x) => x.tot > 0 || x.date !== today).length;
  const confirm = (dates?: string[]) => run(() => api("/api/effort/confirm", { body: { reqId: r.reqId, dates } }), dates ? `${dates.map(fmtDay).join(", ")} 확정했습니다.` : "확정 필요한 날을 모두 확정했습니다.");

  function saveInT(cd: StageCd, date: string, c: CellVM, raw: string) {
    const v = Math.round((parseFloat(raw) || 0) * 10) / 10;
    if (Math.abs(v - Math.round(c.inT * 10) / 10) < 0.05) return;
    void run(() => api("/api/effort/entry", { body: { unit: `${r.reqId}-${cd}`, date, inT: v } }));
  }

  const head = (
    <tr>
      <th style={{ textAlign: "left" }}>일자</th>
      {STAGES.map((cd) => {
        const st = r.stages.find((x) => x.cd === cd);
        const mine = o.stages.includes(cd);
        return (
          <th key={cd} className={mine ? "" : s.na}>
            {STAGE_LABEL[cd]}
            <small>{st ? (mine ? st.workType : `${st.ownerNm} 담당`) : "—"}</small>
          </th>
        );
      })}
      <th className={s.r}>합계 (h)</th>
      <th>확정</th>
    </tr>
  );

  const line = (x: DayRowVM) => {
    const edit = editable && x.st !== "conf";
    const isToday = x.date === today;
    return (
      <tr key={x.date} className={x.st !== "conf" && !isToday ? s.rowNeed : isToday ? s.rowToday : ""}>
        <td className={s.dcol}>
          <b>{fmtDay(x.date)}</b> {isToday && <span className={b.xs}>오늘</span>}
          {x.st === "need" && !isToday && <small className={b.warn} style={{ display: "block" }}>확정 필요</small>}
          {x.st === "edit" && (
            <small className={b.warn} style={{ display: "block" }}>
              {x.changed ? "확정 후 값 변경 · 재확정 필요" : "수정 중 · 재확정 필요"}
            </small>
          )}
        </td>
        {STAGES.map((cd) => {
          if (!o.stages.includes(cd))
            return (
              <td key={cd} className={s.na}>
                ·
              </td>
            );
          const c = x.cells[cd] ?? { ai: 0, mn: 0, inT: 0, out: 0, tot: 0, add: {}, memo: "" };
          const title = tip(x.date, cd, c);
          if (!edit)
            return (
              <td key={cd} title={title}>
                <span className={s.tv} style={c.tot ? undefined : { color: "var(--subtle)" }}>
                  {f1(c.tot)}
                </span>
                <span className={s.meta}>{c.tot ? `AI ${f1(c.inT)}${c.out ? ` + ${f1(c.out)}` : ""}` : " "}</span>
              </td>
            );
          return (
            <td key={cd}>
              <div className={s.ecell}>
                {c.ai > 0 ? (
                  <label className={s.ain} title="AI 도구 내 시간 — 수집값보다 크게 넣을 수 없습니다(자리 비움 등은 줄여서 반영)">
                    AI
                    <input
                      key={`${x.date}-${cd}-${c.inT}`}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max={c.ai}
                      defaultValue={f1(c.inT)}
                      onBlur={(e) => saveInT(cd, x.date, c, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      aria-label={`${fmtDay(x.date)} ${STAGE_LABEL[cd]} AI 도구 내 시간`}
                    />
                  </label>
                ) : (
                  <span className={s.pend}>AI 0</span>
                )}
                <button
                  className={`${s.addb} ${c.out ? s.addbOn : ""}`}
                  title="AI 도구 외 시간 (작업 유형 8개)"
                  onClick={() => setAdd({ unit: `${r.reqId}-${cd}`, date: x.date, title: `${r.name} · ${STAGE_LABEL[cd]}`, cell: c })}
                >
                  ＋{c.out ? f1(c.out) : " 외"}
                </button>
              </div>
              <span className={s.meta} title={title}>
                {c.ai > 0 ? `수집 ${f1(c.ai)}${c.mn ? ` −${f1(c.mn)}` : ""}` : " "}
                {c.out > 0 && c.ai > 0 ? ` · 계 ${f1(c.tot)}` : ""}
              </span>
            </td>
          );
        })}
        <td className={s.r}>
          <b>{f1(x.tot)}</b>
        </td>
        <td>
          {x.st === "conf" ? (
            <span className={b.small}>
              ✓ 확정{x.revCount > 0 && <span className={b.xs}> · 수정 {x.revCount}회</span>}{" "}
              {editable && (
                <button className={b.lnk} onClick={() => setReopenDate(x.date)}>
                  수정
                </button>
              )}
            </span>
          ) : edit ? (
            isToday && x.tot === 0 ? (
              <span className={b.xs}>입력 후 확정</span>
            ) : (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => confirm([x.date])}>
                {x.st === "edit" ? "재확정" : "확정"}
              </Button>
            )
          ) : (
            <span className={b.warn} style={{ fontSize: 12 }}>
              {x.st === "edit" ? "재확정 필요" : "확정 필요"}
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div>
      {showOwner && (
        <div className={b.small} style={{ marginBottom: 4 }}>
          <b>{o.userNm}</b> 담당 단계 {o.need > 0 && <span className={b.pillWarn}>확정 필요 {o.need}일</span>}
        </div>
      )}
      <div className={b.tw}>
        <table className={s.et}>
          <thead>{head}</thead>
          <tbody>
            <tr className={s.sumr}>
              <td className={s.dcol}>
                확정 합계 <span className={b.xs}>{hist.length}일</span>
              </td>
              {STAGES.map((cd) => (
                <td key={cd} className={o.stages.includes(cd) ? s.r : s.na}>
                  {o.stages.includes(cd) ? f1(o.conf.byStage[cd] ?? 0) : ""}
                </td>
              ))}
              <td className={s.r}>
                {f1(o.conf.tot)}
                <span className={s.meta}>{f1(o.conf.md)} M/D</span>
              </td>
              <td />
            </tr>
            {act.length ? (
              act.map(line)
            ) : (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: "left" }}>
                  확정할 날이 없습니다.
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={9} style={{ textAlign: "left" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button className={b.lnk} onClick={() => setHistOpen((v) => !v)} aria-expanded={histOpen}>
                    {histOpen ? "▾" : "▸"} 일별 확정 이력 ({hist.length}일)
                  </button>
                  {editable && (
                    <Button size="sm" variant="ghost" onClick={() => setExtraOpen(true)}>
                      ＋ 기록 없는 날 추가
                    </Button>
                  )}
                  {editable && needN > 1 && (
                    <Button size="sm" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => confirm()}>
                      확정 필요 {needN}일 모두 확정
                    </Button>
                  )}
                </div>
              </td>
            </tr>
            {histOpen && hist.map((x) => <Fragment key={x.date}>{line(x)}</Fragment>)}
          </tbody>
        </table>
      </div>

      {add && <AddTimeDialog t={add} onClose={() => setAdd(null)} />}

      <Modal
        open={!!reopenDate}
        title={reopenDate ? `${fmtDay(reopenDate)} 확정 수정` : ""}
        onClose={() => setReopenDate(null)}
        footer={
          <>
            <Button onClick={() => setReopenDate(null)}>취소</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                const d = reopenDate!;
                const ok = await run(() => api("/api/effort/day", { body: { reqId: r.reqId, date: d, action: "reopen" } }), `${fmtDay(d)}을 고칠 수 있습니다. 고친 뒤 재확정하세요.`);
                if (ok) setReopenDate(null);
              }}
            >
              수정하기
            </Button>
          </>
        }
      >
        <p>
          {r.name} · 확정을 풀고 값을 고친 뒤 다시 확정합니다. 수정 전 값과 횟수가 이력으로 남고, <b>다시 확정하기 전까지 그날은 측정 결과에서 빠집니다.</b>
        </p>
      </Modal>

      <Modal
        open={extraOpen}
        title="기록 없는 날 추가"
        onClose={() => setExtraOpen(false)}
        footer={
          <>
            <Button onClick={() => setExtraOpen(false)}>취소</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                const ok = await run(() => api("/api/effort/day", { body: { reqId: r.reqId, date: extraDate, action: "extra" } }), `${fmtDay(extraDate)} 줄을 추가했습니다. ＋로 시간을 넣고 확정하세요.`);
                if (ok) setExtraOpen(false);
              }}
            >
              추가
            </Button>
          </>
        }
      >
        <p style={{ marginBottom: 12 }}>AI 도구를 쓰지 않고 {r.name} 작업을 한 날을 고르면 입력 줄이 생깁니다.</p>
        <input type="date" className={b.sel} max={today} value={extraDate} onChange={(e) => setExtraDate(e.target.value)} />
      </Modal>
    </div>
  );
}
