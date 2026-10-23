"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select, TextInput } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, download, errMessage } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import type { Settings } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES } from "@/lib/types";
import type { ProjectInfo, ReqVM, StatusVM } from "@/lib/views";
import b from "../common/board.module.css";
import { ImportDialog } from "./ImportDialog";
import { ProjectDialog } from "./ProjectDialog";
import { ReqDialog } from "./ReqDialog";

type Tab = "prj" | "tag";

type Edit = { kind: "import" } | { kind: "project"; info: ProjectInfo | null } | { kind: "req"; info: ProjectInfo; req: ReqVM | null };

export interface MasterVM {
  projects: StatusVM["projects"];
  /** 요구사항 편집 창의 단계별 업무 유형 목록 */
  workTypes: Settings["workTypes"];
}

export function MasterTabs({ vm, openImport = false }: { vm: MasterVM; openImport?: boolean }) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [tab, setTab] = useState<Tab>("tag");
  // 과제 선정 현황의 '엑셀 올리기'로 들어오면 바로 올리기 창을 연다.
  const [edit, setEdit] = useState<Edit | null>(openImport ? { kind: "import" } : null);
  const tagN = vm.projects.reduce((a, p) => a + p.reqs.reduce((x, r) => x + r.stages.length, 0), 0);

  async function removeProject(info: ProjectInfo) {
    if (!window.confirm(`'${info.prjId} ${info.prjNm}' 과제와 요구사항을 삭제합니다.`)) return;
    try {
      await api(`/api/projects/${info.prjId}`, { method: "DELETE" });
      toast("과제를 삭제했습니다.");
      router.refresh();
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Phase 1 · 관리"
        title="과제 선정 관리"
        description={
          <>
            취합한 과제 선정 결과(과제 · 요구사항 × 단계 · AI 적합도 · 기준 공수)입니다. 엑셀로 올리면 과제 선정 현황에 바로 반영되고, 일부는 아래 표에서 고칩니다. 같은 엑셀의 담당 매핑·개발자·단가 시트도 함께 반영되며, 따로 고칠 땐{" "}
            <Link href="/assign">공수 입력 관리</Link> · <Link href="/users">사용자 관리</Link> · <Link href="/settings">단가·기준정보</Link>에서 합니다.
          </>
        }
        actions={
          <>
            <Button icon="download" onClick={() => download("/api/master/export", "생산성 측정 PoC 데이터.xlsx").catch((e) => toastError(errMessage(e)))}>
              엑셀 내려받기
            </Button>
            <Button variant="primary" icon="upload" onClick={() => setEdit({ kind: "import" })}>
              엑셀 올리기
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "tag", label: "요구사항 × 단계", count: tagN },
          { key: "prj", label: "과제", count: vm.projects.length },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === "prj" && <ProjectTable vm={vm} onEdit={(info) => setEdit({ kind: "project", info })} onRemove={removeProject} />}
        {tab === "tag" && <TagTable vm={vm} onEdit={(info, req) => setEdit({ kind: "req", info, req })} />}
      </div>

      {edit?.kind === "import" && <ImportDialog onClose={() => setEdit(null)} />}
      {edit?.kind === "project" && <ProjectDialog info={edit.info} onClose={() => setEdit(null)} />}
      {edit?.kind === "req" && <ReqDialog info={edit.info} req={edit.req} workTypes={vm.workTypes} onClose={() => setEdit(null)} />}
    </>
  );
}

function ProjectTable({ vm, onEdit, onRemove }: { vm: MasterVM; onEdit: (info: ProjectInfo | null) => void; onRemove: (info: ProjectInfo) => void }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <Button icon="plus" onClick={() => onEdit(null)}>
          과제 추가
        </Button>
      </div>
      <div className={b.tw}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th>과제 ID</th>
              <th>하이닉스 과제명</th>
              <th>PROMIS</th>
              <th>대상 시스템</th>
              <th>하이닉스 담당 · 팀</th>
              <th>SK AX 본부 · 팀</th>
              <th>PM</th>
              <th>등급</th>
              <th>배포 · 영역</th>
              <th>버전 · 작업 관리</th>
              <th className="r">단계 수</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vm.projects.map(({ info, reqs }) => (
              <tr key={info.prjId}>
                <td>
                  <b>{info.prjId}</b>
                </td>
                <td>{info.prjNm}</td>
                <td>{info.promisCd || "—"}</td>
                <td>{info.sysNm || "—"}</td>
                <td>{[info.deptCd, info.teamNm].filter(Boolean).join(" · ") || "—"}</td>
                <td>{[info.axHq, info.axTeam].filter(Boolean).join(" · ") || "—"}</td>
                <td>{info.pmNm || "—"}</td>
                <td>{info.sysGrade || "—"}</td>
                <td className={b.xs}>{[info.deployType, info.area].filter(Boolean).join(" · ") || "—"}</td>
                <td className={b.xs}>{[info.vcs, info.pms].filter(Boolean).join(" · ") || "—"}</td>
                <td className="r">{reqs.reduce((a, r) => a + r.stages.length, 0)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(info)}>
                    수정
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onRemove(info)}>
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
            {vm.projects.length === 0 && (
              <tr>
                <td colSpan={13} className="muted">
                  과제가 없습니다. &apos;엑셀 올리기&apos; 또는 &apos;과제 추가&apos;로 넣어 주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TagTable({ vm, onEdit }: { vm: MasterVM; onEdit: (info: ProjectInfo, req: ReqVM | null) => void }) {
  const [prj, setPrj] = useState("");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const dq = useDeferredValue(q);
  const shown = useMemo(() => {
    const ql = dq.trim().toLowerCase();
    return vm.projects
      .filter((p) => !prj || p.info.prjId === prj)
      .map((p) => ({ ...p, reqs: p.reqs.filter((r) => !ql || [r.rk, r.name, ...r.stages.map((s) => s.code)].join(" ").toLowerCase().includes(ql)) }));
  }, [vm, prj, dq]);

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <Segmented
          ariaLabel="보기"
          value={mode}
          onChange={setMode}
          options={[
            { key: "grid", label: "단계별 기준 공수" },
            { key: "list", label: "선정 항목 전체" },
          ]}
        />
        <Select value={prj} onChange={(e) => setPrj(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">과제 전체</option>
          {vm.projects.map((p) => (
            <option key={p.info.prjId} value={p.info.prjId}>
              {p.info.prjId} {p.info.prjNm}
            </option>
          ))}
        </Select>
        <TextInput placeholder="공수 태그·요구사항 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <span className={b.xs}>행 = 요구사항 × 단계 (공수 태그 = 과제 ID-요구사항 ID-단계). 기준 공수 = AI 없이 했을 때의 추정(M/D)</span>
      </div>
      {shown.length === 0 && (
        <Panel>
          <EmptyState title="과제가 없습니다">01 과제 탭에서 과제를 먼저 넣어 주세요.</EmptyState>
        </Panel>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {shown.map((p) => (
          <Panel
            key={p.info.prjId}
            flush
            title={
              <span>
                {p.info.prjId} {p.info.prjNm}
              </span>
            }
            actions={
              <Button size="sm" variant="ghost" icon="plus" onClick={() => onEdit(p.info, null)}>
                요구사항
              </Button>
            }
          >
            {mode === "grid" ? (
              <StageGrid reqs={p.reqs} onEdit={(r) => onEdit(p.info, r)} />
            ) : (
              <div className={b.tw}>
                <table className={b.tbl}>
                  <thead>
                    <tr>
                      <th>공수 태그</th>
                      <th>단계</th>
                      <th>업무 유형</th>
                      <th>구현 난이도</th>
                      <th>필요 등급</th>
                      <th className="r">기준 공수(M/D)</th>
                      <th>공수 출처</th>
                      <th>기대효과</th>
                      <th>명세</th>
                      <th>맥락</th>
                      <th>생성 패턴</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.reqs.flatMap((r) =>
                      r.stages.map((s, i) => (
                        <tr key={s.code} style={{ cursor: "pointer" }} onClick={() => onEdit(p.info, r)} title="눌러서 요구사항 편집">
                          <td>
                            <b>{s.code}</b>
                            {i === 0 && r.name && r.name !== r.reqId && <div className={b.xs}>{r.name}</div>}
                          </td>
                          <td>{STAGE_LABEL[s.cd]}</td>
                          <td>{s.workType || "—"}</td>
                          <td>{s.difficulty || "—"}</td>
                          <td>{s.grade || <span className={b.warn}>없음</span>}</td>
                          <td className="r">{f1(s.baseMd)}</td>
                          <td>{s.baseSrc || "—"}</td>
                          <td>{s.fit || "—"}</td>
                          <td>{s.spec || "—"}</td>
                          <td>{s.ctx || "—"}</td>
                          <td>{s.gen || "—"}</td>
                        </tr>
                      )),
                    )}
                    {p.reqs.length === 0 && (
                      <tr>
                        <td colSpan={11} className="muted">
                          요구사항이 없습니다. &apos;+ 요구사항&apos;으로 추가하세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}

/** 요구사항 행 × 분석·설계·개발·테스트 열 — 단계별 기준 공수(AI 없이 했을 때의 추정)를 한눈에. 빈칸 = 선정되지 않은 단계 */
function StageGrid({ reqs, onEdit }: { reqs: ReqVM[]; onEdit: (r: ReqVM) => void }) {
  const colSum = (cd: string) => reqs.reduce((a, r) => a + (r.stages.find((s) => s.cd === cd)?.baseMd ?? 0), 0);
  return (
    <div className={b.tw}>
      <table className={b.tbl}>
        <thead>
          <tr>
            <th>요구사항</th>
            {STAGES.map((cd) => (
              <th key={cd} className="r">
                {STAGE_LABEL[cd]}
                <div className={b.xs}>기준 공수(M/D) · 등급</div>
              </th>
            ))}
            <th className="r">합계 M/D</th>
          </tr>
        </thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.rk} style={{ cursor: "pointer" }} onClick={() => onEdit(r)} title="눌러서 단계·선정 항목 편집">
              <td>
                <b>{r.rk}</b>
                {r.name && r.name !== r.reqId && <div className={b.xs}>{r.name}</div>}
              </td>
              {STAGES.map((cd) => {
                const s = r.stages.find((x) => x.cd === cd);
                return (
                  <td key={cd} className="r">
                    {s ? (
                      <>
                        <b className="num">{f1(s.baseMd)}</b>
                        <div className={b.xs}>{s.grade || "—"}</div>
                      </>
                    ) : (
                      <span className={b.xs}>—</span>
                    )}
                  </td>
                );
              })}
              <td className="r">
                <b className="num">{f1(r.baseMd)}</b>
              </td>
            </tr>
          ))}
          {reqs.length === 0 && (
            <tr>
              <td colSpan={STAGES.length + 2} className="muted">
                요구사항이 없습니다. &apos;+ 요구사항&apos;으로 추가하세요.
              </td>
            </tr>
          )}
          {reqs.length > 1 && (
            <tr>
              <td>
                <b>합계</b>
              </td>
              {STAGES.map((cd) => (
                <td key={cd} className="r num">
                  {f1(colSum(cd))}
                </td>
              ))}
              <td className="r num">
                <b>{f1(reqs.reduce((a, r) => a + r.baseMd, 0))}</b>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
