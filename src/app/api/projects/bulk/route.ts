import { fail, ok, readJson } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { changeStatus, confirmFit } from "@/lib/projects/service";
import { route } from "@/lib/route";
import { STATUSES, type Level, type ProjectStatus } from "@/lib/types";

// 과제마다 독립적으로 성공/실패를 돌려준다 — 하나가 실패해도 나머지는 반영돼야 합의 회의가 끊기지 않는다.
export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<{ action: "status" | "confirm"; ids: string[]; to?: ProjectStatus; note?: string }>(req);
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0) return fail(400, "BAD_REQUEST", "대상 과제를 선택해 주세요.");
  if (!can(actor, body.action === "status" ? "project.status" : "project.confirm")) return fail(403, "FORBIDDEN", "권한이 없습니다.");
  if (body.action === "status" && !STATUSES.includes(body.to as ProjectStatus)) {
    return fail(400, "BAD_REQUEST", "변경할 상태를 선택해 주세요.");
  }

  const results: { prjId: string; ok: boolean; message?: string }[] = [];
  for (const id of body.ids.slice(0, 200)) {
    const p = await store.projects.get(id);
    if (!p) {
      results.push({ prjId: id, ok: false, message: "과제를 찾을 수 없습니다." });
      continue;
    }
    if (body.action === "confirm" && p.suggestFit === "NA") {
      results.push({ prjId: id, ok: false, message: "미평가 과제는 확정할 수 없습니다." });
      continue;
    }
    const r =
      body.action === "status"
        ? await changeStatus(store, actor, id, body.to!, body.note ?? null, p.updAt)
        : await confirmFit(store, actor, id, p.suggestFit as Level, "", p.updAt);
    results.push(r.ok ? { prjId: id, ok: true } : { prjId: id, ok: false, message: r.message });
  }
  return ok(results);
});
