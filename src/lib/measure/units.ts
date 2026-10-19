import type { Project, Requirement, Stage, StageCd } from "../types";

/**
 * 측정 단위 = 공수 태그 `DAE01-REQ0047-DV`. 개발자가 브랜치명·프롬프트에 적어 AI 시간을 자동 배정받는 키다.
 * 요구사항 ID 는 과제 안에서만 유일하므로 과제 ID 를 붙인 reqKey 로 요구사항을 구분한다.
 */
export interface Unit {
  code: string;
  prjId: string;
  reqId: string;
  reqKey: string;
  stage: StageCd;
  ownerId: string | null;
  prj: Project;
  req: Requirement;
  s: Stage;
}

export const reqKey = (prjId: string, reqId: string) => `${prjId}-${reqId}`;
export const unitCode = (prjId: string, reqId: string, cd: StageCd) => `${reqKey(prjId, reqId)}-${cd}`;

export function unitsOf(projects: Project[]): Unit[] {
  return projects.flatMap((prj) =>
    prj.reqs.flatMap((req) =>
      req.stages.map((s) => ({
        code: unitCode(prj.prjId, req.reqId, s.cd),
        prjId: prj.prjId,
        reqId: req.reqId,
        reqKey: reqKey(prj.prjId, req.reqId),
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

/** 모든 태그가 측정 완료여야 요구사항이 완료 */
export const reqDone = (r: Requirement) => r.stages.length > 0 && r.stages.every((s) => s.done);
