import { NextResponse } from "next/server";
import { fromResult } from "@/lib/api";
import { exportWorkbook } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

const NAME = "생산성 측정 PoC 데이터.xlsx";

export const GET = route(async ({ actor, store }) => {
  const r = await exportWorkbook(store, actor);
  if (!r.ok) return fromResult(r);
  return new NextResponse(r.value, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(NAME)}`,
    },
  });
});
