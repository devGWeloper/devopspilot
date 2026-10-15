import { f1 } from "@/lib/format";
import type { ReqStatus } from "@/lib/measure/metrics";
import b from "./board.module.css";

export const STATUS_LABEL: Record<ReqStatus, string> = { DONE: "측정 완료", ING: "측정 중", WAIT: "측정 대기" };

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
