import { Skeleton } from "@/components/ui/Panel";

// 화면이 모두 서버에서 매번 계산되므로, 경계가 없으면 메뉴를 눌러도 계산이 끝날 때까지 이전 화면에 멈춰 있다.
// 경계가 있으면 사이드바는 그대로 두고 본문만 바로 바뀌며, Link 가 이 경계까지 미리 받아 둔다.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <Skeleton h={28} w={220} style={{ marginBottom: 10 }} />
      <Skeleton h={14} w="55%" style={{ marginBottom: 24 }} />
      <Skeleton h={320} />
    </div>
  );
}
