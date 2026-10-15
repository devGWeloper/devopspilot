"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, download, errMessage } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import type { ReqStatus } from "@/lib/measure/metrics";
import { STAGE_LABEL, type PrjKind } from "@/lib/types";
import type { ProjectInfo, ReqVM, StatusVM } from "@/lib/views";
import { Progress, StageAxis, StageBar, StageLegend, STATUS_LABEL, StatusText } from "../common/bits";
import b from "../common/board.module.css";
import { ImportDialog } from "./ImportDialog";
import { ProjectDialog } from "./ProjectDialog";
import { ReqDialog } from "./ReqDialog";

/** 양식 항목 ID → 이름 (엑셀 '항목정의' 시트) */
const ITEM: Record<string, string> = {
  "AIS-01": "LLM 구분",
  "AIS-02": "AI 도구",
  "AIS-03": "필요 계정 수",
  "AIS-04": "LLM 모델",
  "AIS-05": "요금제",
  "AIS-06": "예상 토큰량",
  "FIT-01": "명세 명확성",
  "FIT-02": "맥락 주입 가능성",
  "FIT-03": "생성 패턴",
  "FIT-04": "평가자",
  "FIT-05": "참고 등급",
  "FIT-06": "예상 기대효과",
  "FIT-07": "판단 사유",
  "REF-01": "참여 인력",
  "REF-02": "AI 활용 개발 경험",
  "REF-03": "AI 인증 등급",
  "REF-04": "비고",
};

export interface Dev {
  userId: string;
  userNm: string;
}

type Edit =
  | { kind: "import" }
  | { kind: "project"; info: ProjectInfo | null }
  | { kind: "req"; info: ProjectInfo; req: ReqVM | null };

export function StatusBoard({ vm, canManage, devs, workTypes }: { vm: StatusVM; canManage: boolean; devs: Dev[]; workTypes: Record<string, string[]> }) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [st, setSt] = useState<ReqStatus | "">("");
  const [kind, setKind] = useState<PrjKind | "">("");
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);

  const all = vm.projects.flatMap((p) => p.reqs);
  const count = (s: ReqStatus) => all.filter((r) => r.status === s).length;
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return vm.projects
      .filter((p) => !kind || p.info.kind === kind)
      .map((p) => ({
        ...p,
        shown: p.reqs.filter(
          (r) =>
            (!st || r.status === st) &&
            (!ql || [r.reqId, r.name, p.info.prjNm, p.info.sysNm, p.info.teamNm, ...r.stages.map((s) => s.ownerNm + s.workType)].join(" ").toLowerCase().includes(ql)),
        ),
      }))
      .filter((p) => p.shown.length > 0 || (canManage && !st && !ql));
  }, [vm, st, kind, q, canManage]);

  async function removeProject(info: ProjectInfo) {
    if (!window.confirm(`'${info.prjNm}' 과제와 요구사항을 삭제합니다. 입력된 공수는 남지만 화면에서 사라집니다.`)) return;
    try {
      await api(`/api/projects/${info.prjId}`, { method: "DELETE" });
      toast("과제를 삭제했습니다.");
      router.refresh();
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  let no = 0;
  return (
    <>
      <div className={b.head}>
        <div>
          <h1 className={b.title}>PoC 과제 현황</h1>
          <span className={b.note}>선정된 과제·요구사항과 측정 진척 · {canManage ? "엑셀 양식으로 올리거나 직접 입력" : "조회 전용"}</span>
        </div>
        {canManage && (
          <div className={b.acts}>
            <Button variant="primary" icon="upload" onClick={() => setEdit({ kind: "import" })}>
              엑셀 올리기
            </Button>
            <Button icon="download" onClick={() => download("/api/projects/template", "과제선정_양식.xlsx").catch((e) => toastError(errMessage(e)))}>
              양식 내려받기
            </Button>
            <Button icon="plus" onClick={() => setEdit({ kind: "project", info: null })}>
              과제 추가
            </Button>
          </div>
        )}
      </div>

      <div className={b.filters}>
        <div className={b.seg}>
          <button aria-pressed={!st} onClick={() => setSt("")}>
            전체 <b>{all.length}</b>
          </button>
          {(["DONE", "ING", "WAIT"] as ReqStatus[]).map((s) => (
            <button key={s} aria-pressed={st === s} onClick={() => setSt(s)}>
              {STATUS_LABEL[s]} <b>{count(s)}</b>
            </button>
          ))}
        </div>
        <select className={b.sel} value={kind} onChange={(e) => setKind(e.target.value as PrjKind | "")} aria-label="구분">
          <option value="">개발·운영 전체</option>
          <option value="개발">개발 과제</option>
          <option value="운영">운영 과제</option>
        </select>
        <input className={b.sel} placeholder="과제·요구사항·담당자 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <span style={{ marginLeft: "auto" }}>
          <StageLegend />
        </span>
      </div>

      <div className={b.tw}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th style={{ width: 36 }}>No</th>
              <th style={{ minWidth: 260 }}>과제 → 요구사항 · 투입 / 기준</th>
              <th>
                <StageAxis />
              </th>
              <th>난이도</th>
              <th>등급</th>
              <th className="r">기준 M/D</th>
              <th>출처</th>
              <th style={{ minWidth: 280 }}>단계별 업무 유형 · 담당 · 기준</th>
              {canManage && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 24, textAlign: "center" }}>
                  {vm.projects.length ? "조건에 맞는 요구사항이 없습니다." : canManage ? "아직 과제가 없습니다. 엑셀 양식을 올려 주세요." : "볼 수 있는 과제가 없습니다."}
                </td>
              </tr>
            )}
            {rows.map((p, pi) => {
              const cl = closed.has(p.info.prjId);
              const toggle = () =>
                setClosed((s) => {
                  const n = new Set(s);
                  if (n.has(p.info.prjId)) n.delete(p.info.prjId);
                  else n.add(p.info.prjId);
                  return n;
                });
              return (
                <Fragment key={p.info.prjId}>
                  <tr className={b.grp}>
                    <td>{String.fromCharCode(65 + (pi % 26))}</td>
                    <td colSpan={canManage ? 7 : 8} style={{ cursor: "pointer" }} onClick={toggle}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span>
                          {cl ? "▸" : "▾"} {p.info.prjNm} <span className={b.pill}>{p.info.kind}</span>
                        </span>
                        <span className={b.xs} style={{ fontWeight: 400 }}>
                          {[p.info.sysNm, p.info.deptCd && `담당 ${p.info.deptCd}`, p.info.teamNm, p.info.pmNm && `PM ${p.info.pmNm}`, p.info.axTeam, p.info.sysGrade, p.info.deployType, p.info.area]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", fontWeight: 400, minWidth: 260 }}>
                          <span className={b.xs}>
                            완료 {p.doneN}/{p.reqs.length}
                          </span>
                          <Progress md={p.md} base={p.baseMd} />
                        </span>
                      </div>
                    </td>
                    {canManage && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Button size="sm" variant="ghost" onClick={() => setEdit({ kind: "req", info: p.info, req: null })}>
                          + 요구사항
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEdit({ kind: "project", info: p.info })}>
                          수정
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeProject(p.info)}>
                          삭제
                        </Button>
                      </td>
                    )}
                  </tr>
                  {!cl &&
                    p.shown.map((r) => {
                      no++;
                      const extras = Object.entries(r.extra);
                      const isOpen = open === r.reqId;
                      return (
                        <Fragment key={r.reqId}>
                          <tr>
                            <td className="num">{no}</td>
                            <td>
                              <div className={b.small} style={{ marginBottom: 4 }}>
                                <span className={b.mono} style={{ color: "var(--muted)" }}>
                                  {r.reqId}
                                </span>{" "}
                                <b>{r.name}</b>{" "}
                                {extras.length > 0 && (
                                  <button className={b.lnk} onClick={() => setOpen(isOpen ? null : r.reqId)}>
                                    {isOpen ? "양식 항목 접기" : "양식 항목"}
                                  </button>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <StatusText s={r.status} />
                                <Progress md={r.md} base={r.baseMd} />
                              </div>
                            </td>
                            <td>
                              <StageBar stages={r.stages} />
                            </td>
                            <td>{r.difficulty || "—"}</td>
                            <td>{r.grade || "—"}</td>
                            <td className="r">{f1(r.baseMd)}</td>
                            <td className={b.small}>{r.baseSrc || "—"}</td>
                            <td className={b.small}>
                              {r.stages.map((s) => (
                                <div key={s.cd}>
                                  <b>{STAGE_LABEL[s.cd]}</b> {s.workType || "—"} · {s.ownerId ? s.ownerNm : <span className={b.warn}>{s.ownerNm} (계정 없음)</span>} · {f1(s.baseMd)} M/D
                                </div>
                              ))}
                            </td>
                            {canManage && (
                              <td>
                                <Button size="sm" variant="ghost" onClick={() => setEdit({ kind: "req", info: p.info, req: r })}>
                                  편집
                                </Button>
                              </td>
                            )}
                          </tr>
                          {isOpen && (
                            <tr>
                              <td />
                              <td colSpan={canManage ? 8 : 7}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "4px 16px" }} className={b.small}>
                                  {extras.map(([k, v]) => (
                                    <div key={k}>
                                      <span className={b.xs}>
                                        {k} {ITEM[k] ?? ""}
                                      </span>
                                      <div>{v}</div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit?.kind === "import" && <ImportDialog onClose={() => setEdit(null)} />}
      {edit?.kind === "project" && <ProjectDialog info={edit.info} onClose={() => setEdit(null)} />}
      {edit?.kind === "req" && <ReqDialog info={edit.info} req={edit.req} devs={devs} workTypes={workTypes} onClose={() => setEdit(null)} />}
    </>
  );
}
