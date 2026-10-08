import { fail, fromResult, ok, readJson } from "@/lib/api";
import { createProject, toView, type ProjectInput } from "@/lib/projects/service";
import { route } from "@/lib/route";
import type { Fit, Project } from "@/lib/types";

export const dynamic = "force-dynamic";

function matches(p: Project, sp: URLSearchParams): boolean {
  const list = (k: string) => sp.get(k)?.split(",").filter(Boolean) ?? [];
  const status = list("status");
  if (status.length && !status.includes(p.status)) return false;
  const fit = list("fit");
  const eff: Fit = p.finalFit !== "NA" ? p.finalFit : p.suggestFit;
  if (fit.length && !fit.includes(eff)) return false;
  const dev = list("devType");
  if (dev.length && !dev.includes(p.devTypeCd ?? "")) return false;
  const lang = list("lang");
  if (lang.length && !p.base.langCds.some((l) => lang.includes(l))) return false;
  const domain = list("domain");
  if (domain.length && !domain.includes(p.domainCd ?? "")) return false;
  const pm = list("pm");
  if (pm.length && !pm.includes(p.pmUserId)) return false;
  const q = sp.get("q")?.trim().toLowerCase();
  if (q && ![p.prjId, p.prjNm, p.sysNm, p.pmUserNm].some((v) => v.toLowerCase().includes(q))) return false;
  return true;
}

export const GET = route(async ({ req, actor, store }) => {
  const sp = new URL(req.url).searchParams;
  const all = await store.projects.list();
  return ok(all.filter((p) => matches(p, sp)).map((p) => toView(p, actor)));
});

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<ProjectInput>(req);
  if (!body?.base) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await createProject(store, actor, body), 201);
});
