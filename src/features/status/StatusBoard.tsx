"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, type Tone } from "@/components/ui/Chip";
import { TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, download, errMessage } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import type { ReqStatus } from "@/lib/measure/metrics";
import { STAGE_LABEL } from "@/lib/types";
import type { ProjectInfo, ReqVM, StatusVM } from "@/lib/views";
import { Progress, STATUS_LABEL } from "../common/bits";
import { ImportDialog } from "./ImportDialog";
import { ProjectDialog } from "./ProjectDialog";
import { ReqDialog } from "./ReqDialog";
import st from "./status.module.css";

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

const ST_TONE: Record<ReqStatus, Tone> = { DONE: "accent", ING: "outline", WAIT: "neutral" };

export interface Dev {
  userId: string;
  userNm: string;
}

type Edit =
  | { kind: "import" }
  | { kind: "project"; info: ProjectInfo | null }
  | { kind: "req"; info: ProjectInfo; req: ReqVM | null }
  | { kind: "view"; info: ProjectInfo; req: ReqVM };

type Filter = "ALL" | ReqStatus;

export function StatusBoard({ vm, canManage, devs, workTypes }: { vm: StatusVM; canManage: boolean; devs: Dev[]; workTypes: Record<string, string[]> }) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [f, setF] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"ALL" | "개발" | "운영">("ALL");
  const [edit, setEdit] = useState<Edit | null>(null);

  const all = vm.projects.flatMap((p) => p.reqs);
  const count = (s: ReqStatus) => all.filter((r) => r.status === s).length;
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return vm.projects
      .filter((p) => kind === "ALL" || p.info.kind === kind)
      .map((p) => ({
        ...p,
        rows: p.reqs.filter(
          (r) => (f === "ALL" || r.status === f) && (!ql || [p.info.prjNm, p.info.sysNm, r.reqId, r.name, ...r.stages.map((x) => x.ownerNm)].join(" ").toLowerCase().includes(ql)),
        ),
      }))
      .filter((p) => p.rows.length > 0 || (canManage && f === "ALL" && !ql));
  }, [vm, f, q, kind, canManage]);

  async function removeProject(info: ProjectInfo) {
    if (!window.confirm(`'${info.prjNm}' 과제와 요구사항을 삭제합니다.`)) return;
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
        eyebrow="Phase 1 결과"
        title="과제 현황"
        description={canManage ? "선정된 과제와 요구사항입니다. 엑셀 양식으로 올리고, 요구사항을 눌러 단계·담당을 정합니다." : "선정된 과제와 요구사항, 측정 진척입니다. 요구사항을 누르면 상세를 볼 수 있습니다."}
        actions={
          canManage && (
            <>
              <Button icon="download" onClick={() => download("/api/projects/template", "과제선정_양식.xlsx").catch((e) => toastError(errMessage(e)))}>
                양식 내려받기
              </Button>
              <Button icon="plus" onClick={() => setEdit({ kind: "project", info: null })}>
                과제 추가
              </Button>
              <Button variant="primary" icon="upload" onClick={() => setEdit({ kind: "import" })}>
                엑셀 올리기
              </Button>
            </>
          )
        }
      >
        <div className={st.kpis}>
          <KpiTile label="과제" value={vm.projects.length} unit="건" />
          <KpiTile label="요구사항" value={all.length} unit="건" />
          <KpiTile label="측정 완료" value={count("DONE")} unit="건" />
          <KpiTile label="측정 중" value={count("ING")} unit="건" />
          <KpiTile label="측정 대기" value={count("WAIT")} unit="건" />
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
        <Segmented
          ariaLabel="구분"
          value={kind}
          onChange={setKind}
          options={[
            { key: "ALL", label: "개발·운영" },
            { key: "개발", label: "개발" },
            { key: "운영", label: "운영" },
          ]}
        />
        <TextInput placeholder="과제·요구사항·담당자 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
      </div>

      {shown.length === 0 && (
        <Panel>
          <EmptyState title={vm.projects.length ? "조건에 맞는 요구사항이 없습니다" : "아직 과제가 없습니다"}>{canManage && !vm.projects.length ? "오른쪽 위 '엑셀 올리기'로 선정 양식을 올려 주세요." : undefined}</EmptyState>
        </Panel>
      )}

      <div className={st.list}>
        {shown.map((p) => (
          <Panel
            key={p.info.prjId}
            flush
            title={
              <span className={st.ptitle}>
                {p.info.prjNm} <Chip tone="outline">{p.info.kind}</Chip>
              </span>
            }
            actions={
              <>
                <span className={st.pprog}>
                  <span className="subtle">
                    완료 {p.doneN}/{p.reqs.length}
                  </span>
                  <Progress md={p.md} base={p.baseMd} />
                </span>
                {canManage && (
                  <>
                    <Button size="sm" variant="ghost" icon="plus" onClick={() => setEdit({ kind: "req", info: p.info, req: null })}>
                      요구사항
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ kind: "project", info: p.info })}>
                      수정
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeProject(p.info)}>
                      삭제
                    </Button>
                  </>
                )}
              </>
            }
          >
            <div className={st.pmeta}>{[p.info.sysNm, p.info.deptCd, p.info.teamNm, p.info.pmNm && `PM ${p.info.pmNm}`, p.info.axTeam].filter(Boolean).join(" · ") || "—"}</div>
            {p.rows.length === 0 ? (
              <div className={st.pmeta}>요구사항이 없습니다. &apos;+ 요구사항&apos;으로 추가하세요.</div>
            ) : (
              <table className={st.table}>
                <thead>
                  <tr>
                    <th>요구사항</th>
                    <th style={{ width: 110 }}>난이도 · 등급</th>
                    <th>단계 · 담당</th>
                    <th style={{ width: 260 }}>투입 / 기준</th>
                    <th style={{ width: 100 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((r) => (
                    <tr key={r.reqId} className={st.row} onClick={() => setEdit(canManage ? { kind: "req", info: p.info, req: r } : { kind: "view", info: p.info, req: r })}>
                      <td>
                        <b>{r.name}</b>
                        <div className={st.sub}>{r.reqId}</div>
                      </td>
                      <td className={st.sub}>
                        {r.difficulty || "—"} · {r.grade || "—"}
                      </td>
                      <td>
                        <div className={st.stages}>
                          {r.stages.map((x) => (
                            <span key={x.cd} className={st.stage} title={`${x.workType} · 기준 ${f1(x.baseMd)} M/D`}>
                              {STAGE_LABEL[x.cd]} <b>{x.ownerId ? x.ownerNm : <span className={st.warn}>{x.ownerNm} (계정 없음)</span>}</b>
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

      {edit?.kind === "import" && <ImportDialog onClose={() => setEdit(null)} />}
      {edit?.kind === "project" && <ProjectDialog info={edit.info} onClose={() => setEdit(null)} />}
      {edit?.kind === "req" && <ReqDialog info={edit.info} req={edit.req} devs={devs} workTypes={workTypes} onClose={() => setEdit(null)} />}
      {edit?.kind === "view" && <ReqView info={edit.info} req={edit.req} onClose={() => setEdit(null)} />}
    </>
  );
}

function ReqView({ info, req, onClose }: { info: ProjectInfo; req: ReqVM; onClose: () => void }) {
  const extras = Object.entries(req.extra);
  return (
    <Modal open wide eyebrow={info.prjNm} title={`${req.reqId} ${req.name}`} onClose={onClose} footer={<Button onClick={onClose}>닫기</Button>}>
      <div className={st.facts}>
        <div>
          <span className="subtle">구현 난이도</span>
          <b>{req.difficulty || "—"}</b>
        </div>
        <div>
          <span className="subtle">필요 개발자 등급</span>
          <b>{req.grade || "—"}</b>
        </div>
        <div>
          <span className="subtle">기준 공수</span>
          <b>{f1(req.baseMd)} M/D</b>
        </div>
        <div>
          <span className="subtle">공수 출처</span>
          <b>{req.baseSrc || "—"}</b>
        </div>
      </div>
      <table className={st.table} style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>단계</th>
            <th>업무 유형</th>
            <th>담당</th>
            <th>투입 / 기준</th>
          </tr>
        </thead>
        <tbody>
          {req.stages.map((x) => (
            <tr key={x.cd}>
              <td>{STAGE_LABEL[x.cd]}</td>
              <td>{x.workType || "—"}</td>
              <td>{x.ownerNm}</td>
              <td>
                <Progress md={x.md} base={x.baseMd} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {extras.length > 0 && (
        <>
          <h3 className="h2" style={{ margin: "20px 0 8px", fontSize: 14 }}>
            선정 양식 항목
          </h3>
          <div className={st.extras}>
            {extras.map(([k, v]) => (
              <div key={k}>
                <span className="subtle">{ITEM[k] ?? k}</span>
                <div>{v}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
