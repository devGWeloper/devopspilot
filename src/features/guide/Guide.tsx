"use client";

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { RULES, type RuleCd } from "@/lib/measure/monitorRules";
import { ACT_TYPES } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES, type Role } from "@/lib/types";
import s from "./guide.module.css";

type Tab = "dev" | "tips" | "collect" | "result" | "admin" | "faq";

export function Guide({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>(role === "ADMIN" ? "admin" : "dev");
  return (
    <>
      <PageHeader eyebrow="도움말" title="작성 가이드" description="AI 활용 생산성 향상 PoC 의 공수를 어떻게 입력하고, 결과가 어떻게 계산되는지 정리했습니다." />

      <div className={s.flow}>
        {[
          ["1", "과제 선정", "관리자가 선정 양식(엑셀)을 올림"],
          ["2", "AI 사용 수집", "텔레메트리·로그 업로드로 자동"],
          ["3", "공수 입력", "AI 없이 한 일을 날마다 더함"],
          ["4", "이 날 확정", "본인이 확인하고 확정"],
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
              { key: "dev", label: "개발자 — 하루 입력" },
              { key: "tips", label: "작성 팁" },
              { key: "collect", label: "AI 사용 수집 설정" },
              { key: "result", label: "결과 계산 방법" },
              { key: "admin", label: "관리자" },
              { key: "faq", label: "자주 묻는 질문" },
            ]}
          />
        </div>
        <div className={s.body}>
          {tab === "dev" && <Dev />}
          {tab === "tips" && <Tips />}
          {tab === "collect" && <Collect />}
          {tab === "result" && <Result />}
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

function Dev() {
  return (
    <>
      <Sec title="하루 5분 — 퇴근 전에 이것만">
        <ol className={s.ol}>
          <li>
            <b>공수 입력</b> 화면을 열면 확정이 밀린 가장 오래된 날이 먼저 열립니다. 왼쪽 날짜 목록에서 주황색 날이 처리할 날입니다.
          </li>
          <li>
            <b>AI 사용 (자동)</b> 칸을 확인합니다. AI 도구 사용 시간이 단계별로 이미 들어와 있습니다. 자리를 비운 시간이 섞였으면 <b>줄이기</b>로 뺍니다.
          </li>
          <li>
            위에 <b>확인 필요</b>가 있으면 &ldquo;어느 일이었나요?&rdquo;에서 요구사항·단계를 고르거나, 업무와 무관하면 <b>업무 외 사용</b>을 누릅니다.
          </li>
          <li>
            <b>AI 없이 한 일</b>의 ＋ 를 눌러 직접 한 일을 작업 유형별로 시간 입력합니다 (아래 표).
          </li>
          <li>
            합계가 맞으면 <b>이 날 확정</b>. 확정한 날만 측정 결과에 들어갑니다. 고칠 일이 생기면 <b>수정하기</b>로 풀고 다시 확정합니다.
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
      <Sec title="단계 코드 — AI 시간이 알아서 제자리에 붙게">
        <p>
          단계 코드는 <code>요구사항ID-단계</code> 입니다. 공수 입력 표의 회색 코드 옆 <b>복사</b> 버튼으로 복사할 수 있습니다.
        </p>
        <div className={s.codes}>
          {STAGES.map((c) => (
            <span key={c}>
              <code>{c}</code> {STAGE_LABEL[c]}
            </span>
          ))}
        </div>
        <div className={s.dodont}>
          <div className={s.do}>
            <b>이렇게</b>
            <ul>
              <li>
                브랜치명: <code>feature/REQ-0047-DV-event-retry</code>
              </li>
              <li>
                AI 대화 첫 줄: <code>REQ-0047-DV 설비 이벤트 재처리 로직 수정</code>
              </li>
              <li>한 세션에서는 한 단계 일만</li>
            </ul>
          </div>
          <div className={s.dont}>
            <b>이러면 &lsquo;확인 필요&rsquo;로 빠집니다</b>
            <ul>
              <li>
                코드 없이 <code>main</code> 브랜치에서 작업
              </li>
              <li>
                요구사항 ID 만 적음 (<code>REQ-0047</code>) — 내 단계가 2개 이상이면 어느 단계인지 모름
              </li>
              <li>한 대화에서 여러 요구사항 코드를 번갈아 씀</li>
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
              <li>그날 그날 확정 — 기억이 흐려지기 전에</li>
              <li>실제 쓴 시간 그대로. 회의·문의 대응도 A5 협의·소통으로</li>
              <li>AI 를 썼는데 시간이 안 잡혔으면 A7 &lsquo;AI 사용 미수집&rsquo;</li>
              <li>자리 비움·점심 등은 &lsquo;줄이기&rsquo;로 빼고, 이유를 메모</li>
              <li>A8 기타는 메모 필수</li>
            </ul>
          </div>
          <div className={s.dont}>
            <b>피할 것</b>
            <ul>
              <li>매일 같은 시간(예: 8h)을 기계적으로 채우기</li>
              <li>며칠 치를 몰아서 한 번에 확정</li>
              <li>PoC 와 무관한 일을 요구사항에 붙이기</li>
              <li>AI 시간을 이유 없이 크게 줄이기</li>
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
      <Sec title="1순위 — 텔레메트리 (Claude Code)">
        <p>아래 환경변수를 PC 에 설정하면 AI 사용 시간이 포털로 자동 전송됩니다. 대화 원문은 저장하지 않고 단계 코드만 남깁니다.</p>
        <pre className={s.pre}>{`CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_ENDPOINT=http://<포털 주소>/api/otel
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <수집 토큰 — 관리자에게 받음>
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta
OTEL_RESOURCE_ATTRIBUTES=poc.user=<포털 로그인 ID>
OTEL_LOG_USER_PROMPTS=1`}</pre>
      </Sec>
      <Sec title="2순위 — 로컬 로그 업로드">
        <p>
          텔레메트리를 못 쓰는 PC 는 공수 입력 &gt; <b>AI 사용 기록 올리기</b>에서 수집 스크립트를 받아 실행하고, 만들어진 JSON 파일을 올립니다. 같은 파일을 다시 올려도 중복되지 않습니다.
        </p>
        <pre className={s.pre}>py collect_ai_usage.py --since 2026-11-01</pre>
      </Sec>
      <Sec title="3순위 — 수기">
        <p>둘 다 안 되면 &lsquo;AI 없이 한 일&rsquo;의 A7 AI 사용 미수집으로 직접 넣습니다.</p>
      </Sec>
      <Sec title="수집된 시간이 단계에 붙는 방법">
        <ol className={s.ol}>
          <li>세션의 브랜치명·대화 첫 줄에서 단계 코드(REQ-0047-DV)를 찾으면 그 단계에 바로 붙습니다.</li>
          <li>요구사항 ID 만 있고 내 담당 단계가 하나뿐이면 그 단계에 붙습니다.</li>
          <li>그 외(코드 없음, 여러 개)는 &lsquo;확인 필요&rsquo;로 남아 개발자가 고릅니다. 고르기 전까지 결과에 들어가지 않습니다.</li>
          <li>개발자가 확정하면 그날 값이 결과에 들어갑니다. 확정 뒤 수집값이 늦게 들어와 달라지면 &lsquo;재확정 필요&rsquo;가 됩니다.</li>
        </ol>
      </Sec>
    </>
  );
}

function Result() {
  return (
    <>
      <Sec title="지표">
        <table className={s.table}>
          <tbody>
            <tr>
              <th>투입 공수 절감률</th>
              <td>(기준 M/D − 투입 M/D) ÷ 기준 M/D. 투입 M/D = 확정 공수(h) ÷ 1 M/D 시간</td>
            </tr>
            <tr>
              <th>순절감률 (비용)</th>
              <td>(기준 인건비 − 측정 인건비 − AI 비용) ÷ 기준 인건비. 인건비 = M/D × 요구사항 필요 등급 단가, AI 비용 = AI 시간 × 도구별 시간당 단가</td>
            </tr>
            <tr>
              <th>AI 활용률</th>
              <td>AI 사용 시간 ÷ 전체 확정 공수</td>
            </tr>
          </tbody>
        </table>
        <p className={s.note}>기준 M/D 는 선정 양식의 기준 공수(AI 미적용)입니다. 기본은 측정 완료 요구사항만, 확정된 날만 집계합니다. 숫자 하나하나의 근거는 측정 결과 &gt; 산출 근거 보기에서 일자·세션 단위까지 볼 수 있습니다.</p>
      </Sec>
    </>
  );
}

function Admin() {
  return (
    <>
      <Sec title="관리자 할 일">
        <ol className={s.ol}>
          <li>
            <b>과제 현황</b> &gt; 양식 내려받기 → 선정된 과제·요구사항 작성 → 엑셀 올리기. 같은 요구사항 ID 는 덮어씁니다.
          </li>
          <li>요구사항을 눌러 단계별 담당 개발자를 지정합니다. 담당이 있어야 개발자 화면에 나타납니다.</li>
          <li>개발이 끝난 요구사항은 &lsquo;측정 완료&rsquo;로 지정합니다. 측정 결과는 기본으로 측정 완료만 집계합니다.</li>
          <li>
            <b>과제 선정 현황</b>에서 성격별로 고르게 퍼졌는지(쏠림·공백) 확인합니다.
          </li>
          <li>
            <b>공수 모니터링</b>에서 감지된 이상을 확인하고, 누구에게 어떻게 확인했는지 기록합니다. 기록은 고칠 수 없는 증적으로 남습니다.
          </li>
          <li>
            <b>시스템 관리</b>에서 계정, 단가·1 M/D 시간, 수집 토큰을 관리합니다.
          </li>
        </ol>
      </Sec>
    </>
  );
}

function Faq() {
  const qa: [string, string][] = [
    ["확정한 날을 고칠 수 있나요?", "공수 입력에서 그 날을 열고 '수정하기'를 누르면 확정이 풀립니다. 고친 뒤 다시 확정하세요. 변경 이력은 남습니다."],
    ["AI 시간이 실제보다 많이 잡혔어요.", "'줄이기'로 실제 시간으로 낮추고 이유를 메모하세요. 수집값보다 크게 늘릴 수는 없습니다 — 늘릴 시간은 A7 로 넣습니다."],
    ["주말에 일했어요.", "날짜 목록 위 달력에서 그 날을 골라 입력하면 됩니다."],
    ["내 요구사항이 안 보여요.", "관리자가 단계 담당자로 지정해야 보입니다. 관리자에게 요청하세요."],
    ["확인 필요 세션이 PoC 와 무관해요.", "'업무 외 사용'을 누르면 집계에서 빠집니다."],
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
