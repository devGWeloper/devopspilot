"use client";

import { MeasureTab } from "../measure/tab/MeasureTab";
import { ProjectDetail } from "./ProjectDetail";

// 측정 탭·AI 탭은 각 모듈이 슬롯으로 꽂는다 — 상세 화면이 그 모듈을 직접 알지 않게 해서 AI 모듈은 통째로 지울 수 있다.
export function ProjectDetailPage({ id }: { id: string }) {
  return <ProjectDetail id={id} slots={{ measure: (p, reload) => <MeasureTab project={p} onProjectChange={() => reload()} /> }} />;
}
