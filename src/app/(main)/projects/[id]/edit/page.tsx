import { ProjectForm } from "@/features/project-form/ProjectForm";

export const metadata = { title: "과제 편집" };

export default function EditProjectPage({ params }: { params: { id: string } }) {
  return <ProjectForm id={params.id} />;
}
