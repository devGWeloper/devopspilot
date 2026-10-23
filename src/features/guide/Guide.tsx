"use client";

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import type { MetricDef } from "@/lib/measure/metrics";
import { RULES, type RuleCd } from "@/lib/measure/monitorRules";
import { agentsMd, docDir, STAGE_GUIDE, stagePrompt } from "@/lib/measure/stageGuide";
import { ACT_TYPES } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES, type Role } from "@/lib/types";
import { copyText } from "../common/copy";
import s from "./guide.module.css";

type Tab = "start" | "codex" | "dev" | "collect" | "tips" | "result" | "admin" | "faq";

export function Guide({ role, metrics }: { role: Role; metrics: MetricDef[] }) {
  const [tab, setTab] = useState<Tab>(role === "ADMIN" ? "admin" : role === "DEVELOPER" ? "start" : "result");
  return (
    <>
      <PageHeader eyebrow="도움말" title="작성 가이드" description="처음 준비부터 매일 하는 일까지 — 이 순서대로 하면 공수가 제자리에 쌓입니다." />

      <div className={s.flow}>
        {[
          ["1", "처음 한 번 준비", "Codex 설치·로그인, 저장소에 AGENTS.md"],
          ["2", "단계별 Codex 세션", "단계마다 새 세션, 첫 메시지는 지시문"],
          ["3", "퇴근 전 기록 올리기", "~/.codex/sessions 파일 올리기"],
          ["4", "직접 입력·확정", "AI 없이 한 일 넣고 그날 확정"],
          ["5", "측정 결과", "확정된 날만 집계"],
        ].map(([n, t, d]) => (
          <div key={n} className={s.step}>
            <span className={s.no}>{n}</span>
            <b>{t}</b>
            <span>{d}</span>
          </div>
        ))}
      </div>

      <Panel flush>
        <div style={{ padding: "4px 20px 0" }}>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { key: "start", label: "처음 준비" },
              { key: "codex", label: "Codex 단계별 사용" },
              { key: "dev", label: "하루 입력" },
              { key: "collect", label: "기록 올리기" },
              { key: "tips", label: "작성 팁" },
              { key: "result", label: "결과 계산 방법" },
              { key: "admin", label: "관리자" },
              { key: "faq", label: "자주 묻는 질문" },
            ]}
          />
        </div>
        <div className={s.body}>
          {tab === "start" && <Start />}
          {tab === "codex" && <CodexUse />}
          {tab === "dev" && <Dev />}
          {tab === "collect" && <Collect />}
          {tab === "tips" && <Tips />}
          {tab === "result" && <Result metrics={metrics} />}
          {tab === "admin" && <Admin />}
          {tab === "faq" && <Faq />}
        </div>
      </Panel>
    </>
  );
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.sec}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** 명령·설정은 손으로 옮겨 적다 틀리기 쉬워 복사 버튼을 붙인다 */
function Copy({ text, label = "명령" }: { text: string; label?: string }) {
  const { toast } = useToast();
  return (
    <div className={s.copyBlock}>
      <pre className={s.pre}>{text}</pre>
      <button
        className={s.copyBtn}
        onClick={() => {
          copyText(text);
          toast(`${label}을 복사했습니다.`);
        }}
      >
        복사
      </button>
    </div>
  );
}

function Start() {
  return (
    <>
      <Sec title="1. Codex CLI 설치">
        <p>
          PoC 의 AI 도구는 <b>Codex</b> 입니다. 터미널에서 쓰는 Codex CLI 를 설치합니다. 사내망에서 npm·외부 주소가 막혀 있으면 사내 IT 안내(프록시·사내 npm 저장소)를 먼저 따릅니다.
        </p>
        <p className={s.os}>Windows</p>
        <p>
          Node.js(LTS)가 있으면 PowerShell 에서 아래 명령으로 설치합니다. WSL(Ubuntu)을 쓰는 사람은 WSL 터미널 안에서 같은 명령으로 설치하는 편이 가장 안정적입니다 — 이때 세션 파일이 WSL 쪽에 쌓이니{" "}
          <b>기록 올리기</b> 탭의 WSL 경로를 확인하세요.
        </p>
        <Copy text="npm install -g @openai/codex" />
        <p className={s.os}>macOS · Linux</p>
        <Copy text="npm install -g @openai/codex" />
        <p className={s.note}>
          패키지 이름은 반드시 <code>@openai/codex</code> 입니다. 앞을 빼고 <code>codex</code> 로 설치하면 전혀 다른 패키지가 깔립니다. 설치 뒤 확인·업데이트:
        </p>
        <Copy text={"codex --version\nnpm install -g @openai/codex@latest"} />
      </Sec>
      <Sec title="2. 로그인">
        <ol className={s.ol}>
          <li>
            작업할 저장소 폴더로 이동해 <code>codex</code> 를 실행합니다.
          </li>
          <li>
            처음 실행하면 로그인 방법을 묻습니다. <b>Sign in with ChatGPT</b> 를 골라 <b>회사에서 지급한 계정</b>으로 로그인합니다(개인 계정 금지).
          </li>
          <li>
            Codex 안에서 <code>/status</code> 를 입력해 계정·모델이 맞는지 확인합니다.
          </li>
        </ol>
        <Copy text={"cd <작업 저장소 폴더>\ncodex"} />
      </Sec>
      <Sec title="3. 저장소에 PoC 규칙 넣기 — AGENTS.md">
        <p>
          Codex 는 저장소 루트의 <code>AGENTS.md</code> 를 세션마다 읽습니다. 아래 규칙을 넣어 두면 지시문을 빠뜨려도 Codex 가 <b>한 세션에서 한 단계만</b> 하도록 스스로 멈춥니다. 파일이 없으면 새로 만들고(Codex 의{" "}
          <code>/init</code> 으로 만들어도 됨), 있으면 맨 아래에 붙입니다. 팀 저장소라면 한 사람이 커밋해 함께 씁니다.
        </p>
        <Copy text={agentsMd()} label="AGENTS.md 규칙" />
        <p className={s.note}>규칙 안에 실제 공수 태그(숫자가 든 코드)나 업무 외 표시를 그대로 적지 마세요. AGENTS.md 내용도 세션 기록에 들어가서 모든 세션이 미분류로 빠집니다.</p>
      </Sec>
      <Sec title="4. 준비 확인">
        <ul className={s.check}>
          <li>
            포털 <b>공수 입력</b>에 내가 맡은 요구사항·단계가 보인다 (안 보이면 관리자에게 담당 지정 요청)
          </li>
          <li>
            <code>codex --version</code> 이 버전을 출력한다
          </li>
          <li>
            Codex 에서 <code>/status</code> 로 회사 계정이 보인다
          </li>
          <li>
            저장소 <code>AGENTS.md</code> 에 PoC 규칙이 있다
          </li>
          <li>
            Codex 를 한 번 쓰고 나면 <code>%USERPROFILE%\.codex\sessions</code> (WSL·macOS <code>~/.codex/sessions</code>) 에 날짜 폴더가 생긴다
          </li>
        </ul>
      </Sec>
    </>
  );
}

function CodexUse() {
  return (
    <>
      <Sec title="왜 단계마다 나누나">
        <p>
          평소처럼 &ldquo;이 기능 만들어 줘&rdquo; 한 번이면 AI 가 분석·설계·개발을 한 세션에서 알아서 섞어 버립니다. 그러면 어느 단계에서 AI 효과가 났는지 잴 수 없습니다. PoC 기간에는{" "}
          <b>요구사항 × 단계마다 세션을 따로 열고</b>, 단계 사이는 <b>산출 문서(md)</b>로 넘깁니다. 측정 결과는 단계별 기준 공수와 비교하므로 이 구분이 곧 측정의 정확도입니다.
        </p>
        <table className={s.table}>
          <thead>
            <tr>
              <th>단계</th>
              <th>이 세션에서 시킬 일</th>
              <th>먼저 읽힐 문서</th>
              <th>남길 문서</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((cd) => (
              <tr key={cd}>
                <th>
                  {STAGE_LABEL[cd]} <code>{cd}</code>
                </th>
                <td>
                  {STAGE_GUIDE[cd].goal} — {STAGE_GUIDE[cd].stop}
                </td>
                <td>{STAGE_GUIDE[cd].input.join(", ") || "—"}</td>
                <td>
                  <code>{STAGE_GUIDE[cd].output}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.note}>
          문서는 저장소의 <code>{docDir("과제ID-요구사항ID")}/</code> 아래에 둡니다. 파일 이름에 단계 코드를 넣지 않습니다 — 다음 단계 세션에서 그 경로를 말하면 단계 코드가 둘이 되어 미분류로 빠집니다.
        </p>
      </Sec>
      <Sec title="세션 하나의 흐름">
        <ol className={s.ol}>
          <li>
            <b>체크포인트</b> — 단계를 시작하기 전에 작업 중인 변경을 커밋해 둡니다. AI 가 잘못 고쳐도 되돌리기 쉽습니다.
          </li>
          <li>
            <b>지시문 복사</b> — 포털 공수 입력에서 할 요구사항·단계 줄의 <code>poc …</code> 옆 <b>지시문</b>을 눌러 복사합니다. 분석 단계는 지시문 아래에 요구사항 설명·관련 화면·소스 위치를 붙입니다.
          </li>
          <li>
            <b>새 세션</b> — 저장소 폴더에서 <code>codex</code> 를 새로 실행하고 지시문을 <b>첫 메시지</b>로 붙여 넣습니다. 첫 줄 <code>poc 공수태그</code> 로 이 세션 시간이 그 단계에 붙습니다.
          </li>
          <li>
            <b>그 단계만</b> — 대화는 그 단계 일로만 이어 갑니다. 다음 단계 일이 떠오르면 메모해 두고 다음 세션에서 합니다.
          </li>
          <li>
            <b>문서 확인 후 종료</b> — 남긴 md 문서를 읽어 보고 부족하면 그 세션에서 고치게 합니다. 끝나면 커밋하고 세션을 닫습니다(<code>/quit</code> 또는 Ctrl+C).
          </li>
          <li>
            <b>다음 단계</b> — 다음 단계 줄의 지시문으로 1번부터 다시. 앞 단계 문서를 읽으라는 내용이 지시문에 들어 있습니다.
          </li>
        </ol>
        <p>예 — 개발 단계 지시문</p>
        <Copy text={stagePrompt({ code: "DAE01-REQ0047-DV", reqKey: "DAE01-REQ0047", name: "설비 알람 이력 조회", stage: "DV" })} label="예시 지시문" />
      </Sec>
      <Sec title="하루 예시">
        <table className={s.table}>
          <tbody>
            {[
              ["09:00", "공수 입력에서 오늘 할 단계 확인. REQ0047 분석 지시문 복사 → 새 세션"],
              ["09:10 ~ 11:30", "분석 세션 — 현행 소스 분석, 01_분석.md 저장·커밋 → 세션 종료"],
              ["11:30 ~ 12:00", "현업 담당자와 요건 확인 회의 (Codex 밖 → 나중에 A5 협의·소통으로 직접 입력)"],
              ["13:00 ~ 17:00", "설계 지시문으로 새 세션 — 01_분석.md 를 읽고 설계, 02_설계.md 저장 → 종료"],
              ["17:40", "공수 입력 > Codex 기록 올리기 → 오늘 날짜 폴더 파일 올리기"],
              ["17:50", "회의 시간 직접 입력, 미분류 세션 정리, 이 날 확정"],
            ].map(([t, d]) => (
              <tr key={t}>
                <th>{t}</th>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sec>
      <Sec title="Codex 기본 사용법">
        <table className={s.table}>
          <tbody>
            {[
              ["codex", "현재 폴더에서 새 세션 시작. 저장소 루트에서 실행해야 AGENTS.md·소스를 읽습니다"],
              ["codex resume", "최근 세션 이어 하기 — 같은 요구사항·같은 단계를 이어 할 때만. 다른 단계면 새로 시작"],
              ["@파일명", "메시지 안에서 파일을 집어 지정. 앞 단계 문서·관련 소스를 콕 집어 읽힐 때"],
              ["/status", "로그인 계정·모델·권한 확인"],
              ["/model", "모델·추론 강도 변경. 분석·설계는 높게, 단순 수정은 낮게"],
              ["/permissions", "Codex 가 파일 수정·명령 실행을 어디까지 할지. 처음엔 묻고 진행하는 쪽을 권장"],
              ["/review", "지금까지 바뀐 내용 검토 — 개발 단계 끝에 한 번"],
              ["/init", "AGENTS.md 초안 만들기 (처음 준비 3번)"],
              ["/quit · Ctrl+C", "세션 종료. 단계가 끝나면 닫고 다음 단계는 새로 시작"],
            ].map(([k, v]) => (
              <tr key={k}>
                <th>
                  <code>{k}</code>
                </th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.note}>명령은 Codex 버전에 따라 조금씩 다를 수 있습니다. Codex 안에서 <code>/</code> 를 입력하면 쓸 수 있는 명령 목록이 나옵니다.</p>
      </Sec>
      <Sec title="잘 시키는 법">
        <div className={s.dodont}>
          <div className={s.do}>
            <b>이렇게</b>
            <ul>
              <li>분석: &ldquo;분석만, 01_분석.md 로 저장&rdquo; + 요구사항 원문·관련 화면 경로</li>
              <li>설계: &ldquo;@01_분석.md 읽고 설계만, 코드 수정 금지&rdquo;</li>
              <li>개발: 설계 문서의 변경 파일 목록 범위 안에서만 고치게 하기</li>
              <li>테스트: 실패한 테스트는 원인·조치를 04_테스트.md 에 남기게 하기</li>
              <li>결과가 틀리면 같은 세션에서 바로잡기 (같은 단계 일이므로)</li>
            </ul>
          </div>
          <div className={s.dont}>
            <b>이러면 측정이 안 됩니다</b>
            <ul>
              <li>&ldquo;이 요구사항 알아서 끝까지 만들어 줘&rdquo;</li>
              <li>개발하던 세션에서 이어서 테스트까지 시키기</li>
              <li>한 세션에 두 단계 코드를 적기 — 미분류로 빠지고 모니터링 대상</li>
              <li>지시문 없이 시작해 태그를 깜빡하기 — 그날 직접 골라 줘야 함</li>
            </ul>
          </div>
        </div>
      </Sec>
    </>
  );
}

function Dev() {
  return (
    <>
      <Sec title="하루 5분 — 퇴근 전에 이것만">
        <ol className={s.ol}>
          <li>
            <b>Codex 기록 올리기</b> — 공수 입력 오른쪽 위 버튼에서 오늘 날짜 폴더의 세션 파일을 올립니다(자세히는 <b>기록 올리기</b> 탭).
          </li>
          <li>
            <b>날짜 고르기</b> — 왼쪽 달력에서 날짜를 누릅니다. 확정이 필요한 날은 &lsquo;확정&rsquo;, 미분류 Codex 세션이 있는 날은 건수 배지가 붙고, 할 일이 남은 가장 최근 날이 먼저 열립니다.
          </li>
          <li>
            <b>Codex 시간 확인</b> — 표의 <b>Codex</b> 칸이 공수 태그로 들어온 시간입니다. 표 위 <b>이 날 작업 흐름</b>에 시간 순으로 그려지고, <b>세션 n건</b>을 누르면 어느 세션에서 왔는지 나옵니다. 자리를 비운 시간이 섞였으면 <b>시간 빼기</b>로 10분 단위로 뺍니다.
          </li>
          <li>
            <b>미분류 정리</b> — 표 위 <b>미분류 Codex 세션</b>에서 요구사항·단계를 골라 <b>이동</b>하거나, 업무와 무관하면 <b>업무 외 사용</b>을 누릅니다. 여러 단계가 섞인 세션은 단계별로 분을 나눠 배정합니다. 잘못 옮겼으면 그 단계의 세션 목록에서 <b>배정 되돌리기</b>.
          </li>
          <li>
            <b>직접 입력</b> — <b>＋ 입력</b>으로 AI 없이 한 일을 작업 유형별로 <b>시작~종료</b>(10분 단위)로 넣습니다(아래 표). 조기 출근·야근도 그대로 적습니다. Codex 시간과 겹치면 경고가 뜹니다 — 같은 시간이 두 번 잡히지 않게 한쪽을 고칩니다.
          </li>
          <li>
            <b>이 날 확정</b> — 합계가 맞으면 확정합니다. 확정한 날만 측정 결과에 들어갑니다. 고칠 일이 생기면 그 요구사항 줄의 <b>수정</b>으로 풀고 다시 확정합니다.
          </li>
        </ol>
      </Sec>
      <Sec title="AI 없이 한 일 — 작업 유형">
        <table className={s.table}>
          <tbody>
            {ACT_TYPES.map((a) => (
              <tr key={a.cd}>
                <th>
                  {a.cd} {a.label}
                </th>
                <td>{a.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sec>
      <Sec title="공수 태그 — Codex 시간이 제자리에 붙는 열쇠">
        <p>
          공수 태그는 <code>과제ID-요구사항ID-단계</code> 입니다(예: <code>DAE01-REQ0047-DV</code>). 지시문 첫 줄에 들어 있으니 지시문을 쓰면 따로 적을 필요가 없습니다. 태그 하나에 담당은 한 명입니다.
        </p>
        <div className={s.codes}>
          {STAGES.map((c) => (
            <span key={c}>
              <code>{c}</code> {STAGE_LABEL[c]}
            </span>
          ))}
          <span>
            <code>poc off</code> 업무 외 사용
          </span>
        </div>
        <div className={s.dodont}>
          <div className={s.do}>
            <b>자동으로 붙는 경우</b>
            <ul>
              <li>
                첫 메시지: <code>poc DAE01-REQ0047-DV</code> (지시문 그대로)
              </li>
              <li>
                브랜치명: <code>feature/DAE01-REQ0047-DV-event-retry</code>
              </li>
              <li>
                <code>REQ0047-DV</code> 처럼 과제 ID 를 빼도 내 담당 중 하나로 정해지면 붙음
              </li>
            </ul>
          </div>
          <div className={s.dont}>
            <b>미분류로 빠지는 경우</b>
            <ul>
              <li>
                코드 없이 <code>main</code> 브랜치에서 시작
              </li>
              <li>
                요구사항까지만 (<code>DAE01-REQ0047</code>) — 내 단계가 2개 이상이면 어느 단계인지 모름
              </li>
              <li>
                요구사항 ID 만 (<code>REQ0047</code>) — 다른 과제에 같은 ID 가 있으면 모름
              </li>
              <li>한 세션에서 여러 공수 태그를 번갈아 씀</li>
            </ul>
          </div>
        </div>
      </Sec>
    </>
  );
}

function Tips() {
  return (
    <>
      <Sec title="좋은 기록의 기준">
        <div className={s.dodont}>
          <div className={s.do}>
            <b>권장</b>
            <ul>
              <li>그날 그날 올리고 확정 — 기억이 흐려지기 전에</li>
              <li>실제 쓴 시간 그대로. 회의·문의 대응도 A5 협의·소통으로</li>
              <li>AI 를 썼는데 기록 파일이 없으면 A7 &lsquo;AI 사용 미수집&rsquo;</li>
              <li>자리 비움·점심 등은 &lsquo;시간 빼기&rsquo;로 빼고, 이유를 메모</li>
              <li>A8 기타는 메모 필수</li>
            </ul>
          </div>
          <div className={s.dont}>
            <b>피할 것</b>
            <ul>
              <li>한 Codex 세션에서 분석부터 개발까지 몰아서 시키기</li>
              <li>매일 같은 시간(예: 8h)을 기계적으로 채우기</li>
              <li>며칠 치를 몰아서 한 번에 확정</li>
              <li>PoC 와 무관한 일을 요구사항에 붙이기</li>
              <li>AI 시간을 이유 없이 크게 빼기</li>
              <li>기준 공수에 맞추려고 시간 조정</li>
            </ul>
          </div>
        </div>
        <p className={s.note}>측정 결과는 &lsquo;AI 를 쓰면 얼마나 빨라지는가&rsquo;를 보는 실험입니다. 잘 나오게 맞춘 값보다 실제 값이 더 가치 있습니다.</p>
      </Sec>
      <Sec title="이런 입력은 모니터링에서 확인 대상이 됩니다">
        <table className={s.table}>
          <tbody>
            {(Object.keys(RULES) as RuleCd[]).map((k) => (
              <tr key={k}>
                <th>{RULES[k].label}</th>
                <td>{RULES[k].why}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.note}>감지되었다고 잘못된 것은 아닙니다. 관리자가 사유를 확인하고 기록을 남깁니다 (예: 장애 대응 주간이라 같은 시간이 맞음).</p>
      </Sec>
    </>
  );
}

function Collect() {
  return (
    <>
      <Sec title="Codex 세션 파일 올리기">
        <p>
          Codex 는 사용 기록을 포털로 바로 보내지 못합니다. 그래서 개발자가 <b>하루 일을 마칠 때</b> PC 의 Codex 세션 파일을 공수 입력 &gt; <b>Codex 기록 올리기</b>로 올립니다. 포털이 파일을 읽어 세션별 활동 시간·토큰·공수 태그 후보를 뽑습니다.
        </p>
        <table className={s.table}>
          <tbody>
            <tr>
              <th>Windows (PowerShell 에 설치)</th>
              <td>
                <code>%USERPROFILE%\.codex\sessions\YYYY\MM\DD\rollout-*.jsonl</code>
              </td>
            </tr>
            <tr>
              <th>Windows (WSL 에 설치)</th>
              <td>
                <code>\\wsl$\Ubuntu\home\&lt;WSL 사용자&gt;\.codex\sessions\…</code> — 파일 창 주소줄에 붙여 넣으면 열립니다
              </td>
            </tr>
            <tr>
              <th>macOS · Linux</th>
              <td>
                <code>~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl</code> — 파일 창에서 Cmd+Shift+. 으로 숨김 폴더 보기
              </td>
            </tr>
          </tbody>
        </table>
        <ol className={s.ol} style={{ marginTop: 12 }}>
          <li>숨김 폴더라 안 보이면 파일 창 주소줄에 위 경로를 붙여 넣습니다.</li>
          <li>그날 날짜 폴더의 파일만 골라도 되고, <code>sessions</code> 폴더를 통째로 골라도 됩니다(측정 시작일 이후만 올라감). 며칠 못 올렸으면 폴더째가 편합니다.</li>
          <li>올리기 전에 세션 수·날짜·시간이 보입니다. 맞으면 올립니다. 같은 세션을 다시 올려도 중복되지 않고, 이미 배정한 결과는 유지됩니다.</li>
        </ol>
        <p className={s.note}>
          파일은 <b>브라우저 안에서만 읽습니다.</b> 서버에는 시간·토큰과 코드처럼 생긴 토큰(공수 태그 후보)만 가고 대화 원문은 가지 않습니다. 활동 시간은 기록 사이 간격의 합이며 5분 넘게 빈 구간은 5분까지만 셉니다.
        </p>
      </Sec>
      <Sec title="올리지 못한 날">
        <p>세션 파일이 지워졌거나 다른 PC 에서 일해 올릴 수 없으면 &lsquo;AI 없이 한 일&rsquo;의 A7 AI 사용 미수집으로 직접 넣습니다. 다른 PC 에서 일했으면 그 PC 에서 포털에 들어가 그 PC 의 세션 파일을 올리면 됩니다.</p>
      </Sec>
      <Sec title="올린 시간이 단계에 붙는 방법">
        <ol className={s.ol}>
          <li>세션의 브랜치명·내가 쓴 메시지에서 공수 태그(DAE01-REQ0047-DV)를 찾으면 그 요구사항·단계에 바로 붙습니다.</li>
          <li>요구사항 ID + 단계(REQ0047-DV)만 있어도 내 담당 중 하나로 정해지면 붙습니다.</li>
          <li>과제ID-요구사항ID(또는 요구사항 ID)만 있고 내 담당 단계가 하나뿐이면 그 단계에 붙습니다.</li>
          <li>
            <code>poc off</code> 만 있으면 업무 외 사용으로 빠집니다(측정에 안 들어감).
          </li>
          <li>그 외(코드 없음, 여러 개, poc off 와 코드가 함께)는 그날 화면에 &lsquo;미분류 Codex 세션&rsquo;으로 남아 개발자가 고릅니다. 고르기 전까지 결과에 들어가지 않습니다.</li>
          <li>개발자가 확정하면 그날 값이 결과에 들어갑니다. 확정 뒤 기록을 늦게 올려 값이 달라지면 &lsquo;다시 확정 필요&rsquo;가 됩니다.</li>
        </ol>
      </Sec>
    </>
  );
}

// 엑셀 05 시트의 지표명은 고객 문서 그대로 두고, 화면에서 부르는 이름만 옆에 붙인다.
const SCREEN_NAME: Record<string, string> = {
  save: "공수 절감률",
  outShare: "AI 없이 비중",
  tag: "AI 사용 자동 연결",
  nextDay: "다음 날까지 확정",
};

const TERMS: [string, string][] = [
  ["기준 공수", "AI 없이 했을 때 걸릴 공수(M/D). 요구사항·단계마다 기준정보 엑셀에 정한 값"],
  ["실제 공수", "개발자가 확정한 시간 = AI 사용 + AI 없이. M/D 로 볼 때는 1 M/D 시간으로 나눔"],
  ["AI 사용", "Codex 자동 수집 시간 − 개발자가 줄인 시간"],
  ["AI 없이", "Codex 밖에서 한 일. 개발자가 작업 유형별로 직접 입력"],
  ["공수 절감률", "1 − 실제 공수 ÷ 기준 공수"],
  ["기준·실제 인건비", "기준·실제 공수 × 그 단계 필요 등급 단가"],
  ["비용 순절감률", "(기준 인건비 − 실제 인건비 − AI 비용) ÷ 기준 인건비"],
  ["공수 태그", "과제ID-요구사항ID-단계 코드. Codex 대화·브랜치에 적으면 시간이 그 요구사항·단계에 자동 연결"],
  ["요구사항 미지정", "공수 태그가 없어 어느 요구사항·단계인지 모르는 Codex 사용. 개발자가 골라 줘야 집계됨"],
  ["측정 완료", "관리자가 끝났다고 지정한 요구사항·단계. 측정 결과는 기본으로 이것만 집계"],
];

function Result({ metrics }: { metrics: MetricDef[] }) {
  return (
    <>
      <Sec title="용어">
        <table className={s.table}>
          <tbody>
            {TERMS.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sec>
      <Sec title="지표 — 기준정보 엑셀 '05. 주요 집계 로직'">
        <table className={s.table}>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key}>
                <th>
                  {m.name}
                  {SCREEN_NAME[m.key] && <div className={s.note}>화면: {SCREEN_NAME[m.key]}</div>}
                  <div className={s.note}>{m.group}</div>
                </th>
                <td>
                  {m.formula}
                  {m.note && <div className={s.note}>{m.note}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={s.note}>기준 공수는 요구사항·단계마다 정한 AI 없이 했을 때의 공수(M/D)입니다. 기본은 측정 완료 단계만, 확정된 날만 집계합니다. 측정 결과에서 숫자를 누르면 계산식이, 산출 근거에서는 일자·세션 단위 내역이 보입니다.</p>
      </Sec>
    </>
  );
}

function Admin() {
  return (
    <>
      <Sec title="측정 시작 전">
        <ol className={s.ol}>
          <li>
            <b>과제 선정 결과 올리기</b> — 과제 선정 현황(또는 과제 선정 관리) 위 <b>선정 결과 엑셀 올리기</b>. 양식은 <b>엑셀 내려받기</b>로 받아 01 과제 · 02 요구사항-SDLC · 03 공수 태그 매핑·개발자 권한 · 04 단가에 취합 결과를 옮겨 적습니다. 파일을 고르면 바뀔 내용이 먼저 보이고 &lsquo;이대로 반영&rsquo;을 눌러야 저장됩니다. 파일에 있는 행은 파일 값으로 고치고, 없는 행은 그대로 둡니다.
          </li>
          <li>
            <b>일부 수정</b> — <b>과제 선정 관리</b>의 요구사항·단계·담당 / 과제 탭에서 줄마다 고치거나 추가·삭제합니다. 계정은 <b>사용자 관리</b>, 단가·1 M/D·업무 유형은 <b>단가·기준정보</b>에서 고칩니다. 많이 바꿀 땐 엑셀을 내려받아 고친 뒤 다시 올리는 편이 빠릅니다.
          </li>
          <li>
            <b>담당 지정 (Phase 2)</b> — <b>공수 입력 관리</b>에서 요구사항·단계마다 개발자 한 명을 고릅니다(엑셀 03 공수 태그 매핑 시트로도 들어옴). 담당이 있어야 개발자의 공수 입력 화면에 나타납니다.
          </li>
          <li>
            개발자에게 이 가이드의 <b>처음 준비</b> 탭을 보내 Codex 설치·로그인·AGENTS.md 를 끝내게 합니다. 과제 저장소마다 AGENTS.md 규칙이 들어갔는지 확인합니다.
          </li>
        </ol>
      </Sec>
      <Sec title="측정 중 — 매일·매주">
        <ol className={s.ol}>
          <li>
            <b>시스템 관리 &gt; 수집 현황</b>에서 Codex 기록을 오래 안 올린 사람을 챙깁니다. 업로드는 사람이 해야 들어오므로 가장 흔한 누락입니다.
          </li>
          <li>
            <b>시스템 관리 &gt; 확정 현황</b>에서 다음 날 확정률을 봅니다.
          </li>
          <li>
            <b>공수 모니터링</b>에서 감지된 이상(특히 &lsquo;한 세션에 여러 단계&rsquo;)을 확인하고, 누구에게 어떻게 확인했는지 기록합니다. 기록은 고칠 수 없는 증적으로 남습니다.
          </li>
          <li>
            <b>개선 요청</b>에 들어온 VOC 에 답하고 상태를 바꿉니다.
          </li>
          <li>
            측정이 끝난 단계는 <b>공수 입력 관리</b>에서 &lsquo;측정 완료&rsquo;로 표시합니다. 측정 결과는 기본으로 완료 단계만 집계합니다.
          </li>
          <li>
            <b>과제 선정 현황</b>에서 성격별로 고르게 퍼졌는지(쏠림·공백) 확인합니다.
          </li>
        </ol>
      </Sec>
    </>
  );
}

function Faq() {
  const qa: [string, string][] = [
    ["codex 명령을 찾을 수 없다고 나와요.", "npm 전역 설치 경로가 PATH 에 없는 경우입니다. 터미널을 새로 열어 보고, 그래도 안 되면 `npm config get prefix` 로 나온 폴더를 PATH 에 추가하세요. 패키지 이름이 @openai/codex 인지도 확인하세요."],
    ["sessions 폴더가 안 보여요.", "숨김 폴더입니다. 파일 창 주소줄에 %USERPROFILE%\\.codex\\sessions 를 붙여 넣으세요. WSL 에 설치했다면 \\\\wsl$\\Ubuntu\\home\\<사용자>\\.codex\\sessions 입니다. Codex 를 한 번도 안 썼으면 폴더가 아직 없습니다."],
    ["Codex 를 썼는데 시간이 안 들어와요.", "Codex 시간은 세션 파일을 올려야 들어옵니다. 공수 입력 > Codex 기록 올리기에서 그날 날짜 폴더의 파일을 올리세요. 파일이 없으면 A7 로 넣습니다."],
    ["올렸는데 미분류로만 들어가요.", "첫 메시지에 공수 태그가 없거나 오타입니다. 지시문 버튼으로 복사해 쓰면 생기지 않습니다. 이미 들어온 세션은 미분류에서 요구사항·단계를 골라 이동하세요."],
    ["한 세션에서 분석과 설계를 같이 해 버렸어요.", "미분류에서 단계별로 분을 나눠 배정하세요. 다음부터는 단계가 바뀌면 세션을 닫고 그 단계 지시문으로 새로 시작하세요."],
    ["어제 세션을 이어서(codex resume) 했어요.", "괜찮습니다. 날짜별로 나눠 셉니다. 같은 단계 일이면 그대로 두고, 다른 단계 일이었다면 그날 미분류에서 나눠 배정하세요."],
    ["확정한 날을 고칠 수 있나요?", "그 날짜를 고르고 요구사항 줄의 '수정'을 누르면 확정이 풀립니다. 고친 뒤 다시 확정하세요. 변경 이력은 남습니다."],
    ["AI 시간이 실제보다 많이 잡혔어요.", "'시간 빼기'로 실제 시간으로 낮추고 이유를 메모하세요. 올린 값보다 크게 늘릴 수는 없습니다 — 늘릴 시간은 A7 로 넣습니다."],
    ["주말에 일했어요.", "달력에서 그 날짜를 누르면 입력할 수 있습니다."],
    ["내 요구사항이 안 보여요.", "관리자가 요구사항·단계 담당(사번)으로 지정해야 보입니다. 개선 요청에 남기거나 관리자에게 요청하세요."],
    ["요구사항을 모르는 Codex 세션이 PoC 와 무관해요.", "'업무 외 사용'을 누르면 집계에서 빠집니다."],
    ["포털에 불편한 점·오류가 있어요.", "왼쪽 메뉴 '개선 요청'에 남겨 주세요. 처리 상태와 답변을 거기서 볼 수 있습니다."],
  ];
  return (
    <div className={s.faq}>
      {qa.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
