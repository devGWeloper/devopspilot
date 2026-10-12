import { redirect } from "next/navigation";

// 기입은 '과제 기입' 메뉴로 모았다 — 예전 주소로 들어와도 같은 화면으로 보낸다.
export default function NewProjectPage() {
  redirect("/entry/new");
}
