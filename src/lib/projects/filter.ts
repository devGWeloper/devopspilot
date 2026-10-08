import type { Fit, Project } from "../types";

export function matchesFilter(p: Project, sp: URLSearchParams): boolean {
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
