"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useCoach } from "@/components/ui/Coach";
import { api } from "@/lib/apiClient";
import { f1, pct } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import { ACT_LABEL, type ActType } from "@/lib/measure/types";
import { STAGE_LABEL } from "@/lib/types";
import type {
  EffortCellVM,
  EffortDayVM,
  EffortReqVM,
  EffortUnitVM,
  EffortVM,
  PendingVM,
} from "@/lib/views";
import { Progress, STATUS_LABEL } from "../common/bits";
import { useMutate } from "../common/useMutate";
import { AddTimeDialog, type AddTarget } from "./AddTimeDialog";
import s from "./effort.module.css";
import { EffortTour } from "./EffortTour";
import { UploadDialog } from "./UploadDialog";

type Filter = "TODO" | "ALL";

const SRC_LABEL = {
  OTEL: "텔레메트리 자동 수집",
  LOG: "Codex 기록 올리기",
} as const;

export function EffortBoard({
  vm,
  editable,
}: {
  vm: EffortVM;
  editable: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [nav, start] = useTransition();
  const [upload, setUpload] = useState(false);
  const [add, setAdd] = useState<AddTarget | null>(null);
  const [f, setF] = useState<Filter>("ALL");
  const todo = (d: EffortDayVM) => d.need > 0 || d.pending > 0;
  // 처음엔 할 일이 남은 가장 최근 날을 연다.
  const [date, setDate] = useState(vm.days.find(todo)?.date ?? vm.today);
  const day = vm.days.find((d) => d.date === date) ?? {
    date,
    st: {},
    cells: {},
    ai: 0,
    out: 0,
    tot: 0,
    need: 0,
    pending: 0,
  };
  const days = vm.days.filter((d) => f === "ALL" || todo(d) || d.date === date);
  const { stats } = vm;
  const confTot = stats.confAi + stats.confOut;
  const who = editable ? "내" : `${vm.userNm} 님`;
  // 역할과 관계없이 처음 들어오면 한 번은 띄운다. 첫 장 설명이 생겨 이전에 끝까지 본 사람도 다시 보도록 v2.
  const tour = useCoach("effort.v2", vm.today, true);

  return (
    <>
      <PageHeader
        eyebrow="Phase 2"
        title="공수 입력"
        description="Codex 시간은 자동으로 들어옵니다. Codex 밖에서 한 일만 넣고 하루를 확정하세요."
        actions={
          <>
            {editable ? (
            <>
              <Button
                icon="info"
                variant="ghost"
                onClick={() => router.push("/guide")}
              >
                작성 가이드
              </Button>
              <Button icon="upload" onClick={() => setUpload(true)}>
                Codex 기록 올리기
              </Button>
            </>
          ) : (
            <Select
              value={vm.userId}
              onChange={(e) =>
                start(() =>
                  router.push(
                    `${path}?u=${encodeURIComponent(e.target.value)}`,
                    { scroll: false },
                  ),
                )
              }
              aria-label="개발자"
              style={{ minWidth: 180 }}
            >
              {vm.devs.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.userNm} ({d.userId})
                </option>
              ))}
            </Select>
            )}
            <Button icon="spark" variant={tour.open ? "primary" : "ghost"} onClick={tour.toggle} aria-pressed={tour.open} data-tour="replay">
              튜토리얼
            </Button>
          </>
        }
      />

      <div
        style={{
          opacity: nav ? 0.6 : 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Flow vm={vm} editable={editable} />

        <div className={s.kpis} data-tour="kpis">
          <KpiTile
            label="확정할 날"
            value={
              <span className={stats.needDays ? s.warn : ""}>
                {stats.needDays}
              </span>
            }
            unit="일"
            hint="첫 날 보기"
            onClick={
              stats.needDays
                ? () => setDate(vm.days.find((d) => d.need > 0)!.date)
                : undefined
            }
          />
          <KpiTile
            label="미분류 Codex 세션"
            value={
              <span className={stats.pendN ? s.warn : ""}>{stats.pendN}</span>
            }
            unit="건"
            hint="첫 건 보기"
            onClick={
              stats.pendN
                ? () => setDate(vm.pending[vm.pending.length - 1].date)
                : undefined
            }
          />
          <KpiTile
            label={`${who} 확정 공수`}
            value={f1(confTot)}
            unit="h"
          />
          <KpiTile
            label="Codex 비중"
            value={confTot ? pct(stats.confAi / confTot) : "—"}
          />
        </div>

        {vm.reqs.length === 0 ? (
          <Panel>
            <EmptyState title="담당한 요구사항이 없습니다">
              관리자가 기준 데이터에서 요구사항 단계의 담당자로 지정하면 여기에
              나타납니다.
            </EmptyState>
          </Panel>
        ) : (
          <div className={s.layout}>
            <Panel flush title="날짜">
              <div className={s.lfilter}>
                <Segmented<Filter>
                  ariaLabel="날짜 범위"
                  value={f}
                  onChange={setF}
                  options={[
                    { key: "TODO", label: "할 일 있는 날" },
                    { key: "ALL", label: "전체" },
                  ]}
                />
                <label className={s.pick}>
                  다른 날짜 고르기
                  <input
                    type="date"
                    max={vm.today}
                    value=""
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    aria-label="다른 날짜 고르기"
                  />
                </label>
              </div>
              <div className={s.days} data-tour="days">
                {days.length === 0 && (
                  <p className="subtle" style={{ padding: 14, fontSize: 13 }}>
                    할 일이 남은 날이 없습니다.
                  </p>
                )}
                {days.map((d) => (
                  <DayItem
                    key={d.date}
                    d={d}
                    on={d.date === date}
                    today={vm.today}
                    onClick={() => setDate(d.date)}
                  />
                ))}
              </div>
            </Panel>

            <DayPanel day={day} vm={vm} editable={editable} onAdd={setAdd} />
          </div>
        )}

        {vm.reqs.length > 0 && <ReqProgress vm={vm} editable={editable} />}
      </div>

      {add && <AddTimeDialog t={add} onClose={() => setAdd(null)} />}
      {upload && <UploadDialog onClose={() => setUpload(false)} />}
      <EffortTour open={tour.open} onClose={tour.close} onDone={tour.done} onHideToday={tour.hideToday} />
    </>
  );
}

/** Codex 시간이 어떻게 들어오는지 — 화면을 처음 본 사람이 순서를 알 수 있게 */
function Flow({ vm, editable }: { vm: EffortVM; editable: boolean }) {
  const last = vm.stats.last;
  return (
    <details className={s.flow} data-tour="flow">
      <summary>
        <b>공수가 들어오는 순서</b>
        {last && (
          <span className="subtle">
            마지막 수집 {fmtDay(last.date)} {last.time}
          </span>
        )}
      </summary>
      <ol className={s.steps}>
        <li>
          <b>Codex 대화 첫 줄에 공수 태그</b>
          <span>
            아래 표의 <span className={s.mono}>poc DAE01-REQ0047-DV</span> 처럼
            생긴 값을 복사해 붙여 넣습니다. 업무가 아니면{" "}
            <span className={s.mono}>poc off</span>.
          </span>
        </li>
        <li>
          <b>Codex 시간 자동 반영</b>
          <span>
            텔레메트리(OpenTelemetry)가 연결된 PC 는 바로, 아니면{" "}
            <b>Codex 기록 올리기</b>로{" "}
            <span className={s.mono}>~/.codex/sessions</span> 기록을 올립니다.
            공수 태그로 요구사항·단계가 정해지면 그 줄의 &apos;Codex&apos; 칸에
            들어갑니다.
          </span>
        </li>
        <li>
          <b>Codex 밖에서 한 일 직접 입력</b>
          <span>
            회의·문서·직접 코딩·테스트처럼 Codex 를 안 쓴 시간을 &apos;직접
            입력&apos; 칸에 넣습니다.
          </span>
        </li>
        <li>
          <b>하루 확정</b>
          <span>
            그날 숫자가 맞으면 &apos;이 날 확정&apos;. 확정한 날만 측정 결과에
            들어갑니다.
          </span>
        </li>
      </ol>
    </details>
  );
}

function DayItem({
  d,
  on,
  today,
  onClick,
}: {
  d: EffortDayVM;
  on: boolean;
  today: string;
  onClick: () => void;
}) {
  const states = Object.values(d.st);
  const edit = states.includes("edit");
  const label =
    d.need > 0
      ? edit
        ? "다시 확정 필요"
        : "확정 필요"
      : states.length
        ? "확정됨"
        : "기록 없음";
  const ago = daysAgo(d.date, today);
  return (
    <button className={`${s.day} ${on ? s.dayOn : ""}`} onClick={onClick}>
      <span className={s.dayH}>
        <b>
          {fmtDay(d.date)}
          {ago && <span className="subtle"> {ago}</span>}
        </b>
        <span className="num">{d.tot ? `${f1(d.tot)}h` : ""}</span>
      </span>
      <span className={s.daySt}>
        <span className={d.need > 0 ? s.warn : ""}>{label}</span>
        {d.pending > 0 && (
          <span className={s.warn}> · 미분류 Codex {d.pending}건</span>
        )}
      </span>
    </button>
  );
}

function DayPanel({
  day,
  vm,
  editable,
  onAdd,
}: {
  day: EffortDayVM;
  vm: EffortVM;
  editable: boolean;
  onAdd: (t: AddTarget) => void;
}) {
  const { run, busy } = useMutate();
  const pend = vm.pending.filter((p) => p.date === day.date);
  // 끝난 단계는 그날 기록이 있을 때만 보인다 — 더 넣을 수 없으니.
  const reqs = vm.reqs
    .map((r) => ({
      r,
      units: r.units.filter((u) => !u.done || day.cells[u.code]),
    }))
    .filter((x) => x.units.length > 0);
  const confirm = () =>
    run(
      () => api("/api/effort/confirm", { body: { date: day.date } }),
      `${fmtDay(day.date)} 공수를 확정했습니다.`,
    );
  const ago = daysAgo(day.date, vm.today);

  return (
    <Panel
      flush
      title={
        <span className={s.ptitle}>
          {fmtDay(day.date)} 공수
          {ago && <span className="subtle"> · {ago}</span>}
        </span>
      }
      actions={
        <span className={s.psum} data-tour="daySum">
          <span>
            Codex <b className="num">{f1(day.ai)}</b>h + 직접 입력{" "}
            <b className="num">{f1(day.out)}</b>h ={" "}
            <b className="num">{f1(day.tot)}</b>h
          </span>
          {editable && day.need > 0 && (
            <Button variant="primary" loading={busy} onClick={confirm} data-tour="confirm">
              이 날 확정
            </Button>
          )}
        </span>
      }
    >
      {pend.length > 0 && <PendingBox items={pend} editable={editable} />}

      <div className={s.tw}>
        <table className={s.et}>
          <thead>
            <tr>
              <th>요구사항 · SDLC 단계</th>
              <th className={s.r} data-tour="ai">
                Codex
              </th>
              <th className={s.r} data-tour="addCol">
                직접 입력
              </th>
              <th className={s.r}>합계 (h)</th>
            </tr>
          </thead>
          <tbody data-tour="stages">
            {reqs.map(({ r, units }) => (
              <ReqRows
                key={r.rk}
                r={r}
                units={units}
                day={day}
                editable={editable}
                onAdd={onAdd}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const ST_LABEL = {
  conf: "확정됨",
  need: "확정 필요",
  edit: "다시 확정 필요",
} as const;

function ReqRows({
  r,
  units,
  day,
  editable,
  onAdd,
}: {
  r: EffortReqVM;
  units: EffortUnitVM[];
  day: EffortDayVM;
  editable: boolean;
  onAdd: (t: AddTarget) => void;
}) {
  const { run, busy } = useMutate();
  const st = day.st[r.rk];
  const reopen = () =>
    run(
      () =>
        api("/api/effort/day", {
          body: { reqId: r.rk, date: day.date, action: "reopen" },
        }),
      "확정을 풀었습니다. 고친 뒤 다시 확정해 주세요.",
    );
  return (
    <>
      <tr className={s.grp}>
        <td colSpan={4}>
          <span className={s.grpH}>
            <span>
              <span className="subtle">{r.prjNm} · </span>
              <b>{r.name || r.reqId}</b> <span className={s.code}>{r.rk}</span>
            </span>
            <span className={s.grpSt}>
              {st && (
                <span className={st === "conf" ? "subtle" : s.warn}>
                  {ST_LABEL[st]}
                </span>
              )}
              {editable && st === "conf" && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy}
                  onClick={reopen}
                >
                  수정
                </Button>
              )}
            </span>
          </span>
        </td>
      </tr>
      {units.map((u) => (
        <UnitRow
          key={u.code}
          r={r}
          u={u}
          c={day.cells[u.code]}
          date={day.date}
          locked={!editable || st === "conf" || u.done}
          editable={editable}
          onAdd={onAdd}
        />
      ))}
    </>
  );
}

function UnitRow({
  r,
  u,
  c,
  date,
  locked,
  editable,
  onAdd,
}: {
  r: EffortReqVM;
  u: EffortUnitVM;
  c: EffortCellVM | undefined;
  date: string;
  locked: boolean;
  editable: boolean;
  onAdd: (t: AddTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const types = Object.entries(c?.add ?? {}).filter(([, h]) => (h ?? 0) > 0);
  const title = `${r.name || r.reqId} · ${STAGE_LABEL[u.stage]}`;
  return (
    <>
      <tr>
        <td className={s.unit}>
          <b>{STAGE_LABEL[u.stage]}</b>
          {u.workType && <span className="subtle"> · {u.workType}</span>}
          <span className={s.tagLine}>
            <TagCopy code={u.code} show={editable && !u.done} />
            {u.done && <span className="subtle">측정 완료</span>}
          </span>
        </td>
        <td className={s.r}>
          <AiCell
            c={c}
            unit={u.code}
            date={date}
            locked={locked}
            open={open}
            onToggle={() => setOpen((v) => !v)}
          />
        </td>
        <td className={s.r}>
          {locked ? (
            <span className={`num ${c?.out ? "" : s.z}`}>
              {c?.out ? f1(c.out) : "—"}
            </span>
          ) : (
            <button
              data-tour="add"
              className={`${s.addb} ${c?.out ? s.addbOn : ""}`}
              onClick={() =>
                onAdd({ unit: u.code, date, title, cell: c ?? null })
              }
            >
              {c?.out ? `${f1(c.out)} 수정` : "＋ 입력"}
            </button>
          )}
          {types.length > 0 && (
            <span className={s.meta}>
              {types
                .map(([k, h]) => `${ACT_LABEL[k as ActType]} ${f1(h ?? 0)}`)
                .join(" · ")}
            </span>
          )}
        </td>
        <td className={`${s.r} num`}>
          <b className={c?.tot ? "" : s.z}>{f1(c?.tot ?? 0)}</b>
        </td>
      </tr>
      {open && c && c.sess.length > 0 && (
        <tr className={s.sessRow}>
          <td colSpan={4}>
            <ul className={s.sess}>
              {c.sess.map((x, i) => (
                <li key={i}>
                  <span className="num">
                    {x.start}
                    {x.end ? `~${x.end}` : ""} · {f1(x.min / 60)}h
                  </span>
                  <span className="subtle">
                    {SRC_LABEL[x.src]} · {x.how}
                  </span>
                </li>
              ))}
              {c.mn > 0 && (
                <li>
                  <span className="num">− {f1(c.mn)}h</span>
                  <span className="subtle">
                    실제 작업이 아니었던 시간으로 뺌
                  </span>
                </li>
              )}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}

function AiCell({
  c,
  unit,
  date,
  locked,
  open,
  onToggle,
}: {
  c: EffortCellVM | undefined;
  unit: string;
  date: string;
  locked: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { run, busy } = useMutate();
  const [cut, setCut] = useState(false);
  const [v, setV] = useState("");
  if (!c || c.ai === 0) return <span className={s.z}>—</span>;

  async function save() {
    if (
      await run(() =>
        api("/api/effort/entry", { body: { unit, date, inT: Number(v) } }),
      )
    )
      setCut(false);
  }

  if (cut)
    return (
      <span className={s.aiEdit}>
        <input
          type="number"
          step="0.1"
          min="0"
          max={c.ai}
          value={v}
          autoFocus
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          aria-label="실제 작업한 Codex 시간"
        />
        <Button size="sm" variant="primary" loading={busy} onClick={save}>
          저장
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCut(false)}>
          취소
        </Button>
      </span>
    );

  return (
    <span className={s.ai} data-tour="aiCell">
      <b className="num">{f1(c.inT)}</b>
      <span className={s.meta}>
        <button className={s.lnk} onClick={onToggle} aria-expanded={open}>
          세션 {c.sess.length}건 {open ? "▴" : "▾"}
        </button>
        {!locked && (
          <button
            className={s.lnk}
            onClick={() => (setV(f1(c.inT)), setCut(true))}
            title="자리 비움 등 실제 작업이 아니었던 시간을 뺍니다"
          >
            시간 빼기
          </button>
        )}
      </span>
      {c.mn > 0 && (
        <span className={s.meta}>
          수집 {f1(c.ai)} − 뺀 시간 {f1(c.mn)}
        </span>
      )}
    </span>
  );
}

function TagCopy({ code, show }: { code: string; show: boolean }) {
  const { toast } = useToast();
  if (!show) return <span className={s.code}>{code}</span>;
  return (
    <span className={s.cmd} data-tour="tag">
      poc {code}
      <button
        className={s.copy}
        onClick={() => {
          copyText(`poc ${code}`);
          toast(
            `"poc ${code}" 복사했습니다. Codex 대화 첫 줄에 붙여 넣으세요.`,
          );
        }}
      >
        복사
      </button>
    </span>
  );
}

function PendingBox({
  items,
  editable,
}: {
  items: PendingVM[];
  editable: boolean;
}) {
  return (
    <div className={s.pendBox} data-tour="pending">
      <b className={s.warn} style={{ display: "block", marginBottom: 8 }}>
        미분류 Codex 세션 {items.length}건
        <span className="subtle" style={{ fontWeight: 400, marginLeft: 8 }}>
          공수 태그가 없어 어느 단계에도 안 들어간 시간
        </span>
      </b>
      {items.map((p) => (
        <PendingRow key={p.datId} p={p} editable={editable} />
      ))}
    </div>
  );
}

function PendingRow({ p, editable }: { p: PendingVM; editable: boolean }) {
  const { run, busy } = useMutate();
  const assign = (code: string) =>
    run(
      () =>
        api("/api/effort/sessions", {
          body: { datId: p.datId, parts: [{ unit: code, min: p.minutes }] },
        }),
      "선택한 단계에 넣었습니다.",
    );
  const off = () =>
    run(
      () =>
        api("/api/effort/sessions", { body: { datId: p.datId, off: true } }),
      "업무 외 사용으로 표시했습니다.",
    );
  return (
    <div className={s.pendRow}>
      <span className={s.pendInfo}>
        <b className="num">
          {p.start}
          {p.end ? `~${p.end}` : ""} · {f1(p.minutes / 60)}h
        </b>{" "}
        <span className="subtle">
          {p.tool}
          {p.branch ? ` · 브랜치 ${p.branch}` : ""}
        </span>
        <span className={s.meta}>{p.why}</span>
      </span>
      {editable && (
        <>
          <span className={s.pendSel}>
            <Select
              value=""
              disabled={busy}
              onChange={(e) => e.target.value && assign(e.target.value)}
              aria-label="요구사항·단계 고르기"
            >
              <option value="">요구사항·단계 고르기</option>
              {p.options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.cand ? "추천 · " : ""}
                  {o.label}
                </option>
              ))}
            </Select>
          </span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={off}>
            업무 외 사용
          </Button>
        </>
      )}
    </div>
  );
}

/** 요구사항·단계별 누적 — 기준 공수 대비 어디까지 왔는지 */
function ReqProgress({ vm, editable }: { vm: EffortVM; editable: boolean }) {
  return (
    <Panel
      flush
      title={
        editable
          ? "내 담당 요구사항 진척"
          : `${vm.userNm} 님 담당 요구사항 진척`
      }
    >
      <div className={s.tw}>
        <table className={s.et}>
          <thead>
            <tr>
              <th>과제 · 요구사항</th>
              <th>SDLC 단계</th>
              <th>공수 태그</th>
              <th className={s.r}>
                Codex / 직접 (h)<small>확정 전 포함</small>
              </th>
              <th>투입 / 기준</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {vm.reqs.map((r) =>
              r.units.map((u, i) => (
                <tr key={u.code}>
                  {i === 0 && (
                    <td rowSpan={r.units.length} className={s.unit}>
                      <span className="subtle">{r.prjNm}</span>
                      <b style={{ display: "block" }}>{r.name || r.reqId}</b>
                      <span className={s.code}>{r.rk}</span>
                    </td>
                  )}
                  <td>
                    <b>{STAGE_LABEL[u.stage]}</b>
                    {u.workType && <span className={s.meta}>{u.workType}</span>}
                  </td>
                  <td>
                    <TagCopy code={u.code} show={editable && !u.done} />
                  </td>
                  <td className={`${s.r} num`}>
                    {f1(u.inT)} / {f1(u.out)}
                  </td>
                  <td style={{ minWidth: 180 }}>
                    <Progress md={u.md} base={u.baseMd} />
                  </td>
                  <td>
                    {u.done ? (
                      <Chip>측정 완료</Chip>
                    ) : (
                      <span className="subtle">{STATUS_LABEL[r.status]}</span>
                    )}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </Panel>
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
