"use client";

import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import type { MetricDef } from "@/lib/measure/metrics";
import { RULES, type RuleCd } from "@/lib/measure/monitorRules";
import { ACT_TYPES } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES, type Role } from "@/lib/types";
import s from "./guide.module.css";

type Tab = "dev" | "tips" | "collect" | "result" | "admin" | "faq";

export function Guide({ role, metrics }: { role: Role; metrics: MetricDef[] }) {
  const [tab, setTab] = useState<Tab>(role === "ADMIN" ? "admin" : "dev");
  return (
    <>
      <PageHeader eyebrow="도움말" title="작성 가이드" description="AI 활용 생산성 향상 PoC 의 공수를 어떻게 입력하고, 결과가 어떻게 계산되는지 정리했습니다." />

      <div className={s.flow}>
        {[
          ["1", "과제 선정", "관리자가 기준정보 엑셀을 올림"],
          ["2", "Codex 사용 수집", "세션 첫 줄 단계 코드로 단계별 자동 배정"],
          ["3", "공수 입력", "일자 × 단계 표에 AI 없이 한 일을 더함"],
          ["4", "일자별 확정", "본인이 확인하고 확정"],
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

function Dev() {
  return (
    <>
      <Sec title="AI 세션을 시작할 때 — 첫 줄에 단계 코드">
        <p>
          측정은 <b>요구사항 × SDLC 단계(분석·설계·개발·테스트)</b> 단위입니다. Codex 세션을 열 때마다 첫 줄에 이번 세션이 어느 단계 일인지 코드를 적어 주세요. 공수 입력 화면의 <code>poc …</code> 옆 <b>복사</b> 버튼으로 그대로 복사할 수 있습니다.
        </p>
        <div className={s.codes}>
          <span>
            <code>poc DAE01-REQ0047-AN</code> 분석 세션
          </span>
          <span>
            <code>poc DAE01-REQ0047-DS</code> 설계 세션
          </span>
          <span>
            <code>poc DAE01-REQ0047-DV</code> 개발 세션
          </span>
          <span>
            <code>poc DAE01-REQ0047-TS</code> 테스트 세션
          </span>
          <span>
            <code>poc off</code> 업무 외 사용
          </span>
        </div>
        <p className={s.note}>과제 ID 를 빼고 <code>REQ0047-DV</code> 처럼 적어도 내 담당 중 하나로 정해지면 붙습니다. 단계가 바뀌면 새 세션을 열어 새 코드를 적습니다.</p>
      </Sec>
      <Sec title="하루 5분 — 퇴근 전에 이것만">
        <ol className={s.ol}>
          <li>
            <b>공수 입력</b> 화면 왼쪽에서 요구사항을 고릅니다. 확정이 밀린 요구사항이 먼저 열립니다 (&lsquo;확정 필요 n일&rsquo;).
          </li>
          <li>
            오른쪽 표는 <b>일자 × 단계</b>입니다. 각 칸의 <b>AI</b> 숫자는 자동으로 들어온 AI 사용 시간입니다. 자리를 비운 시간이 섞였으면 <b>줄이기</b>로 뺍니다.
          </li>
          <li>
            위에 <b>확인 필요</b>가 있으면 &ldquo;어느 단계였나요?&rdquo;에서 요구사항·단계를 고르거나, 업무와 무관하면 <b>업무 외 사용</b>을 누릅니다.
          </li>
          <li>
            칸의 <b>＋ 외</b>를 눌러 AI 없이 직접 한 일을 작업 유형별로 시간 입력합니다 (아래 표).
          </li>
          <li>
            합계가 맞으면 그 줄의 <b>확정</b>. 밀린 날이 여럿이면 <b>모두 확정</b>. 확정한 날만 측정 결과에 들어갑니다. 고칠 일이 생기면 확정된 날 목록에서 <b>수정</b>으로 풀고 다시 확정합니다.
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
      <Sec title="공수 태그 — Codex 시간이 알아서 제자리에 붙게">
        <p>
          공수 태그는 <code>과제ID-요구사항ID-단계</code> 입니다(예: <code>DAE01-REQ0047-DV</code>). 공수 입력 화면의 <code>poc …</code> 옆 <b>복사</b> 버튼으로 복사할 수 있습니다. 태그 하나에 담당은 한 명입니다.
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
                브랜치명: <code>feature/DAE01-REQ0047-DV-event-retry</code>
              </li>
              <li>
                Codex 대화 첫 줄: <code>poc DAE01-REQ0047-DV 설비 이벤트 수신 로직 수정</code>
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
                요구사항까지만 적음 (<code>DAE01-REQ0047</code>) — 내 단계가 2개 이상이면 어느 단계인지 모름
              </li>
              <li>
                과제 ID 없이 요구사항 ID 만 (<code>REQ0047</code>) — 다른 과제에 같은 ID 가 있으면 어느 과제인지 모름
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
      <Sec title="1순위 — 텔레메트리 (Codex)">
        <p>
          <code>~/.codex/config.toml</code> 에 아래를 넣으면 Codex 이벤트가 포털로 자동 전송됩니다. 포털은 이벤트 간격(5분 이내만)으로 활동 시간을, 응답 완료 이벤트로 토큰을 셉니다. 프롬프트는 공수 태그 후보만 뽑고 원문은 버립니다.
        </p>
        <pre className={s.pre}>{`[otel]
environment = "poc"
log_user_prompt = true   # 프롬프트에서 공수 태그를 찾기 위해 — 원문은 포털에 저장되지 않음

[otel.exporter.otlp-http]
endpoint = "http://<포털 주소>/api/otel/v1/logs"
protocol = "json"
headers = { "authorization" = "Bearer <수집 토큰 — 관리자에게 받음>" }`}</pre>
        <p className={s.note}>
          사람은 Codex 로그인 계정(<code>user.email</code>·<code>user.account_id</code>)으로 구분합니다. 관리자가 기준 데이터 &gt; 03 개발자 권한의 <b>AI 도구 계정</b>에 그 값을 넣어 두어야 내 시간으로 들어옵니다.
        </p>
      </Sec>
      <Sec title="2순위 — 로컬 로그 업로드">
        <p>
          텔레메트리를 못 쓰는 PC 는 공수 입력 &gt; <b>AI 사용 기록 올리기</b>에서 수집 스크립트를 받아 실행하고, 만들어진 JSON 파일을 올립니다. 스크립트는 <code>~/.codex/sessions</code> 의 세션 기록에서 시간·토큰·태그 후보만 뽑습니다. 같은 파일을 다시 올려도 중복되지 않습니다.
        </p>
        <pre className={s.pre}>py collect_ai_usage.py --since 2026-11-01</pre>
      </Sec>
      <Sec title="3순위 — 수기">
        <p>둘 다 안 되면 &lsquo;AI 없이 한 일&rsquo;의 A7 AI 사용 미수집으로 직접 넣습니다.</p>
      </Sec>
      <Sec title="수집된 시간이 단계에 붙는 방법">
        <ol className={s.ol}>
          <li>세션의 브랜치명·대화에서 공수 태그(DAE01-REQ0047-DV)를 찾으면 그 태그에 바로 붙습니다.</li>
          <li>요구사항 ID + 단계(REQ0047-DV)만 있어도 내 담당 중 하나로 정해지면 붙습니다.</li>
          <li>과제ID-요구사항ID(또는 요구사항 ID)만 있고 내 담당 태그가 하나뿐이면 그 태그에 붙습니다.</li>
          <li><code>poc off</code> 만 있으면 업무 외 사용으로 빠집니다(측정에 안 들어감).</li>
          <li>그 외(코드 없음, 여러 개, poc off 와 코드가 함께)는 &lsquo;확인 필요&rsquo;로 남아 개발자가 고릅니다. 고르기 전까지 결과에 들어가지 않습니다.</li>
          <li>개발자가 확정하면 그날 값이 결과에 들어갑니다. 확정 뒤 수집값이 늦게 들어와 달라지면 &lsquo;다시 확정 필요&rsquo;가 됩니다.</li>
        </ol>
      </Sec>
    </>
  );
}

function Result({ metrics }: { metrics: MetricDef[] }) {
  return (
    <>
      <Sec title="지표 — 기준정보 엑셀 '05. 주요 집계 로직'">
        <table className={s.table}>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key}>
                <th>
                  {m.name}
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
        <p className={s.note}>기준 M/D 는 공수 태그의 기준 공수(AI 미적용)입니다. 기본은 측정 완료 태그만, 확정된 날만 집계합니다. 숫자 하나하나의 근거는 측정 결과 &gt; 산출 근거 보기에서 일자·세션 단위까지 볼 수 있습니다.</p>
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
            <b>기준 데이터</b> &gt; 엑셀 내려받기 → 01 과제 · 02 요구사항-SDLC · 03 공수 태그 매핑·개발자 권한 · 04 단가 작성 → 엑셀 올리기. 파일에 있는 행은 파일 값으로 고칩니다.
          </li>
          <li>공수 태그마다 담당 사번 한 명을 매핑합니다. 담당이 있어야 개발자 화면에 나타납니다. 개발자의 AI 도구 계정(Codex 로그인)을 넣어야 텔레메트리가 그 사람 것으로 들어옵니다.</li>
          <li>측정이 끝난 태그는 측정 상태 &lsquo;완료&rsquo;로 지정합니다. 측정 결과는 기본으로 완료 태그만 집계합니다.</li>
          <li>
            <b>과제 선정 현황</b>에서 성격별로 고르게 퍼졌는지(쏠림·공백) 확인합니다.
          </li>
          <li>
            <b>공수 모니터링</b>에서 감지된 이상을 확인하고, 누구에게 어떻게 확인했는지 기록합니다. 기록은 고칠 수 없는 증적으로 남습니다.
          </li>
          <li>
            <b>시스템 관리</b>에서 확정 현황(다음 날 확정률)·Codex 수집 현황·변경 이력을 봅니다. 수집 토큰은 config.yml 의 collect.token 입니다.
          </li>
        </ol>
      </Sec>
    </>
  );
}

function Faq() {
  const qa: [string, string][] = [
    ["확정한 날을 고칠 수 있나요?", "공수 입력에서 요구사항을 고르고 '확정된 날'을 펼쳐 그 줄의 '수정'을 누르면 확정이 풀립니다. 고친 뒤 다시 확정하세요. 변경 이력은 남습니다."],
    ["AI 시간이 실제보다 많이 잡혔어요.", "'줄이기'로 실제 시간으로 낮추고 이유를 메모하세요. 수집값보다 크게 늘릴 수는 없습니다 — 늘릴 시간은 A7 로 넣습니다."],
    ["주말에 일했어요.", "요구사항 표 아래 '＋ 기록 없는 날 추가'에서 그 날을 고르면 입력 줄이 생깁니다."],
    ["내 요구사항이 안 보여요.", "관리자가 공수 태그 담당(사번)으로 지정해야 보입니다. 관리자에게 요청하세요."],
    ["Codex 를 썼는데 시간이 안 들어와요.", "관리자에게 내 AI 도구 계정(Codex 로그인 이메일)이 등록됐는지 확인하세요. 텔레메트리를 못 쓰면 로그 업로드를 쓰고, 그것도 안 되면 A7 로 넣습니다."],

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
