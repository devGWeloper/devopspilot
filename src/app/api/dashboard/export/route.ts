import { NextResponse } from "next/server";
import { fromResult } from "@/lib/api";
import { exportResult } from "@/lib/measure/service";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, actor, store }) => {
  const q = new URL(req.url).searchParams;
  const r = await exportResult(store, actor, { prjId: q.get("prj") ?? "", includeIng: q.get("ing") === "1" });
  if (!r.ok) return fromResult(r);
  const name = `측정 결과 집계_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(r.value, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
});
