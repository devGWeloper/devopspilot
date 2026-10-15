import type { Project, Requirement, Stage, StageCd } from "../types";

/** 측정 단위 = 요구사항 × 단계. 코드 `REQ-0047-DV` 는 개발자가 브랜치명·대화에 적어 AI 시간을 자동 배정받는 키다. */
export interface Unit {
  code: string;
  prjId: string;
  reqId: string;
  stage: StageCd;
  ownerId: string | null;
  prj: Project;
  req: Requirement;
  s: Stage;
}

export const unitCode = (reqId: string, cd: StageCd) => `${reqId}-${cd}`;

export function unitsOf(projects: Project[]): Unit[] {
  return projects.flatMap((prj) =>
    prj.reqs.flatMap((req) =>
      req.stages.map((s) => ({
        code: unitCode(req.reqId, s.cd),
        prjId: prj.prjId,
        reqId: req.reqId,
        stage: s.cd,
        ownerId: s.ownerId,
        prj,
        req,
        s,
      })),
    ),
  );
}

export const reqBaseMd = (r: Requirement) => r.stages.reduce((a, s) => a + s.baseMd, 0);

export const isOwner = (r: Requirement, userId: string) => r.stages.some((s) => s.ownerId === userId);

export const ownersOf = (r: Requirement) => Array.from(new Set(r.stages.map((s) => s.ownerNm || s.ownerId || "미지정")));
