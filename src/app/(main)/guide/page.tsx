import { Guide } from "@/features/guide/Guide";
import { pageActor } from "@/lib/auth/server";

export const metadata = { title: "작성 가이드" };

export default async function Page() {
  const actor = await pageActor();
  return <Guide role={actor.role} />;
}
