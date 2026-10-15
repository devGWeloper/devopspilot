import { f1 } from "@/lib/format";
import type { ReqStatus } from "@/lib/measure/metrics";
import { STAGE_LABEL, STAGES } from "@/lib/types";
import type { StageVM } from "@/lib/views";
import b from "./board.module.css";

export const STATUS_LABEL: Record<ReqStatus, string> = { DONE: "측정 완료", ING: "측정 중", WAIT: "측정 대기" };
const STAGE_ST: Record<ReqStatus, string> = { DONE: "완료", ING: "진행 중", WAIT: "대기" };

export function StatusText({ s }: { s: ReqStatus }) {
  return <span className={`${b.st} ${b[s]}`}>{STATUS_LABEL[s]}</span>;
}

/** 분석~운영 6칸. 칸 색 = 단계 상태, 점선 = 측정 대상 아님, 흐림 = 다른 담당자 */
export function StageBar({ stages, mine }: { stages: StageVM[]; mine?: string }) {
  return (
    <div className={b.sbar}>
      {STAGES.map((cd) => {
        const s = stages.find((x) => x.cd === cd);
        if (!s) return <i key={cd} className={b.off} title={`${STAGE_LABEL[cd]} · 측정 대상 아님`} />;
        return (
          <i
            key={cd}
            className={`${b[s.status]} ${mine && s.ownerId !== mine ? b.oth : ""}`}
            title={`${STAGE_LABEL[cd]} · ${s.workType}\n담당 ${s.ownerNm} · 기준 ${f1(s.baseMd)} M/D · 투입 ${f1(s.md)} · ${STAGE_ST[s.status]}`}
          />
        );
      })}
    </div>
  );
}

export function StageAxis() {
  return (
    <div className={b.saxis}>
      {STAGES.map((cd) => (
        <span key={cd}>{STAGE_LABEL[cd]}</span>
      ))}
    </div>
  );
}

export function StageLegend() {
  return (
    <div className={b.sleg}>
      <span>
        <i style={{ background: "var(--ink)" }} />
        완료
      </span>
      <span>
        <i style={{ background: "var(--muted)" }} />
        진행 중
      </span>
      <span>
        <i style={{ background: "var(--line-strong)" }} />
        대기
      </span>
      <span>
        <i style={{ border: "1px dashed var(--line)" }} />
        측정 대상 아님
      </span>
    </div>
  );
}

/** 투입 / 기준 M/D — 기준을 넘으면 빨간 막대 */
export function Progress({ md, base }: { md: number; base: number }) {
  const r = base > 0 ? md / base : 0;
  return (
    <div className={b.prog} title={`투입 ${f1(md)} / 기준 ${f1(base)} M/D`}>
      <div className={b.hbar}>
        <i className={r > 1 ? b.over : ""} style={{ width: `${Math.min(100, r * 100)}%` }} />
      </div>
      <span className="num" style={{ whiteSpace: "nowrap" }}>
        {f1(md)} / {f1(base)} M/D
      </span>
    </div>
  );
}
