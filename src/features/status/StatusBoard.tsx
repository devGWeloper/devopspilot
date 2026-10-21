"use client";

import Link from "next/link";
import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, type Tone } from "@/components/ui/Chip";
import { TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { Stat, StatGroup, Stats } from "@/components/ui/Stats";
import { Segmented } from "@/components/ui/Tabs";
import { f1 } from "@/lib/format";
import type { ReqStatus } from "@/lib/measure/metrics";
import { FIELD_BY_ID, tally } from "@/lib/projects/form";
import { STAGE_LABEL } from "@/lib/types";
import type { ProjectInfo, ReqVM, StageVM, StatusVM } from "@/lib/views";
import { Progress, STATUS_LABEL } from "../common/bits";
import st from "./status.module.css";

const ST_TONE: Record<ReqStatus, Tone> = {
  DONE: "accent",
  ING: "outline",
  WAIT: "neutral",
};

type Filter = "ALL" | ReqStatus;

/** 조회 전용 — 과제·요구사항 편집은 '기준 데이터'(관리자)에서 한다 */
export function StatusBoard({
  vm,
  canManage,
}: {
  vm: StatusVM;
  canManage: boolean;
}) {
  const [f, setF] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [view, setView] = useState<{ info: ProjectInfo; req: ReqVM } | null>(
    null,
  );
  // 과제가 많으면 요구사항 표가 길어 평소엔 접어 두고, 검색·상태로 거를 때는 맞는 줄을 바로 보이게 펼친다.
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  const all = vm.projects.flatMap((p) => p.reqs);
  const count = (s: ReqStatus) => all.filter((r) => r.status === s).length;
  const dq = useDeferredValue(q);
  const shown = useMemo(() => {
    const ql = dq.trim().toLowerCase();
    return vm.projects
      .map((p) => ({
        ...p,
        rows: p.reqs.filter(
          (r) =>
            (f === "ALL" || r.status === f) &&
            (!ql ||
              [
                p.info.prjId,
                p.info.prjNm,
                p.info.sysNm,
                r.rk,
                r.name,
                ...r.stages.flatMap((x) => [x.code, x.ownerNm]),
              ]
                .join(" ")
                .toLowerCase()
                .includes(ql)),
        ),
      }))
      .filter((p) => p.rows.length > 0);
  }, [vm, f, dq]);
  const narrowed = f !== "ALL" || !!dq.trim();
  const isOpen = (id: string) => narrowed !== flipped.has(id);
  const flip = (id: string) =>
    setFlipped((x) => {
      const n = new Set(x);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOpen = shown.length > 0 && shown.every((p) => isOpen(p.info.prjId));
  const setAll = (open: boolean) =>
    setFlipped(new Set(open === narrowed ? [] : shown.map((p) => p.info.prjId)));

  return (
    <>
      <PageHeader
        eyebrow="Phase 1 결과"
        title="과제 현황"
        description="선정된 과제·요구사항과 단계별 측정 진척입니다. 과제마다 '요구사항 상세보기'를 펼치고, 요구사항을 누르면 단계별 상세를 볼 수 있습니다."
        actions={
          canManage && (
            <Link href="/master">
              <Button icon="edit">기준 데이터에서 편집</Button>
            </Link>
          )
        }
      >
        {/* 규모 셋과 진척 둘을 나눠 둔다 */}
        <Stats>
          <StatGroup>
            <Stat label="과제" value={vm.projects.length} unit="건" />
            <Stat label="요구사항" value={all.length} unit="건" />
            <Stat
              label="단계"
              value={all.reduce((a, r) => a + r.stages.length, 0)}
              unit="건"
            />
          </StatGroup>
          <StatGroup>
            <Stat label="측정 완료" value={count("DONE")} unit="건" />
            <Stat label="측정 중" value={count("ING")} unit="건" />
          </StatGroup>
        </Stats>
      </PageHeader>

      <div className={st.filters}>
        <Segmented<Filter>
          ariaLabel="상태"
          value={f}
          onChange={setF}
          options={[
            { key: "ALL", label: "전체" },
            { key: "DONE", label: "측정 완료" },
            { key: "ING", label: "측정 중" },
            { key: "WAIT", label: "측정 대기" },
          ]}
        />
        <TextInput
          placeholder="과제·요구사항·담당자 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        {shown.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => setAll(!allOpen)}>
            {allOpen ? "요구사항 모두 접기" : "요구사항 모두 펼치기"}
          </Button>
        )}
      </div>

      {shown.length === 0 && (
        <Panel>
          <EmptyState
            title={
              vm.projects.length
                ? "조건에 맞는 요구사항이 없습니다"
                : "아직 과제가 없습니다"
            }
          >
            {canManage && !vm.projects.length
              ? "기준 데이터에서 엑셀을 올려 주세요."
              : undefined}
          </EmptyState>
        </Panel>
      )}

      <div className={st.list}>
        {shown.map((p) => (
          <Panel
            key={p.info.prjId}
            flush
            title={
              <span className={st.ptitle}>
                {p.info.prjId} {p.info.prjNm}
              </span>
            }
            actions={
              <span className={st.pprog}>
                <span className="subtle">
                  완료 {p.doneN}/{p.reqs.length}
                </span>
                <Progress md={p.md} base={p.baseMd} />
              </span>
            }
          >
            <div className={st.pmeta}>
              {[
                p.info.sysNm,
                p.info.deptCd,
                p.info.teamNm,
                p.info.pmNm && `PM ${p.info.pmNm}`,
                [p.info.axHq, p.info.axTeam].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
            <SysTraits info={p.info} />
            <Traits reqs={p.reqs} />
            <button
              type="button"
              className={st.reqToggle}
              aria-expanded={isOpen(p.info.prjId)}
              onClick={() => flip(p.info.prjId)}
            >
              <span className={st.caret}>{isOpen(p.info.prjId) ? "▾" : "▸"}</span>
              요구사항 {narrowed ? `${p.rows.length}/${p.reqs.length}` : p.reqs.length}건 상세보기
            </button>
            {isOpen(p.info.prjId) && (
            <table className={st.table}>
              <thead>
                <tr>
                  <th>요구사항</th>
                  <th>단계 · 담당</th>
                  <th style={{ width: 260 }}>투입 / 기준</th>
                  <th style={{ width: 100 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => (
                  <tr
                    key={r.rk}
                    className={st.row}
                    onClick={() => setView({ info: p.info, req: r })}
                  >
                    <td>
                      <b>{r.reqId}</b>
                      {r.name && r.name !== r.reqId && (
                        <div className={st.sub}>{r.name}</div>
                      )}
                    </td>
                    <td>
                      <div className={st.stages}>
                        {r.stages.map((x) => (
                          <span
                            key={x.cd}
                            className={st.stage}
                            title={`${x.code} · ${x.grade || "등급 없음"} · 기준 ${f1(x.baseMd)} M/D${x.done ? " · 완료" : ""}`}
                          >
                            {STAGE_LABEL[x.cd]}{" "}
                            <b>
                              {x.ownerId ? (
                                x.ownerNm
                              ) : (
                                <span className={st.warn}>미지정</span>
                              )}
                            </b>
                            {x.done && " ✓"}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Progress md={r.md} base={r.baseMd} />
                    </td>
                    <td>
                      <Chip tone={ST_TONE[r.status]} dot>
                        {STATUS_LABEL[r.status]}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </Panel>
        ))}
      </div>

      {view && (
        <ReqView
          info={view.info}
          req={view.req}
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}

const PRJ_TRAITS: [keyof ProjectInfo, string][] = [
  ["sysGrade", "PRJ-06"],
  ["deployType", "PRJ-07"],
  ["area", "PRJ-08"],
  ["vcs", "PRJ-10"],
  ["pms", "PRJ-11"],
];
type StageKey = "difficulty" | "fit" | "spec" | "ctx" | "gen";
// 상·중·하 축은 표로 나란히 놓아야 과제가 한 성격에 몰렸는지 한눈에 보인다.
const LV_TRAITS: [StageKey, string][] = [
  ["difficulty", "REQ-04"],
  ["fit", "FIT-06"],
  ["spec", "FIT-01"],
  ["ctx", "FIT-02"],
  ["gen", "FIT-03"],
];

/** 시스템 특성(과제 시트) — 값만 한 줄로, 항목명은 툴팁 */
function SysTraits({ info }: { info: ProjectInfo }) {
  const xs = PRJ_TRAITS.map(([k, id]) => ({
    id,
    label: FIELD_BY_ID[id].label,
    v: String(info[k] ?? ""),
  })).filter((x) => x.v);
  if (!xs.length) return null;
  return (
    <div className={st.sys}>
      {xs.map((x) => (
        <span key={x.id} className={st.sysItem} title={x.label}>
          {x.v}
        </span>
      ))}
    </div>
  );
}

/** 공수 태그 성격 분포(요구사항-SDLC 시트) — 평소엔 접어 둔다 */
function Traits({ reqs }: { reqs: ReqVM[] }) {
  const tags = reqs.flatMap((r) => r.stages);
  if (!tags.length) return null;
  const line = (opts: string[], vals: string[]) =>
    tally(opts, vals)
      .filter((x) => x.n > 0)
      .map((x) => `${x.v} ${x.n}`)
      .join(" · ") || "—";
  const lv = FIELD_BY_ID["FIT-01"].options ?? [];
  const blankAny = LV_TRAITS.some(([k]) => tags.some((x) => !x[k]));
  return (
    <details className={st.traits}>
      <summary>과제 성격 분포</summary>
      <div className={st.traitBody}>
        <dl className={st.traitLines}>
          <dt>SDLC 단계</dt>
          <dd>
            {line(
              FIELD_BY_ID["REQ-03"].options ?? [],
              tags.map((x) => STAGE_LABEL[x.cd]),
            )}
          </dd>
          <dt>{FIELD_BY_ID["REQ-05"].label}</dt>
          <dd>
            {line(
              FIELD_BY_ID["REQ-05"].options ?? [],
              tags.map((x) => x.grade),
            )}
          </dd>
        </dl>
        <table className={st.traitTable}>
          <thead>
            <tr>
              <th />
              {lv.map((v) => (
                <th key={v}>{v}</th>
              ))}
              {blankAny && <th>미입력</th>}
            </tr>
          </thead>
          <tbody>
            {LV_TRAITS.map(([k, id]) => {
              const vals = tags.map((x) => x[k] ?? "");
              const cells = [
                ...lv.map((v) => vals.filter((x) => x === v).length),
                ...(blankAny ? [vals.filter((x) => !x).length] : []),
              ];
              return (
                <tr key={id}>
                  <th>{FIELD_BY_ID[id].label}</th>
                  {cells.map((n, i) => (
                    <td key={i} className={n ? "" : st.none}>
                      {n || "·"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

type Cell = (x: StageVM) => ReactNode;
const dash = (v: string) => v || <span className={st.none}>—</span>;
const pick = (id: string, k: keyof StageVM): [string, Cell] => [
  FIELD_BY_ID[id].label,
  (x) => dash(String(x[k] ?? "")),
];
// 단계가 최대 4개라 단계를 열로 세워야 항목명이 잘리지 않고 단계끼리 비교된다.
const REQ_GROUPS: { title: string; rows: [string, Cell][] }[] = [
  {
    title: "담당 · 공수",
    rows: [
      ["공수 태그", (x) => <code className={st.code}>{x.code}</code>],
      ["업무 유형", (x) => dash(x.workType)],
      [
        "담당",
        (x) => (x.ownerId ? x.ownerNm : <span className={st.warn}>미지정</span>),
      ],
      pick("REQ-05", "grade"),
      pick("REQ-07", "baseSrc"),
    ],
  },
  {
    title: "과제 성격",
    rows: [
      pick("REQ-04", "difficulty"),
      pick("FIT-06", "fit"),
      pick("FIT-01", "spec"),
      pick("FIT-02", "ctx"),
      pick("FIT-03", "gen"),
    ],
  },
  {
    title: "진척",
    rows: [
      ["투입 / 기준", (x) => <Progress md={x.md} base={x.baseMd} />],
      [
        "상태",
        (x) => (
          <>
            {STATUS_LABEL[x.status]}
            {x.doneAt && <span className={st.sub}> {x.doneAt.slice(0, 10)}</span>}
          </>
        ),
      ],
    ],
  },
];

function ReqView({
  info,
  req,
  onClose,
}: {
  info: ProjectInfo;
  req: ReqVM;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      wide
      eyebrow={info.prjId}
      title={
        <span className={st.mTitle}>
          <span>{req.reqId}</span>
          {req.name && req.name !== req.reqId && (
            <span className={st.mName}>{req.name}</span>
          )}
        </span>
      }
      onClose={onClose}
      footer={<Button onClick={onClose}>닫기</Button>}
    >
      <div className={st.mSum}>
        <span className={st.mPrj}>{info.prjNm}</span>
        <span className={st.mProg}>
          <Progress md={req.md} base={req.baseMd} />
          <Chip tone={ST_TONE[req.status]} dot>
            {STATUS_LABEL[req.status]}
          </Chip>
        </span>
      </div>
      <table className={st.mTable}>
        <thead>
          <tr>
            <th />
            {req.stages.map((x) => (
              <th key={x.cd}>{STAGE_LABEL[x.cd]}</th>
            ))}
          </tr>
        </thead>
        {REQ_GROUPS.map((g) => (
          <tbody key={g.title}>
            <tr className={st.mGroup}>
              <td colSpan={req.stages.length + 1}>{g.title}</td>
            </tr>
            {g.rows.map(([label, cell]) => (
              <tr key={label}>
                <th>{label}</th>
                {req.stages.map((x) => (
                  <td key={x.cd}>{cell(x)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </Modal>
  );
}
