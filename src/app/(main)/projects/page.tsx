import { Suspense } from "react";
import { ProjectList } from "@/features/projects/ProjectList";

export const metadata = { title: "과제 포트폴리오" };

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectList />
    </Suspense>
  );
}
