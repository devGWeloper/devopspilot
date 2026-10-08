import Link from "next/link";
import { ErrorScreen } from "@/components/ui/ErrorScreen";

export default function Forbidden() {
  return (
    <ErrorScreen code="403" title="접근 권한이 없습니다" message="이 화면은 현재 계정의 역할로 열 수 없습니다. 권한이 필요하면 AX 관리자에게 요청해 주세요.">
      <Link href="/">대시보드로 이동</Link>
    </ErrorScreen>
  );
}
