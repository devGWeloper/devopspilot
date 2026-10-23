"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import { FIELD_BY_ID } from "@/lib/projects/form";
import type { StageInput } from "@/lib/projects/service";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import type { ProjectInfo, ReqVM } from "@/lib/views";
import b from "../common/board.module.css";

export interface Dev {
  userId: string;
  userNm: string;
}

type Row = StageInput & { started: boolean };
type Pick = "difficulty" | "grade" | "baseSrc" | "fit" | "spec" | "ctx" | "gen";

// 태그마다 고르는 항목 — 선택값은 선정 현황 항목(form.ts)에서
const PICKS: [Pick, string, string][] = [
  ["grade", "등급", "REQ-05"],
  ["difficulty", "난이도", "REQ-04"],
  ["baseSrc", "공수 출처", "REQ-07"],
  ["fit", "기대효과", "FIT-06"],
  ["spec", "명세", "FIT-01"],
  ["ctx", "맥락", "FIT-02"],
  ["gen", "생성 패턴", "FIT-03"],
];

const blank = (cd: StageCd, workTypes: Record<string, string[]>): Row => ({
  cd,
  workType: workTypes[cd]?.[0] ?? "",
  ownerId: null,
  baseMd: 0,
  grade: "중급",
  difficulty: "중",
  baseSrc: "",
  fit: "",
  spec: "",
  ctx: "",
  gen: "",
  done: false,
  started: false,
});

/** Phase 1 선정 항목만 고친다 — 담당·측정 완료(Phase 2)는 공수 입력 관리 화면에서. 저장 시 그 값은 그대로 실어 보낸다. */
export function ReqDialog({ info, req, workTypes, onClose }: { info: ProjectInfo; req: ReqVM | null; workTypes: Record<string, string[]>; onClose: () => void }) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [f, setF] = useState({ reqId: req?.reqId ?? "", name: req?.name ?? "" });
  const [stages, setStages] = useState<Row[]>(
    req?.stages.map((s) => ({ cd: s.cd, workType: s.workType, ownerId: s.ownerId, baseMd: s.baseMd, grade: s.grade, difficulty: s.difficulty, baseSrc: s.baseSrc, fit: s.fit, spec: s.spec, ctx: s.ctx, gen: s.gen, done: s.done, started: s.md > 0 })) ?? [
      blank("DV", workTypes),
    ],
  );
  const [busy, setBusy] = useState(false);

  const setS = (i: number, patch: Partial<Row>) => setStages((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const free = STAGES.filter((cd) => !stages.some((s) => s.cd === cd));
  const total = stages.reduce((a, s) => a + (Number(s.baseMd) || 0), 0);
  const tag = (cd: StageCd) => `${info.prjId}-${f.reqId || "요구사항ID"}-${cd}`;

  async function save() {
    setBusy(true);
    try {
      await api(`/api/projects/${info.prjId}/reqs`, {
        body: { expectedUpdAt: info.updAt, origReqId: req?.reqId ?? null, req: { ...f, stages: stages.map(({ started: _s, ...x }) => ({ ...x, baseMd: Number(x.baseMd) })) } },
      });
      toast(req ? "요구사항을 고쳤습니다." : "요구사항을 추가했습니다.");
      router.refresh();
      onClose();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!req || !window.confirm(`${req.rk} 을(를) 삭제합니다. 입력된 공수는 남지만 집계에서 빠집니다.`)) return;
    try {
      await api(`/api/projects/${info.prjId}/reqs`, { method: "DELETE", body: { expectedUpdAt: info.updAt, reqId: req.reqId } });
      toast("요구사항을 삭제했습니다.");
      router.refresh();
      onClose();
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  return (
    <Modal
      open
      wide
      eyebrow={`${info.prjId} ${info.prjNm}`}
      title={req ? `요구사항 편집 — ${req.rk}` : "요구사항 추가"}
      onClose={onClose}
      footer={
        <>
          {req && (
            <Button variant="danger" onClick={remove} style={{ marginRight: "auto" }}>
              삭제
            </Button>
          )}
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
        <Field label="요구사항 ID" required hint={req ? "측정 중 ID 변경 불가" : "과제 안에서만 겹치지 않으면 됩니다 (예: REQ0047)"}>
          <TextInput value={f.reqId} disabled={!!req} onChange={(e) => setF({ ...f, reqId: e.target.value.trim() })} />
        </Field>
        <Field label="요구사항명" hint="선택 — 엑셀 '요구사항명' 열">
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b>SDLC 단계</b>
        <span className={b.xs}>기준 공수 합계 {f1(total)} M/D · 담당·측정 완료는 &apos;공수 입력 관리&apos;에서</span>
      </div>
      <div className={b.tw} style={{ marginTop: 6 }}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th>단계 · 공수 태그</th>
              <th>업무 유형</th>
              <th className="r">기준 공수(M/D)</th>
              {PICKS.map(([k, label]) => (
                <th key={k}>{label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i}>
                <td>
                  <select className={b.sel} value={s.cd} disabled={s.started} onChange={(e) => setS(i, { cd: e.target.value as StageCd, workType: workTypes[e.target.value]?.[0] ?? "" })}>
                    {[s.cd, ...free].map((cd) => (
                      <option key={cd} value={cd}>
                        {STAGE_LABEL[cd as StageCd]}
                      </option>
                    ))}
                  </select>
                  <div className={b.xs}>{tag(s.cd as StageCd)}</div>
                </td>
                <td>
                  <select className={b.sel} value={s.workType} onChange={(e) => setS(i, { workType: e.target.value })}>
                    <option value="">—</option>
                    {Array.from(new Set([...(workTypes[s.cd] ?? []), s.workType ?? ""]))
                      .filter(Boolean)
                      .map((w) => (
                        <option key={w}>{w}</option>
                      ))}
                  </select>
                </td>
                <td className="r">
                  <input className={b.sel} type="number" step="0.1" min="0" style={{ width: 70, textAlign: "right" }} value={s.baseMd} onChange={(e) => setS(i, { baseMd: e.target.value as unknown as number })} />
                </td>
                {PICKS.map(([k, , id]) => (
                  <td key={k}>
                    <select className={b.sel} value={s[k] ?? ""} onChange={(e) => setS(i, { [k]: e.target.value })}>
                      <option value="">—</option>
                      {Array.from(new Set([...(FIELD_BY_ID[id]?.options ?? []), s[k] ?? ""]))
                        .filter(Boolean)
                        .map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                    </select>
                  </td>
                ))}
                <td>
                  <Button size="sm" variant="ghost" disabled={s.started || stages.length === 1} title={s.started ? "공수가 입력된 단계는 지울 수 없습니다" : undefined} onClick={() => setStages((xs) => xs.filter((_, k) => k !== i))}>
                    빼기
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {free.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Button size="sm" icon="plus" onClick={() => setStages((xs) => [...xs, blank(free[0], workTypes)])}>
            단계 추가
          </Button>
        </div>
      )}
      <p className={b.xs} style={{ marginTop: 12 }}>
        등급은 인건비 단가 기준입니다. 공수가 입력된 단계는 단계를 바꾸거나 뺄 수 없습니다.
      </p>
    </Modal>
  );
}
