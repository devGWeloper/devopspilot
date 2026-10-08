"use client";

import dynamic from "next/dynamic";
import { MeasureTab } from "../measure/tab/MeasureTab";
import { ProjectDetail } from "./ProjectDetail";

// AI 탭은 동적 import 로만 연결한다 — src/features/ai 폴더를 지우면 이 한 줄만 고치면 된다.
const AiResultTab = dynamic(() => import("../ai/AiResultTab"), { ssr: false });

// 측정 탭·AI 탭은 각 모듈이 슬롯으로 꽂는다 — 상세 화면이 그 모듈을 직접 알지 않게 한다.
export function ProjectDetailPage({ id }: { id: string }) {
  return (
    <ProjectDetail
      id={id}
      slots={{
        measure: (p, reload) => <MeasureTab project={p} onProjectChange={() => reload()} />,
        ai: (p, reload) => <AiResultTab project={p} onChange={() => reload()} />,
      }}
    />
  );
}
