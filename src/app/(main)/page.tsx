import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/auth/permissions";
import { pageActor } from "@/lib/auth/server";

// 주소만 치고 들어와도 로그인 직후와 같은 첫 화면을 보게 한다.
export default async function Page() {
  const actor = await pageActor();
  redirect(homePathFor(actor.role));
}
