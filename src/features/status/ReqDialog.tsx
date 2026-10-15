"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import type { ReqInput } from "@/lib/projects/service";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import type { ProjectInfo, ReqVM } from "@/lib/views";
import b from "../common/board.module.css";
import type { Dev } from "./StatusBoard";

const DIFF = ["상", "중", "하"];
const GRADES = ["특급", "고급", "중급", "초급"];
const SRC = ["WBS 실적", "공수 산정서", "담당자 추정"];

type StageRow = ReqInput["stages"][number] & { started: boolean };

export function ReqDialog({
  info,
  req,
  devs,
  workTypes,
  onClose,
}: {
  info: ProjectInfo;
  req: ReqVM | null;
  devs: Dev[];
  workTypes: Record<string, string[]>;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [f, setF] = useState({
    reqId: req?.reqId ?? "",
    name: req?.name ?? "",
    difficulty: req?.difficulty ?? "중",
    grade: req?.grade ?? "중급",
    baseSrc: req?.baseSrc ?? "WBS 실적",
    done: req?.done ?? false,
  });
  const [stages, setStages] = useState<StageRow[]>(
    req?.stages.map((s) => ({ cd: s.cd, workType: s.workType, ownerId: s.ownerId, baseMd: s.baseMd, started: s.md > 0 })) ?? [
      { cd: "DV", workType: workTypes.DV?.[0] ?? "", ownerId: null, baseMd: 1, started: false },
    ],
  );
  const [busy, setBusy] = useState(false);

  const setS = (i: number, patch: Partial<StageRow>) => setStages((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const free = STAGES.filter((cd) => !stages.some((s) => s.cd === cd));
  const total = stages.reduce((a, s) => a + (Number(s.baseMd) || 0), 0);

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
    if (!req || !window.confirm(`${req.reqId} 을(를) 삭제합니다. 입력된 공수는 남지만 집계에서 빠집니다.`)) return;
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
      eyebrow={info.prjNm}
      title={req ? `요구사항 편집 — ${req.reqId}` : "요구사항 추가"}
      onClose={onClose}
      footer={
        <>
          {req && (
            <Button variant="danger" onClick={remove} className="" style={{ marginRight: "auto" }}>
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
        <Field label="요구사항 ID (REQ-01)" required hint={req ? "측정 중 ID 변경 불가" : "작업관리 도구의 번호"}>
          <TextInput value={f.reqId} disabled={!!req} onChange={(e) => setF({ ...f, reqId: e.target.value.trim() })} />
        </Field>
        <Field label="요구사항명 (REQ-02)" required>
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
        <Field label="구현 난이도 (REQ-04)">
          <Select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
            {DIFF.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label="필요 개발자 등급 (REQ-05)" hint="M/D 단가 기준">
          <Select value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}>
            {GRADES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label="공수 출처 (REQ-07)">
          <Select value={f.baseSrc} onChange={(e) => setF({ ...f, baseSrc: e.target.value })}>
            {SRC.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b>SDLC 단계</b>
        <span className={b.xs}>단계마다 업무 유형·담당·기준 M/D · 합계 = 요구사항 기준 공수 {f1(total)} M/D</span>
      </div>
      <div className={b.tw} style={{ marginTop: 6 }}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th>단계</th>
              <th>업무 유형</th>
              <th>담당</th>
              <th className="r">기준 M/D</th>
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
                </td>
                <td>
                  <select className={b.sel} value={s.workType} onChange={(e) => setS(i, { workType: e.target.value })}>
                    {Array.from(new Set([...(workTypes[s.cd] ?? []), s.workType]))
                      .filter(Boolean)
                      .map((w) => (
                        <option key={w}>{w}</option>
                      ))}
                  </select>
                </td>
                <td>
                  <select className={b.sel} value={s.ownerId ?? ""} onChange={(e) => setS(i, { ownerId: e.target.value || null })}>
                    <option value="">미지정</option>
                    {devs.map((d) => (
                      <option key={d.userId} value={d.userId}>
                        {d.userNm} ({d.userId})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="r">
                  <input className={b.sel} type="number" step="0.1" min="0" style={{ width: 80, textAlign: "right" }} value={s.baseMd} onChange={(e) => setS(i, { baseMd: e.target.value as unknown as number })} />
                </td>
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
          <Button size="sm" icon="plus" onClick={() => setStages((xs) => [...xs, { cd: free[0], workType: workTypes[free[0]]?.[0] ?? "", ownerId: null, baseMd: 0, started: false }])}>
            단계 추가
          </Button>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <Checkbox label="측정 완료 — 측정 결과 대시보드에 집계하고, 더 이상 공수를 받지 않습니다." checked={f.done} onChange={(e) => setF({ ...f, done: e.target.checked })} />
      </div>
    </Modal>
  );
}
