"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Callout, EmptyState, Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import { ACT_LABEL, type ActType } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES } from "@/lib/types";
import type { EffortCellVM, EffortReqVM, EffortRowVM, EffortVM, PendingVM } from "@/lib/views";
import { Progress, STATUS_LABEL } from "../common/bits";
import { useMutate } from "../common/useMutate";
import { AddTimeDialog, type AddTarget } from "./AddTimeDialog";
import s from "./effort.module.css";
import { UploadDialog } from "./UploadDialog";

type Filter = "NEED" | "OPEN" | "ALL";

export function EffortBoard({ vm, editable }: { vm: EffortVM; editable: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [nav, start] = useTransition();
  const [upload, setUpload] = useState(false);
  const [add, setAdd] = useState<AddTarget | null>(null);
  const [prj, setPrj] = useState("");
  const [f, setF] = useState<Filter>("OPEN");

  const needAll = vm.reqs.reduce((a, r) => a + r.need, 0);
  const prjs = Array.from(new Map(vm.reqs.map((r) => [r.prjId, r.prjNm])));
  const list = vm.reqs.filter((r) => (!prj || r.prjId === prj) && (f === "ALL" || (f === "NEED" ? r.need > 0 : r.status !== "DONE" || r.need > 0)));
  // 처음엔 확정이 밀린 요구사항을 연다 — 할 일부터 보이게.
  const first = vm.reqs.find((r) => r.need > 0) ?? list[0] ?? vm.reqs[0];
  const [sel, setSel] = useState<string[]>(first ? [first.rk] : []);
  const shown = useMemo(() => vm.reqs.filter((r) => sel.includes(r.rk)), [vm.reqs, sel]);
  const toggle = (rk: string, multi: boolean) =>
    setSel((x) => (multi ? (x.includes(rk) ? x.filter((y) => y !== rk) : [...x, rk]) : [rk]));

  return (
    <>
      <PageHeader
        eyebrow="Phase 2"
        title="공수 입력"
        description="요구사항을 고르면 일자 × SDLC 단계(분석·설계·개발·테스트) 표가 나옵니다. 자동으로 들어온 AI 사용 시간을 확인하고 AI 없이 한 일을 더해 일자별로 확정합니다. 확정한 날만 측정 결과에 들어갑니다."
        actions={
          editable ? (
            <>
              <Button icon="info" variant="ghost" onClick={() => router.push("/guide")}>
                작성 가이드
              </Button>
              <Button icon="upload" onClick={() => setUpload(true)}>
                AI 사용 기록 올리기
              </Button>
            </>
          ) : (
            <Select
              value={vm.userId}
              onChange={(e) => start(() => router.push(`${path}?u=${encodeURIComponent(e.target.value)}`, { scroll: false }))}
              aria-label="개발자"
              style={{ minWidth: 180 }}
            >
              {vm.devs.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.userNm} ({d.userId})
                </option>
              ))}
            </Select>
          )
        }
      >
        {(needAll > 0 || vm.pending.length > 0) && (
          <Callout tone="warn">
            {editable ? "할 일" : `${vm.userNm} 님`}: {needAll > 0 && <b>확정이 필요한 날 {needAll}건</b>}
            {needAll > 0 && vm.pending.length > 0 && " · "}
            {vm.pending.length > 0 && <b>단계가 정해지지 않은 AI 사용 {vm.pending.length}건</b>}
          </Callout>
        )}
      </PageHeader>

      <div className={s.layout} style={{ opacity: nav ? 0.6 : 1 }}>
        <Panel flush title={editable ? "내 담당 요구사항" : `${vm.userNm} 님 담당 요구사항`}>
          <div className={s.lfilter}>
            {prjs.length > 1 && (
              <Select value={prj} onChange={(e) => setPrj(e.target.value)} aria-label="과제">
                <option value="">전체 과제</option>
                {prjs.map(([id, nm]) => (
                  <option key={id} value={id}>
                    {nm}
                  </option>
                ))}
              </Select>
            )}
            <Segmented<Filter>
              ariaLabel="요구사항 범위"
              value={f}
              onChange={setF}
              options={[
                { key: "NEED", label: "확정 필요" },
                { key: "OPEN", label: "진행 중" },
                { key: "ALL", label: "전체" },
              ]}
            />
          </div>
          <div className={s.reqs}>
            {list.length === 0 && <p className="subtle" style={{ padding: 14, fontSize: 13 }}>조건에 맞는 요구사항이 없습니다.</p>}
            {list.map((r) => (
              <button
                key={r.rk}
                className={`${s.req} ${sel.includes(r.rk) ? s.reqOn : ""}`}
                onClick={(e) => toggle(r.rk, e.ctrlKey || e.metaKey || e.shiftKey)}
                title="Ctrl/Shift + 클릭으로 여러 개 함께 보기"
              >
                <span className={s.reqNm}>{r.name || r.reqId}</span>
                <span className={s.code}>{r.rk}</span>
                <span className={s.reqSt}>
                  {STATUS_LABEL[r.status]}
                  {r.need > 0 && <b className={s.warn}> · 확정 필요 {r.need}일</b>}
                </span>
              </button>
            ))}
          </div>
          <p className="subtle" style={{ padding: "8px 14px", fontSize: 11 }}>
            Ctrl·Shift + 클릭 = 여러 요구사항 함께 보기
          </p>
        </Panel>

        <div className={s.right}>
          {vm.pending.length > 0 && <PendingPanel items={vm.pending} editable={editable} />}
          {vm.reqs.length === 0 ? (
            <Panel>
              <EmptyState title="담당한 요구사항이 없습니다">관리자가 기준 데이터에서 요구사항 단계의 담당자로 지정하면 여기에 나타납니다.</EmptyState>
            </Panel>
          ) : (
            shown.map((r) => <ReqPanel key={r.rk} r={r} vm={vm} editable={editable} onAdd={setAdd} />)
          )}
        </div>
      </div>

      {add && <AddTimeDialog t={add} onClose={() => setAdd(null)} />}
      {upload && <UploadDialog onClose={() => setUpload(false)} />}
    </>
  );
}

function ReqPanel({ r, vm, editable, onAdd }: { r: EffortReqVM; vm: EffortVM; editable: boolean; onAdd: (t: AddTarget) => void }) {
  const { run, busy } = useMutate();
  const { toast } = useToast();
  const [hist, setHist] = useState(false);
  const act = r.rows.filter((x) => x.st !== "conf");
  const conf = r.rows.filter((x) => x.st === "conf");
  const confTot = Object.values(r.confSum).reduce<number>((a, v) => a + (v ?? 0), 0);
  const mine = new Set(r.mine);

  const confirmAll = () => run(() => api("/api/effort/confirm", { body: { reqId: r.rk } }), `${r.rk} 확정 필요 ${act.length}일을 확정했습니다.`);
  const addDay = (date: string) =>
    run(() => api("/api/effort/day", { body: { reqId: r.rk, date, action: "extra" } }), `${fmtDay(date)} 입력 줄을 만들었습니다.`);

  return (
    <Panel
      flush
      title={
        <span className={s.ptitle}>
          {r.name || r.reqId} <span className={s.code}>{r.rk}</span>
          <Chip tone={r.status === "DONE" ? "ok" : "neutral"}>{STATUS_LABEL[r.status]}</Chip>
        </span>
      }
      actions={
        <span className={s.psum}>
          <span>
            투입 <b className="num">{f1(r.md)}</b> / 기준 <b className="num">{f1(r.baseMd)}</b> M/D
          </span>
          <span className="subtle">
            AI 도구 내 {f1(r.inT)}h · 외 {f1(r.out)}h
          </span>
        </span>
      }
    >
      <div className={s.meta2}>
        {r.prjNm}
        {r.sysNm ? ` · ${r.sysNm}` : ""}
        {r.teamNm ? ` · ${r.teamNm}` : ""}
      </div>

      <div className={s.strip}>
        {r.strip.map((b) => (
          <div key={b.cd} className={`${s.sbox} ${b.who === "mine" ? s.sboxMine : ""} ${b.who === "none" ? s.sboxOff : ""}`}>
            <div className={s.sboxH}>
              <b>{STAGE_LABEL[b.cd]}</b>
              <span className="subtle">{b.who === "none" ? "" : b.done ? "완료" : b.status === "ING" ? "진행 중" : "대기"}</span>
            </div>
            {b.who === "none" ? (
              <span className="subtle">측정 대상 아님</span>
            ) : (
              <>
                <span className={s.sboxWt}>{b.workType || "—"}</span>
                <span className="subtle">{b.who === "mine" ? (editable ? "내 담당" : b.ownerNm) : `${b.ownerNm} 담당`}</span>
                <Progress md={b.md} base={b.baseMd} />
              </>
            )}
          </div>
        ))}
      </div>

      {editable && r.codes.length > 0 && (
        <div className={s.cmds}>
          <span className="subtle">AI 세션 첫 줄에 단계 코드 입력</span>
          {r.codes.map((c) => (
            <span key={c} className={s.cmd}>
              poc {c}
              <button
                className={s.copy}
                onClick={() => {
                  copyText(`poc ${c}`);
                  toast(`"poc ${c}" 복사했습니다. AI 대화를 시작할 때 첫 줄에 붙여 넣으세요.`);
                }}
              >
                복사
              </button>
            </span>
          ))}
          <span className="subtle">업무 외 사용은 <span className={s.mono}>poc off</span></span>
        </div>
      )}

      <div className={s.tw}>
        <table className={s.et}>
          <thead>
            <tr>
              <th>일자</th>
              {STAGES.map((cd) => {
                const b = r.strip.find((x) => x.cd === cd)!;
                return (
                  <th key={cd} className={`${s.c} ${mine.has(cd) ? "" : s.na}`}>
                    {STAGE_LABEL[cd]}
                    <small>{b.who === "none" ? "—" : b.who === "mine" ? b.workType || "내 담당" : `${b.ownerNm} 담당`}</small>
                  </th>
                );
              })}
              <th className={s.r}>합계 (h)</th>
              <th className={s.c}>확정</th>
            </tr>
          </thead>
          <tbody>
            <tr className={s.sumr}>
              <td>
                확정 합계<small>{r.confDays}일</small>
              </td>
              {STAGES.map((cd) => (
                <td key={cd} className={`${s.c} num ${mine.has(cd) ? "" : s.na}`}>
                  {mine.has(cd) ? f1(r.confSum[cd] ?? 0) : ""}
                </td>
              ))}
              <td className={`${s.r} num`}>
                {f1(confTot)}
                <small>{f1(confTot / vm.mdHours)} M/D</small>
              </td>
              <td />
            </tr>
            {act.map((x) => (
              <Row key={x.date} r={r} x={x} today={vm.today} editable={editable} onAdd={onAdd} />
            ))}
            {act.length === 0 && (
              <tr>
                <td colSpan={7} className="subtle" style={{ fontSize: 13 }}>
                  확정할 날이 없습니다.
                </td>
              </tr>
            )}
            <tr className={s.hrow}>
              <td colSpan={7}>
                <div className={s.acts}>
                  <button className={s.lnk} onClick={() => setHist((v) => !v)} aria-expanded={hist} disabled={conf.length === 0}>
                    {hist ? "▾" : "▸"} 확정된 날 {conf.length}일
                  </button>
                  {editable && r.status !== "DONE" && (
                    <label className={s.addDay}>
                      ＋ 기록 없는 날 추가
                      <input type="date" max={vm.today} value="" onChange={(e) => e.target.value && addDay(e.target.value)} aria-label="기록 없는 날 추가" />
                    </label>
                  )}
                  {editable && act.length > 1 && (
                    <Button size="sm" style={{ marginLeft: "auto" }} loading={busy} onClick={confirmAll}>
                      확정 필요 {act.length}일 모두 확정
                    </Button>
                  )}
                </div>
              </td>
            </tr>
            {hist && conf.map((x) => <Row key={x.date} r={r} x={x} today={vm.today} editable={editable} onAdd={onAdd} />)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Row({ r, x, today, editable, onAdd }: { r: EffortReqVM; x: EffortRowVM; today: string; editable: boolean; onAdd: (t: AddTarget) => void }) {
  const { run, busy } = useMutate();
  const edit = editable && x.st !== "conf";
  const confirm = () => run(() => api("/api/effort/confirm", { body: { reqId: r.rk, dates: [x.date] } }), `${fmtDay(x.date)} ${r.rk} 확정했습니다.`);
  const reopen = () =>
    run(() => api("/api/effort/day", { body: { reqId: r.rk, date: x.date, action: "reopen" } }), "확정을 풀었습니다. 고친 뒤 다시 확정해 주세요.");
  const ago = daysAgo(x.date, today);

  return (
    <tr className={x.st === "conf" ? s.rowConf : ""}>
      <td className={s.dcol}>
        <b>{fmtDay(x.date)}</b>
        {ago && <span className="subtle"> {ago}</span>}
        {x.st === "need" && <small className={s.warn}>확정 필요</small>}
        {x.st === "edit" && <small className={s.warn}>수정 중 · 다시 확정 필요</small>}
      </td>
      {STAGES.map((cd) => {
        const c = x.cells[cd];
        if (!c) return <td key={cd} className={`${s.c} ${s.na}`}>·</td>;
        return (
          <td key={cd} className={s.c}>
            <Cell c={c} date={x.date} edit={edit && !c.done} title={`${r.name || r.reqId} · ${STAGE_LABEL[cd]}`} onAdd={onAdd} />
          </td>
        );
      })}
      <td className={`${s.r} num`}>
        <b>{f1(x.tot)}</b>
      </td>
      <td className={s.c}>
        {x.st === "conf" ? (
          <>
            <span className={s.ok}>✓ 확정</span>
            {x.revCount > 0 && <span className="subtle"> 수정 {x.revCount}회</span>}
            {editable && r.status !== "DONE" && (
              <button className={s.lnk} onClick={reopen} disabled={busy}>
                수정
              </button>
            )}
          </>
        ) : editable ? (
          <Button size="sm" variant="primary" loading={busy} onClick={confirm}>
            {x.st === "edit" ? "다시 확정" : "확정"}
          </Button>
        ) : (
          <span className={s.warn}>{x.st === "edit" ? "수정 중" : "확정 필요"}</span>
        )}
      </td>
    </tr>
  );
}

function Cell({ c, date, edit, title, onAdd }: { c: EffortCellVM; date: string; edit: boolean; title: string; onAdd: (t: AddTarget) => void }) {
  const { run, busy } = useMutate();
  const [cut, setCut] = useState(false);
  const [v, setV] = useState(f1(c.inT));
  const types = Object.entries(c.add).filter(([, h]) => (h ?? 0) > 0);
  const tip = [
    `AI 수집 ${f1(c.ai)}h${c.mn ? ` − 줄임 ${f1(c.mn)}h` : ""} = AI 도구 내 ${f1(c.inT)}h`,
    c.out ? `AI 도구 외 ${f1(c.out)}h · ${types.map(([k, h]) => `${ACT_LABEL[k as ActType]} ${f1(h ?? 0)}`).join(", ")}` : "",
    c.memo ? `메모: ${c.memo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  async function save() {
    if (await run(() => api("/api/effort/entry", { body: { unit: c.unit, date, inT: Number(v) } }))) setCut(false);
  }

  if (!edit)
    return (
      <span title={tip}>
        <span className={`${s.tv} ${c.tot ? "" : s.z}`}>{f1(c.tot)}</span>
        <span className={s.meta}>{c.tot ? `AI ${f1(c.inT)}${c.out ? ` + 외 ${f1(c.out)}` : ""}` : " "}</span>
      </span>
    );

  if (cut)
    return (
      <span className={s.aiEdit}>
        <input type="number" step="0.1" min="0" max={c.ai} value={v} autoFocus onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} aria-label="AI 도구 내 시간" />
        <Button size="sm" variant="primary" loading={busy} onClick={save}>
          저장
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCut(false)}>
          취소
        </Button>
      </span>
    );

  return (
    <div className={s.ecell} title={tip}>
      <span className={s.ain}>
        AI <b className="num">{c.ai > 0 ? f1(c.inT) : "0"}</b>
        {c.ai > 0 && (
          <button className={s.lnk} onClick={() => (setV(f1(c.inT)), setCut(true))} title="자리 비움 등 실제 작업이 아니었던 시간을 뺍니다">
            줄이기
          </button>
        )}
      </span>
      <button className={`${s.addb} ${c.out ? s.addbOn : ""}`} onClick={() => onAdd({ unit: c.unit, date, title, cell: c })} title="AI 도구 외 시간 입력 (작업 유형 8개)">
        ＋{c.out ? f1(c.out) : " 외"}
      </button>
      {c.mn > 0 && <span className={s.meta}>수집 {f1(c.ai)} − {f1(c.mn)}</span>}
    </div>
  );
}

function PendingPanel({ items, editable }: { items: PendingVM[]; editable: boolean }) {
  return (
    <Panel title={`확인 필요 · 단계가 정해지지 않은 AI 사용 ${items.length}건`}>
      <p className="subtle" style={{ fontSize: 12, marginBottom: 8 }}>
        세션 첫 줄에 단계 코드가 없거나 여러 개였습니다. {editable ? "어느 단계였는지 골라 주세요." : "개발자가 고릅니다."}
      </p>
      <div className={s.pend}>
        {items.map((p) => (
          <PendingRow key={p.datId} p={p} editable={editable} />
        ))}
      </div>
    </Panel>
  );
}

function PendingRow({ p, editable }: { p: PendingVM; editable: boolean }) {
  const { run, busy } = useMutate();
  const assign = (code: string) => run(() => api("/api/effort/sessions", { body: { datId: p.datId, parts: [{ unit: code, min: p.minutes }] } }), "배정했습니다.");
  const off = () => run(() => api("/api/effort/sessions", { body: { datId: p.datId, off: true } }), "업무 외 사용으로 표시했습니다.");
  return (
    <div className={s.pendRow}>
      <span style={{ minWidth: 240 }}>
        <b>
          {fmtDay(p.date)} {p.start}
          {p.end ? `~${p.end}` : ""} · {f1(p.minutes / 60)}h
        </b>{" "}
        <span className="subtle">
          {p.tool}
          {p.branch ? ` · ${p.branch}` : ""}
        </span>
        <div className="subtle" style={{ fontSize: 12 }}>
          {p.why}
        </div>
      </span>
      {editable && (
        <>
          <Select value="" disabled={busy} onChange={(e) => e.target.value && assign(e.target.value)} aria-label="요구사항 단계 선택">
            <option value="">어느 단계였나요?</option>
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
      )}
    </div>
  );
}

function daysAgo(date: string, today: string): string {
  const n = Math.round((Date.parse(today) - Date.parse(date)) / 86400000);
  return n === 0 ? "오늘" : n === 1 ? "어제" : n === 2 ? "그제" : "";
}

// 사내망 http 주소에서는 navigator.clipboard 가 없어서 예전 방식으로도 복사한다.
function copyText(v: string) {
  if (window.isSecureContext && navigator.clipboard) {
    void navigator.clipboard.writeText(v);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = v;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}
