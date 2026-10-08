import Link from "next/link";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen code="404" title="페이지를 찾을 수 없습니다" message="주소가 바뀌었거나 삭제된 항목입니다.">
      <Link href="/">대시보드로 이동</Link>
    </ErrorScreen>
  );
}
