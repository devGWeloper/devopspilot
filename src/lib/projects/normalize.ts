import { STAGES, type Project, type Requirement, type Stage } from "../types";

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/**
 * 저장된 과제를 현재 형식으로 맞춘다. 이전 형식은 등급·완료 여부를 요구사항 단위로 가졌으므로 태그로 내려 채운다 —
 * 측정 시작 전 데이터라 별도 이관 없이 읽을 때 맞춘다. (과제 구분 개발/운영은 폐지되어 읽지 않는다)
 */
export function normalizeProject(raw: Raw): Project {
  const reqs = (Array.isArray(raw.reqs) ? raw.reqs : []).map((r: Raw): Requirement => {
    const extra = (r.extra ?? {}) as Record<string, string>;
    // 배포·운영 단계는 측정 대상에서 빠졌다 — 예전에 저장된 태그는 버린다.
    const stages = (Array.isArray(r.stages) ? r.stages : []).filter((s: Raw) => STAGES.includes(s.cd as Stage["cd"])).map(
      (s: Raw): Stage => ({
        cd: s.cd as Stage["cd"],
        workType: str(s.workType),
        ownerId: (s.ownerId as string | null) ?? null,
        ownerNm: str(s.ownerNm),
        baseMd: Number(s.baseMd) || 0,
        difficulty: str(s.difficulty ?? r.difficulty),
        grade: str(s.grade ?? r.grade),
        baseSrc: str(s.baseSrc ?? r.baseSrc),
        done: Boolean(s.done ?? r.done),
        doneAt: ((s.doneAt ?? r.doneAt) as string | null) ?? null,
        fit: str(s.fit ?? extra["FIT-06"]),
        spec: str(s.spec),
        ctx: str(s.ctx),
        gen: str(s.gen),
      }),
    );
    return { reqId: str(r.reqId), name: str(r.name), stages };
  });
  return {
    prjId: str(raw.prjId),
    prjNm: str(raw.prjNm),
    promisCd: str(raw.promisCd),
    sysNm: str(raw.sysNm),
    deptCd: str(raw.deptCd),
    teamNm: str(raw.teamNm),
    axHq: str(raw.axHq),
    axTeam: str(raw.axTeam),
    pmNm: str(raw.pmNm),
    sysGrade: str(raw.sysGrade),
    deployType: str(raw.deployType),
    area: str(raw.area),
    vcs: str(raw.vcs),
    pms: str(raw.pms),
    reqs,
    regUserId: str(raw.regUserId),
    regAt: str(raw.regAt),
    updUserId: str(raw.updUserId),
    updAt: str(raw.updAt),
  };
}
