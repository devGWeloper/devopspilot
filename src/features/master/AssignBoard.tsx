"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Checkbox, Select, TextInput } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { api } from "@/lib/apiClient";
import { STAGE_LABEL } from "@/lib/types";
import type { ProjectInfo, ReqVM, StageVM, StatusVM } from "@/lib/views";
import { Progress, STATUS_LABEL } from "../common/bits";
import b from "../common/board.module.css";
import { useMutate } from "../common/useMutate";

export interface Dev {
  userId: string;
  userNm: string;
}

/**
 * Phase 2 — 선정된 요구사항 × 단계를 누가 맡아 공수를 넣는지, 어디까지 측정했는지.
 * 줄마다 바로 저장한다(선정 항목은 Phase 1 과제 선정 관리에서).
 */
export function AssignBoard({ projects, devs }: { projects: StatusVM["projects"]; devs: Dev[] }) {
  const [prj, setPrj] = useState("");
  const [q, setQ] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const dq = useDeferredValue(q);
  const all = projects.flatMap((p) => p.reqs.flatMap((r) => r.stages));
  const unmapped = all.filter((s) => !s.ownerId).length;
  const doneN = all.filter((s) => s.done).length;

  const shown = useMemo(() => {
    const ql = dq.trim().toLowerCase();
    return projects
      .filter((p) => !prj || p.info.prjId === prj)
      .map((p) => ({
        ...p,
        reqs: p.reqs
          .map((r) => ({ ...r, stages: r.stages.filter((s) => (!onlyOpen || !s.ownerId) && (!ql || [s.code, r.name, s.ownerNm, s.ownerId ?? ""].join(" ").toLowerCase().includes(ql))) }))
          .filter((r) => r.stages.length),
      }))
      .filter((p) => p.reqs.length);
  }, [projects, prj, dq, onlyOpen]);

  return (
    <>
      <PageHeader
        eyebrow="Phase 2 · 관리"
        title="공수 입력 관리"
        description={
          <>
            선정된 요구사항 × 단계마다 공수를 넣을 개발자 한 명을 정하고, 측정이 끝난 단계는 완료로 표시합니다. 담당이 있어야 개발자의 공수 입력 화면에 나타나고, 완료한 단계는 더 이상 공수를 받지 않으며 측정 결과에 집계됩니다. 선정 항목(기준 공수·등급 등)은{" "}
            <Link href="/master">과제 선정 관리</Link>에서 고칩니다.
          </>
        }
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <Select value={prj} onChange={(e) => setPrj(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">과제 전체</option>
          {projects.map((p) => (
            <option key={p.info.prjId} value={p.info.prjId}>
              {p.info.prjId} {p.info.prjNm}
            </option>
          ))}
        </Select>
        <TextInput placeholder="공수 태그·요구사항·담당 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <Checkbox label={`담당 미지정만 (${unmapped})`} checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
        <span className={b.xs}>
          단계 {all.length} · 측정 완료 {doneN}
          {unmapped > 0 && (
            <>
              {" "}
              · <b className={b.warn}>담당 미지정 {unmapped}</b>
            </>
          )}
        </span>
      </div>
      {shown.length === 0 && (
        <Panel>
          <EmptyState title={projects.length ? "조건에 맞는 단계가 없습니다" : "선정된 과제가 없습니다"}>
            {projects.length ? "필터를 바꿔 보세요." : "과제 선정 관리에서 선정 결과 엑셀을 먼저 올려 주세요."}
          </EmptyState>
        </Panel>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {shown.map((p) => (
          <Panel key={p.info.prjId} flush title={`${p.info.prjId} ${p.info.prjNm}`}>
            <div className={b.tw}>
              <table className={b.tbl}>
                <thead>
                  <tr>
                    <th>요구사항</th>
                    <th>단계 · 공수 태그</th>
                    <th>담당</th>
                    <th>투입 / 기준</th>
                    <th>상태</th>
                    <th className="c">측정 완료</th>
                  </tr>
                </thead>
                <tbody>
                  {p.reqs.flatMap((r) =>
                    r.stages.map((s, i) => <Row key={s.code} info={p.info} r={r} s={s} first={i === 0} span={r.stages.length} devs={devs} />),
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

function Row({ info, r, s, first, span, devs }: { info: ProjectInfo; r: ReqVM; s: StageVM; first: boolean; span: number; devs: Dev[] }) {
  const { run, busy } = useMutate();
  const save = (patch: { ownerId?: string | null; done?: boolean }, ok: string) =>
    run(() => api(`/api/projects/${encodeURIComponent(info.prjId)}/assign`, { method: "PUT", body: { reqId: r.reqId, cd: s.cd, ...patch } }), ok);
  // 엑셀 사번이 계정에 없으면 목록에 없으므로 그 이름을 그대로 보여 준다.
  const known = !s.ownerId || devs.some((d) => d.userId === s.ownerId);
  return (
    <tr>
      {first && (
        <td rowSpan={span}>
          <b>{r.rk}</b>
          {r.name && r.name !== r.reqId && <div className={b.xs}>{r.name}</div>}
        </td>
      )}
      <td>
        {STAGE_LABEL[s.cd]}
        {s.workType && <span className={b.xs}> · {s.workType}</span>}
        <div className={b.xs}>{s.code}</div>
      </td>
      <td>
        <select
          className={b.sel}
          value={s.ownerId ?? ""}
          disabled={busy}
          onChange={(e) => save({ ownerId: e.target.value || null }, `${s.code} 담당을 바꿨습니다.`)}
          aria-label={`${s.code} 담당`}
        >
          <option value="">미지정</option>
          {!known && <option value={s.ownerId ?? ""}>{`${s.ownerNm || s.ownerId} (계정 없음)`}</option>}
          {devs.map((d) => (
            <option key={d.userId} value={d.userId}>
              {d.userNm} ({d.userId})
            </option>
          ))}
        </select>
        {!s.ownerId && <div className={`${b.xs} ${b.warn}`}>담당 미지정</div>}
      </td>
      <td style={{ minWidth: 160 }}>
        <Progress md={s.md} base={s.baseMd} />
      </td>
      <td>{STATUS_LABEL[s.status]}</td>
      <td className="c">
        <input
          type="checkbox"
          aria-label={`${s.code} 측정 완료`}
          checked={s.done}
          disabled={busy}
          onChange={(e) => {
            const done = e.target.checked;
            if (done && !window.confirm(`${s.code} 를 측정 완료로 표시합니다. 이후 이 단계는 공수를 받지 않습니다.`)) return;
            void save({ done }, done ? "측정 완료로 표시했습니다." : "측정 완료를 풀었습니다.");
          }}
        />
        {s.doneAt && <div className={b.xs}>{s.doneAt.slice(0, 10)}</div>}
      </td>
    </tr>
  );
}
