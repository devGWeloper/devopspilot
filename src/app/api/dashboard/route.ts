import { ok } from "@/lib/api";
import { route } from "@/lib/route";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Task {
  prjId: string;
  prjNm: string;
  reason: string;
}

function tasksFor(role: string, userId: string, ps: Project[]): Task[] {
  if (role === "PM") {
    return ps
      .filter((p) => p.pmUserId === userId && (p.status === "DRAFT" || p.status === "SUPPLEMENT"))
      .map((p) => ({
        prjId: p.prjId,
        prjNm: p.prjNm,
        reason: p.status === "SUPPLEMENT" ? `보완 요청: ${p.statusNote ?? ""}` : `작성중 · 응답 ${p.answerCnt}/${p.indicatorCnt}`,
      }));
  }
  if (role === "HX_REVIEWER") {
    return ps
      .filter((p) => ["REVIEW", "SELECTED", "RESERVE"].includes(p.status) && p.hxAgree === "NONE")
      .map((p) => ({ prjId: p.prjId, prjNm: p.prjNm, reason: "SK hynix 의견 미입력" }));
  }
  if (role === "AX_ADMIN") {
    return ps
      .filter((p) => p.status === "SUBMITTED" || (p.status === "REVIEW" && p.finalFit === "NA"))
      .map((p) => ({ prjId: p.prjId, prjNm: p.prjNm, reason: p.status === "SUBMITTED" ? "제출됨 — 검토 시작 필요" : "검토중 — 적합도 미확정" }));
  }
  return [];
}

export const GET = route(async ({ actor, store }) => {
  const ps = await store.projects.list();
  const activity = await store.history.list({ targetTyp: "PROJECT", limit: 12 });
  return ok({ myTasks: tasksFor(actor.role, actor.userId, ps).slice(0, 8), activity });
});
