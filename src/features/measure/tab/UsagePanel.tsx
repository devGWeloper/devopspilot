"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip } from "@/components/ui/Chip";
import { Callout, EmptyState } from "@/components/ui/Panel";
import { won } from "@/lib/format";
import { aiCostOf } from "@/lib/measure/metrics";
import type { MeasureData } from "./MeasureTab";
import s from "./tab.module.css";

const SRC: Record<string, string> = { OTEL: "OTel", LOCAL_LOG: "로컬 로그", MANUAL: "수기" };
const tok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

export function UsagePanel({ data }: { data: MeasureData }) {
  const usages = data.input.usages;
  if (!usages.length) return <EmptyState icon="spark" title="AI 사용량 기록이 없습니다">데이터 수집 화면에서 수집 스크립트 CSV 나 OTel export 를 올려 주세요.</EmptyState>;
  const prices = data.input.settings.tokenPrices;
  const byWbs = new Map<string, { requests: number; input: number; output: number; cr: number; cw: number; cost: number; src: Set<string> }>();
  for (const u of usages) {
    const k = u.wbsId ?? "(WBS 미상)";
    const r = byWbs.get(k) ?? { requests: 0, input: 0, output: 0, cr: 0, cw: 0, cost: 0, src: new Set<string>() };
    r.requests += u.requests;
    r.input += u.inputTokens;
    r.output += u.outputTokens;
    r.cr += u.cacheReadTokens;
    r.cw += u.cacheWriteTokens;
    r.cost += aiCostOf(u, prices) ?? 0;
    r.src.add(u.srcCd);
    byWbs.set(k, r);
  }
  return (
    <div className={s.usage}>
      <div>
        <span className="eyebrow">일자별 요청 수</span>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.metrics.requestsByDay} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="#ece9e1" />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 11, fill: "#8a8f98" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8a8f98" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => Number(v ?? 0).toLocaleString()} contentStyle={{ borderRadius: 8, border: "1px solid #e4e1d8", fontSize: 12 }} />
              <Bar dataKey="requests" name="요청 수" fill="#2b3a8c" radius={[3, 3, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <table className={s.mini}>
          <thead>
            <tr>
              <th>WBS-ID</th>
              <th className={s.r}>요청</th>
              <th className={s.r}>입력</th>
              <th className={s.r}>출력</th>
              <th className={s.r}>캐시 읽기</th>
              <th className={s.r}>캐시 쓰기</th>
              <th className={s.r}>비용</th>
              <th>출처</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byWbs.entries()).map(([k, r]) => (
              <tr key={k}>
                <td className="num">{k}</td>
                <td className={`${s.r} num`}>{r.requests.toLocaleString()}</td>
                <td className={`${s.r} num`}>{tok(r.input)}</td>
                <td className={`${s.r} num`}>{tok(r.output)}</td>
                <td className={`${s.r} num`}>{tok(r.cr)}</td>
                <td className={`${s.r} num`}>{tok(r.cw)}</td>
                <td className={`${s.r} num`}>{won(r.cost)}</td>
                <td>
                  {Array.from(r.src).map((x) => (
                    <Chip key={x} tone={x === "MANUAL" ? "warn" : "outline"}>
                      {SRC[x] ?? x}
                    </Chip>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.metrics.unpricedModels.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Callout tone="warn">단가가 없는 모델: {data.metrics.unpricedModels.join(", ")} — 측정 설정에서 단가를 입력해야 비용에 반영됩니다.</Callout>
          </div>
        )}
      </div>
    </div>
  );
}
