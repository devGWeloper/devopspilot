import { PageHeader } from "@/components/ui/PageHeader";
import { UsersAdmin } from "@/features/admin/users/UsersAdmin";
import { pageActor } from "@/lib/auth/server";

export const metadata = { title: "사용자 관리" };

export default async function Page() {
  await pageActor();
  return (
    <>
      <PageHeader eyebrow="Admin" title="사용자 관리" description="포털 계정과 역할(관리자·개발자·열람자)입니다. 계정 추가·수정, 사용 중지, 비밀번호 초기화를 여기서 합니다. 과제 선정 엑셀의 개발자 권한 시트로 올린 계정도 여기에 보입니다." />
      <UsersAdmin />
    </>
  );
}
