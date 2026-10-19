"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, type Tone } from "@/components/ui/Chip";
import { TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { f1 } from "@/lib/format";
import type { ReqStatus } from "@/lib/measure/metrics";
import { FIELD_BY_ID, tally } from "@/lib/projects/form";
import { STAGE_LABEL } from "@/lib/types";
import type { ProjectInfo, ReqVM, StatusVM } from "@/lib/views";
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

  const all = vm.projects.flatMap((p) => p.reqs);
  const count = (s: ReqStatus) => all.filter((r) => r.status === s).length;
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
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
  }, [vm, f, q]);

  return (
    <>
      <PageHeader
        eyebrow="Phase 1 결과"
        title="과제 현황"
        description="선정된 과제·요구사항과 단계별 측정 진척입니다. 요구사항을 누르면 단계별 상세를 볼 수 있습니다."
        actions={
          canManage && (
            <Link href="/master">
              <Button icon="edit">기준 데이터에서 편집</Button>
            </Link>
          )
        }
      >
        <div className={st.kpis}>
          <KpiTile label="과제" value={vm.projects.length} unit="건" />
          <KpiTile label="요구사항" value={all.length} unit="건" />
          <KpiTile
            label="단계"
            value={all.reduce((a, r) => a + r.stages.length, 0)}
            unit="건"
            sub="요구사항 × SDLC 단계"
          />
          <KpiTile
            label="측정 완료"
            value={count("DONE")}
            unit="건"
            sub="모든 단계 완료"
          />
          <KpiTile label="측정 중" value={count("ING")} unit="건" />
        </div>
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
            <Traits info={p.info} reqs={p.reqs} />
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
type StageKey = "difficulty" | "grade" | "fit" | "spec" | "ctx" | "gen";
// 태그(단계)마다 값을 가지므로 과제 안에서 어떻게 섞였는지를 센다 — 과제 하나가 한 성격에 몰렸는지 보려고.
const TAG_TRAITS: [StageKey, string][] = [
  ["difficulty", "REQ-04"],
  ["grade", "REQ-05"],
  ["fit", "FIT-06"],
  ["spec", "FIT-01"],
  ["ctx", "FIT-02"],
  ["gen", "FIT-03"],
];

/** 과제 성격 — 시스템 특성(과제 시트)과 공수 태그 구성(요구사항-SDLC 시트) */
function Traits({ info, reqs }: { info: ProjectInfo; reqs: ReqVM[] }) {
  const tags = reqs.flatMap((r) => r.stages);
  // 상·중·하는 0건도 보여야 치우침이 보이고, 단계·등급처럼 선택지가 많은 축은 있는 것만.
  const mix = (opts: string[], vals: string[], zeros: boolean) => {
    const blank = vals.filter((v) => !v).length;
    if (blank === vals.length) return <span className={st.none}>미입력</span>;
    const rows = tally(opts, vals).filter((x) => zeros || x.n > 0);
    return (
      <span className={st.mix}>
        {rows.map((x) => (
          <span key={x.v} className={x.n ? "" : st.none}>
            {x.v} <b>{x.n}</b>
          </span>
        ))}
        {blank > 0 && <span className={st.none}>미입력 {blank}</span>}
      </span>
    );
  };
  return (
    <div className={st.traits}>
      <div className={st.traitRow}>
        <span className={st.traitHead}>시스템 특성</span>
        <div className={st.traitItems}>
          {PRJ_TRAITS.map(([k, id]) => (
            <span key={id} className={st.trait}>
              <i>{FIELD_BY_ID[id].label}</i>
              {String(info[k] ?? "") || <span className={st.none}>—</span>}
            </span>
          ))}
        </div>
      </div>
      <div className={st.traitRow}>
        <span className={st.traitHead}>태그 구성 {tags.length}</span>
        <div className={st.traitItems}>
          <span className={st.trait}>
            <i>단계</i>
            {mix(
              FIELD_BY_ID["REQ-03"].options ?? [],
              tags.map((x) => STAGE_LABEL[x.cd]),
              false,
            )}
          </span>
          {TAG_TRAITS.map(([k, id]) => (
            <span key={id} className={st.trait}>
              <i>{FIELD_BY_ID[id].label}</i>
              {mix(
                FIELD_BY_ID[id].options ?? [],
                tags.map((x) => x[k] ?? ""),
                k !== "grade",
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
      eyebrow={`${info.prjId} ${info.prjNm}`}
      title={`${req.rk}${req.name && req.name !== req.reqId ? ` ${req.name}` : ""}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>닫기</Button>}
    >
      <table className={st.table}>
        <thead>
          <tr>
            <th>공수 태그</th>
            <th>담당</th>
            <th>난이도 · 등급</th>
            <th>공수 출처</th>
            <th>기대효과 · 명세 · 맥락 · 생성</th>
            <th>투입 / 기준</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {req.stages.map((x) => (
            <tr key={x.cd}>
              <td>
                <b>{x.code}</b>
                <div className={st.sub}>
                  {STAGE_LABEL[x.cd]}
                  {x.workType && ` · ${x.workType}`}
                </div>
              </td>
              <td>{x.ownerNm}</td>
              <td>
                {x.difficulty || "—"} · {x.grade || "—"}
              </td>
              <td>{x.baseSrc || "—"}</td>
              <td>
                {[x.fit, x.spec, x.ctx, x.gen].map((v) => v || "—").join(" · ")}
              </td>
              <td>
                <Progress md={x.md} base={x.baseMd} />
              </td>
              <td>
                {STATUS_LABEL[x.status]}
                {x.doneAt && (
                  <div className={st.sub}>{x.doneAt.slice(0, 10)}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
