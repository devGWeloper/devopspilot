import { ProjectForm } from "@/features/project-form/ProjectForm";

export const metadata = { title: "과제 기입" };

export default function EntryEditPage({ params }: { params: { id: string } }) {
  return <ProjectForm id={params.id} />;
}
