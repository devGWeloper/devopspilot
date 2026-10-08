import { Suspense } from "react";
import { ProjectDetailPage } from "@/features/project-detail/ProjectDetailPage";

export const metadata = { title: "과제 상세" };

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <ProjectDetailPage id={params.id} />
    </Suspense>
  );
}
