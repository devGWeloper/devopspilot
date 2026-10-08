import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { buildMeasureWorkbook, rawCsv, type RawKind } from "@/lib/export/measureXlsx";
import { kstDate } from "@/lib/measure/csv";
import { computeMetrics } from "@/lib/measure/metrics";
import { loadInput } from "@/lib/measure/repo";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

const RAW: RawKind[] = ["efforts", "defects", "usages", "commits"];

export const GET = route(async ({ req, actor, store }) => {
  if (!can(actor, "export")) return fail(403, "FORBIDDEN", "내려받기 권한이 없습니다.");
  const sp = new URL(req.url).searchParams;
  const prj = sp.get("prjId");
  const projects = (await store.projects.list()).filter((p) => p.status === "SELECTED" && (!prj || p.prjId === prj));
  const input = await loadInput(store, projects.map((p) => p.prjId));
  const ymd = kstDate(Date.now()).replace(/-/g, "");
  const kind = sp.get("csv") as RawKind | null;
  if (kind) {
    if (!RAW.includes(kind)) return fail(400, "BAD_REQUEST", "원천 종류가 올바르지 않습니다.");
    return new NextResponse(rawCsv(input, kind), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="PoC_${kind}_${ymd}.csv"` },
    });
  }
  const buf = await buildMeasureWorkbook(input, computeMetrics(input), projects);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="PoC_measure_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(`PoC_생산성측정_${ymd}.xlsx`)}`,
    },
  });
});
