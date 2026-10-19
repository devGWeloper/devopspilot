"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Select, TextInput } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, download, errMessage } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import type { MetricDef } from "@/lib/measure/metrics";
import type { Settings } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES } from "@/lib/types";
import type { ProjectInfo, ReqVM, StatusVM } from "@/lib/views";
import { UsersAdmin } from "../admin/users/UsersAdmin";
import { STATUS_LABEL } from "../common/bits";
import b from "../common/board.module.css";
import { ImportDialog } from "./ImportDialog";
import { ProjectDialog } from "./ProjectDialog";
import { ReqDialog, type Dev } from "./ReqDialog";
import { SettingsForm } from "./SettingsForm";

type Tab = "prj" | "tag" | "dev" | "base" | "logic";

type Edit = { kind: "import" } | { kind: "project"; info: ProjectInfo | null } | { kind: "req"; info: ProjectInfo; req: ReqVM | null };

export interface MasterVM {
  projects: StatusVM["projects"];
  devs: Dev[];
  settings: Settings;
  metrics: MetricDef[];
}

export function MasterTabs({ vm }: { vm: MasterVM }) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [tab, setTab] = useState<Tab>("tag");
  const [edit, setEdit] = useState<Edit | null>(null);
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
        eyebrow="Admin"
        title="기준 데이터"
        description="측정 기준이 되는 과제·요구사항·개발자·단가입니다. '생산성 측정 PoC 데이터' 엑셀과 같은 구성이라 엑셀로 올리고 내려받을 수 있습니다."
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
          { key: "prj", label: "01 과제", count: vm.projects.length },
          { key: "tag", label: "02 요구사항-SDLC · 03 담당", count: tagN },
          { key: "dev", label: "03 개발자 권한" },
          { key: "base", label: "04 기준정보" },
          { key: "logic", label: "05 집계 로직" },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === "prj" && <ProjectTable vm={vm} onEdit={(info) => setEdit({ kind: "project", info })} onRemove={removeProject} />}
        {tab === "tag" && <TagTable vm={vm} onEdit={(info, req) => setEdit({ kind: "req", info, req })} />}
        {tab === "dev" && <UsersAdmin />}
        {tab === "base" && <SettingsForm initial={vm.settings} />}
        {tab === "logic" && <Logic metrics={vm.metrics} />}
      </div>

      {edit?.kind === "import" && <ImportDialog onClose={() => setEdit(null)} />}
      {edit?.kind === "project" && <ProjectDialog info={edit.info} onClose={() => setEdit(null)} />}
      {edit?.kind === "req" && <ReqDialog info={edit.info} req={edit.req} devs={vm.devs} workTypes={vm.settings.workTypes} onClose={() => setEdit(null)} />}
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
              <th className="r">태그</th>
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
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return vm.projects
      .filter((p) => !prj || p.info.prjId === prj)
      .map((p) => ({ ...p, reqs: p.reqs.filter((r) => !ql || [r.rk, r.name, ...r.stages.flatMap((s) => [s.code, s.ownerNm, s.ownerId ?? ""])].join(" ").toLowerCase().includes(ql)) }));
  }, [vm, prj, q]);
  const unmapped = vm.projects.flatMap((p) => p.reqs.flatMap((r) => r.stages.filter((s) => !s.ownerId))).length;

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <Segmented
          ariaLabel="보기"
          value={mode}
          onChange={setMode}
          options={[
            { key: "grid", label: "SDLC 단계 격자" },
            { key: "list", label: "태그 목록" },
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
        <TextInput placeholder="태그·요구사항·사번 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <span className={b.xs}>
          행 = 요구사항 × 단계 (공수 태그 = 과제 ID-요구사항 ID-단계). 담당 = &apos;03. 공수 태그 매핑&apos;의 사번 한 명
          {unmapped > 0 && (
            <>
              {" "}
              · <b className={b.warn}>담당 미지정 {unmapped}건</b>
            </>
          )}
        </span>
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
                      <th>담당 (사번)</th>
                      <th>구현 난이도</th>
                      <th>필요 등급</th>
                      <th className="r">기준 공수(M/D)</th>
                      <th>공수 출처</th>
                      <th>측정 상태</th>
                      <th>완료일</th>
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
                          <td>{s.ownerId ? `${s.ownerNm} (${s.ownerId})` : <span className={b.warn}>미지정</span>}</td>
                          <td>{s.difficulty || "—"}</td>
                          <td>{s.grade || <span className={b.warn}>없음</span>}</td>
                          <td className="r">{f1(s.baseMd)}</td>
                          <td>{s.baseSrc || "—"}</td>
                          <td>{STATUS_LABEL[s.status]}</td>
                          <td>{s.doneAt?.slice(0, 10) ?? "—"}</td>
                          <td>{s.fit || "—"}</td>
                          <td>{s.spec || "—"}</td>
                          <td>{s.ctx || "—"}</td>
                          <td>{s.gen || "—"}</td>
                        </tr>
                      )),
                    )}
                    {p.reqs.length === 0 && (
                      <tr>
                        <td colSpan={13} className="muted">
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

/** 요구사항 행 × 분석·설계·개발·테스트 열 — 단계별 기준 공수(AI 없이 했을 때의 추정)를 한눈에. 빈칸 = 측정 대상 아님 */
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
                <div className={b.xs}>기준 M/D · 담당</div>
              </th>
            ))}
            <th className="r">합계 M/D</th>
            <th>측정 상태</th>
          </tr>
        </thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.rk} style={{ cursor: "pointer" }} onClick={() => onEdit(r)} title="눌러서 단계·기준 공수·담당 편집">
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
                        <div className={b.xs}>{s.ownerId ? s.ownerNm || s.ownerId : <span className={b.warn}>담당 미지정</span>}</div>
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
              <td>{STATUS_LABEL[r.status]}</td>
            </tr>
          ))}
          {reqs.length === 0 && (
            <tr>
              <td colSpan={STAGES.length + 3} className="muted">
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
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Logic({ metrics }: { metrics: MetricDef[] }) {
  return (
    <>
      <p className={b.note} style={{ marginBottom: 8 }}>
        &apos;05. 주요 집계 로직&apos; 시트 그대로입니다. 측정 결과 화면의 숫자는 모두 이 산식으로 계산합니다(확정된 날만). 오른쪽 열은 엑셀 문구로 정해지지 않는 포털 기준입니다.
      </p>
      <div className={b.tw}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th>구분</th>
              <th>지표</th>
              <th>상세 로직 (입력 데이터.항목 기준)</th>
              <th>포털 기준</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key}>
                <td>{m.group}</td>
                <td>
                  <b>{m.name}</b>
                </td>
                <td>{m.formula}</td>
                <td className={b.xs}>{m.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
