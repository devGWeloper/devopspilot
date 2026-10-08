import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { getCodes, getPublishedCriteria } from "@/lib/criteria/service";
import { buildProjectsWorkbook } from "@/lib/export/projectsXlsx";
import { matchesFilter } from "@/lib/projects/filter";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, actor, store }) => {
  if (!can(actor, "export")) return fail(403, "FORBIDDEN", "내려받기 권한이 없습니다.");
  const sp = new URL(req.url).searchParams;
  const projects = (await store.projects.list()).filter((p) => matchesFilter(p, sp));
  const buf = await buildProjectsWorkbook(projects, await getPublishedCriteria(store), await getCodes(store));
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="PoC_projects_${ymd}.xlsx"; filename*=UTF-8''${encodeURIComponent(`PoC_과제목록_${ymd}.xlsx`)}`,
    },
  });
});
