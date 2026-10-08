import { Callout, EmptyState } from "@/components/ui/Panel";
import { pct } from "@/lib/format";
import type { MeasureData } from "./MeasureTab";
import s from "./tab.module.css";

export function CommitSummary({ data }: { data: MeasureData }) {
  const fms = data.metrics.byFeature;
  const commits = data.input.commits;
  const v = data.check.commitViolation;
  if (!commits.length) return <EmptyState icon="file" title="올라온 커밋이 없습니다">데이터 수집 화면에서 커밋 CSV 를 올려 주세요.</EmptyState>;
  return (
    <div>
      <table className={s.mini}>
        <thead>
          <tr>
            <th>WBS-ID</th>
            <th className={s.r}>커밋</th>
            <th className={s.r}>변경 라인</th>
            <th className={s.r}>사후 수정 라인</th>
            <th className={s.r}>사후 수정률</th>
          </tr>
        </thead>
        <tbody>
          {fms.map((m) => (
            <tr key={m.feature.wbsId}>
              <td className="num">{m.feature.wbsId}</td>
              <td className={`${s.r} num`}>{commits.filter((c) => c.wbsId === m.feature.wbsId).length}</td>
              <td className={`${s.r} num`}>{m.totalLines.toLocaleString()}</td>
              <td className={`${s.r} num`} style={m.postFixLines ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
                {m.postFixLines.toLocaleString()}
              </td>
              <td className={`${s.r} num`}>{pct(m.totalLines ? m.postFixLines / m.totalLines : null, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {v.violations > 0 && (
        <div style={{ padding: 12 }}>
          <Callout tone="warn">
            WBS-ID 가 없는 커밋 {v.violations}건 ({pct(v.rate)}) — 커밋 메시지 규칙 <code>[WBS-ID] 내용</code> 을 지켜 주세요.
          </Callout>
        </div>
      )}
      <p className={s.gridNote}>사후 수정 = 기능 완료일 다음 날부터 {data.input.settings.postFixDays}일 안에 같은 WBS-ID 로 들어온 커밋.</p>
    </div>
  );
}
