"use client";

import { Coach, type CoachStep } from "@/components/ui/Coach";

// 하루 공수 흐름 그대로. 말풍선은 몇 단어만 — 가리키는 곳이 설명이다.
// 처음 온 사람이 '왜 단계별로 적는지'를 모르면 한 단계에 몰아 적으므로, 그 칸에서만 이유를 덧붙인다.
const STEPS: CoachStep[] = [
  {
    target: "flow",
    text: "공수 입력은 이런 화면이에요",
    side: "bottom",
    more: (
      <p>
        AI 활용 생산성 향상 PoC 는 <b>AI 없이 했을 때의 기준 공수</b>와 <b>실제로 든 공수</b>를 비교합니다. 여기서 그 실제 공수를 날마다 모으고
        본인이 확정합니다. <b>확정한 날만</b> 측정 결과에 들어갑니다.
      </p>
    ),
  },
  {
    target: "kpis",
    text: "남은 할 일은 여기서 한눈에",
    side: "bottom",
    more: <p>&lsquo;확정할 날&rsquo;과 &lsquo;미분류 Codex 세션&rsquo;을 0 으로 만드는 게 목표예요. 숫자를 누르면 그 날로 바로 갑니다.</p>,
  },
  {
    target: "days",
    text: "달력에서 날짜를 누르세요",
    side: "right",
    live: true,
    more: <p>&lsquo;확정&rsquo; 배지는 확정할 날, 숫자 배지는 미분류 Codex 세션이 남은 날이에요. ✓ 는 확정을 끝낸 날입니다.</p>,
  },
  {
    target: "dayFlow",
    text: "그날 PoC 일이 시간 순으로 보여요",
    side: "bottom",
    more: (
      <p>
        검정은 Codex, 회색은 직접 입력한 시간대예요. PoC 일을 한 시간만 그려서 빈칸은 다른 업무를 한 시간입니다. <b>빨간 테두리</b>는 직접 입력과 Codex 가 겹친 곳(같은 시간이 두 번
        잡힘), 빗금은 기본 근무시간 밖이에요.
      </p>
    ),
  },
  {
    target: "stages",
    text: "요구사항마다 SDLC 단계별로 나눠서 적어요",
    side: "left",
    more: (
      <>
        <p>기준 공수가 단계마다 정해져 있어서, 나눠 적어야 어느 단계에서 AI 효과가 컸는지 보입니다. 한 단계에 몰아 적으면 비교할 수 없어요.</p>
        <dl>
          <dt>분석</dt>
          <dd>요구사항 파악, 현행 소스·데이터 분석</dd>
          <dt>설계</dt>
          <dd>화면·테이블·인터페이스 설계</dd>
          <dt>개발</dt>
          <dd>코딩, 단위 테스트</dd>
          <dt>테스트</dt>
          <dd>통합·검증 테스트, 결함 조치</dd>
        </dl>
      </>
    ),
  },
  {
    target: "tag",
    text: "복사해서 Codex 첫 줄에 붙여 넣기",
    side: "bottom",
    live: true,
    more: (
      <ul>
        <li>한 세션에서는 한 단계 일만 해요. 단계가 바뀌면 새 세션을 열고 새 코드를 붙여 넣으세요.</li>
        <li>직접 타이핑하면 오타로 배정이 안 될 수 있어요.</li>
      </ul>
    ),
  },
  {
    target: ["aiCell", "ai"],
    text: "Codex 시간은 여기 자동으로 들어와요",
    side: "bottom",
    more: <p>세션 건수를 누르면 어느 세션에서 왔는지 보여요. 자리를 비운 시간이 섞였으면 &lsquo;시간 빼기&rsquo;로 10분 단위로 빼세요.</p>,
  },
  {
    target: "pending",
    text: "요구사항을 못 찾은 Codex 사용이에요",
    side: "bottom",
    more: <p>첫 줄 코드가 없거나 틀린 세션이 여기 모여요. 어느 요구사항·단계 일인지 고른 뒤 &lsquo;이동&rsquo;을 누르세요. 잘못 옮겼으면 그 단계의 세션 목록에서 되돌릴 수 있어요.</p>,
  },
  {
    target: ["add", "addCol"],
    text: "AI 없이 한 일은 시간대로 입력",
    side: "bottom",
    more: (
      <p>
        회의, 문서 작성, 수동 테스트처럼 Codex 를 안 쓴 일을 <b>시작~종료</b>(10분 단위)로 그 일을 한 단계 줄에 넣어요. 일찍 나왔거나 야근한 시간도 그대로 적으면 되고, Codex 를 쓴
        시간과는 겹치지 않게 해 주세요.
      </p>
    ),
  },
  {
    target: ["confirm", "daySum"],
    text: "다 맞으면 확정! 확정한 날만 결과에 반영",
    side: "bottom",
    more: <p>퇴근 전에 그날 것을 확정하세요. 며칠 치를 몰아 하면 기억이 흐려져요. 확정한 뒤에도 &lsquo;수정&rsquo;으로 풀어 고칠 수 있어요.</p>,
  },
  { target: "replay", text: "언제든 여기서 다시 볼 수 있어요", side: "bottom" },
];

export function EffortTour(p: { open: boolean; onClose: () => void; onDone: () => void; onHideToday: () => void }) {
  return <Coach title="공수 입력 따라하기" steps={STEPS} {...p} />;
}
