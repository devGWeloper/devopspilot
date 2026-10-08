# PoC 과제 선정 · Replay 측정 포털 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SK hynix·SK AX 공동 합의용 PoC 과제 선정 포털과 Replay 생산성 측정 모듈을 Next.js 풀스택으로 만든다.

**Architecture:** Next.js 14 App Router 단일 앱. 모든 비즈니스 규칙(적합도 판정·균형·권한·측정 지표)은 `src/lib` 의 순수 함수에 두고 vitest 로 고정한다. 저장은 `Store` 인터페이스 뒤에 Oracle 구현과 JSON 파일 구현을 두며 `config.yml` 의 db 설정 유무로 고른다. 화면은 클라이언트 컴포넌트가 `/api/*` 를 `apiClient` 로만 호출한다.

**Tech Stack:** Next.js 14.2.35, React 18.3.1, TypeScript 5.5.3, oracledb ^6.5.1, js-yaml, recharts ^3.8.1, exceljs, pretendard, vitest, @langchain/openai (보조).

**Spec:**
- `docs/superpowers/specs/2026-10-07-poc-selection-design.md`
- `docs/superpowers/specs/2026-10-07-replay-measurement-design.md`

## Global Constraints

- 버전 고정: next `14.2.35`, react/react-dom `18.3.1`, typescript `5.5.3`, @types/react `18.3.3`, @types/react-dom `18.3.0`, @types/node `20.14.10`.
- 선정 화면에 숫자 점수·총점·가중치를 두지 않는다. 숫자는 건수(과제 수, 응답 수)만. 측정 화면만 정량 지표 사용.
- DB: 테이블 5개(`POC_USER_MAS`, `POC_PRJ_MAS`, `POC_CFG_MAS`, `POC_HIST_HIS`, `POC_MEAS_DAT`), **조인 금지**, 모든 SQL 값은 바인드 변수.
- `config.yml` 없음 또는 db 비어 있음 → JSON 저장소(`data/`). db 설정이 있는데 연결 실패 → JSON 으로 바꾸지 않고 오류.
- 최초 계정 `admin` / `admin123!` / `AX_ADMIN`.
- 용어: "재수행", "재작업" 금지(UI·식별자·문서). 보완요청 상태 코드 `SUPPLEMENT`.
- 측정 용어: 기존 실적 (A), Replay 테스트 (B), 사후 수정, 공수 기록표.
- 지표 계산은 `src/lib/measure/metrics.ts` 한 곳. 단가·기간 등은 설정값(하드코딩 금지).
- 주석은 '왜'만.
- AI 기능은 `llm.enabled` false 면 완전히 숨김. AI 코드는 `src/lib/ai`, `src/features/ai`, `src/app/(main)/admin/ai`, `src/app/api/ai` 에만.
- 클라이언트 → API 호출은 `src/lib/apiClient.ts` 의 `api()` 로만.
- 디자인 토큰: 바탕 `#F5F4F0`, 텍스트 `#14213D`, 헤어라인 `#E4E1D8`, 강조 `#2B3A8C`, 상 `#1E7A5A`, 중 `#B7791F`, 하 `#B4443C`, 미평가 `#8A8F98`. 폰트 Pretendard(셀프 호스팅).

## Review Focus

1. **PM 이 남의 과제 또는 제출 후 과제를 API 로 직접 수정** → 403. (Task 11 서비스 테스트)
2. **두 사람이 같은 과제를 동시에 저장** → 나중 저장은 409, 데이터 덮어쓰지 않음. (Task 6 JSON store, Task 11 서비스 테스트)
3. **평가 기준 게시 후 지표가 삭제·추가된 과제 재판정** → 사라진 지표 응답은 버리고, 확정 적합도는 유지. (Task 3 `reconcileAnswers` 테스트)
4. **같은 CSV(사용량·커밋·Jira) 재업로드** → 건수 증가 없이 덮어쓰기. (Task 20 키 테스트, Task 22 JSON meas upsert 테스트)
5. **분모 0 지표(완료 기능 없음, 변경 라인 0)** → `null` 반환·화면 `—`, NaN/Infinity 금지. (Task 19 metrics 테스트)

---

## Phase A — 기반

### Task 1: 프로젝트 스캐폴드

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`, `config.example.yml`, `next-env.d.ts`, `src/app/layout.tsx`, `src/app/page.tsx`(임시), `README.md`, `tests/smoke.test.ts`

- [ ] **Step 1:** `package.json`

```json
{
  "name": "poc-portal",
  "version": "0.1.0",
  "private": true,
  "description": "AI Tool PoC 과제 선정 · Replay 생산성 측정 포털",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "exceljs": "^4.4.0",
    "js-yaml": "^4.1.1",
    "next": "14.2.35",
    "oracledb": "^6.5.1",
    "pretendard": "^1.3.9",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "recharts": "^3.8.1"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "20.14.10",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "typescript": "5.5.3",
    "vitest": "^3.2.4"
  }
}
```
`@langchain/openai`, `@langchain/core` 는 Task 30 에서 추가.

- [ ] **Step 2:** `tsconfig.json` (strict, `paths: {"@/*": ["./src/*"]}`, `moduleResolution: "bundler"`, `jsx: "preserve"`, Next plugin), `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverComponentsExternalPackages: ["oracledb", "exceljs"] },
};
export default nextConfig;
```

- [ ] **Step 3:** `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 4:** `.gitignore`: `node_modules/ .next/ data/ config.yml *.log .env*`. `config.example.yml` 은 스펙 2절 내용 그대로.

- [ ] **Step 5:** `tests/smoke.test.ts` → `expect(1+1).toBe(2)`. `npm install` → `npm test` PASS, `npm run typecheck` PASS.

- [ ] **Step 6:** Commit `chore: Next.js 14 프로젝트 스캐폴드`

### Task 2: 도메인 타입 · 기본 평가 기준

**Files:**
- Create: `src/lib/types.ts`, `src/lib/criteria/defaults.ts`
- Test: `tests/criteria-defaults.test.ts`

**Interfaces (Produces):**
```ts
// src/lib/types.ts
export type Role = "AX_ADMIN" | "HX_REVIEWER" | "PM" | "DEVELOPER" | "TESTER" | "VIEWER";
export type OrgCd = "SKAX" | "SKHYNIX";
export type Level = "H" | "M" | "L";
export type Fit = Level | "NA";
export type Tier = "MAJOR" | "MINOR";
export type ProjectStatus = "DRAFT" | "SUBMITTED" | "REVIEW" | "SUPPLEMENT" | "SELECTED" | "RESERVE" | "EXCLUDED";
export type AgreeCd = "AGREE" | "DISAGREE" | "HOLD" | "NONE";
export interface CriteriaOption { id: string; label: string; level: Level; hint?: string }
export interface Indicator { id: string; name: string; description: string; tier: Tier; options: CriteriaOption[] }
export interface Area { id: string; name: string; question: string; indicators: Indicator[] }
export interface FitRule { lowMinMajorLow: number; highMaxMajorLow: number; highMinMajorHigh: number | "half" }
export interface Criteria { version: number; publishedAt: string | null; publishedBy: string | null; rule: FitRule; areas: Area[] }
export interface CodeItem { code: string; label: string }
export interface BalanceTarget { total: number; byFit: Record<Level, number>; minPerDevType: number; minLangKinds: number }
export interface Codes { langs: CodeItem[]; domains: CodeItem[]; sysTypes: CodeItem[]; target: BalanceTarget }
export interface UserRecord { userId: string; userNm: string; orgCd: OrgCd; deptNm: string; role: Role; useYn: boolean;
  pwdHash: string; pwdSalt: string; lastLoginAt: string | null; regAt: string; updAt: string }
export type PublicUser = Omit<UserRecord, "pwdHash" | "pwdSalt">;
export type ReplayPhase = "ANALYSIS" | "DESIGN" | "DEV" | "TEST";
export interface ProjectBaseline { startDate: string | null; endDate: string | null; totalMm: number | null;
  phaseMm: Record<ReplayPhase, number | null>; screens: number | null; programs: number | null; loc: number | null; replayPhases: ReplayPhase[] }
export interface ProjectBase { description: string; domainCd: string; sysTypeCd: string; langCds: string[]; techStack: string; orgNm: string; baseline: ProjectBaseline }
export interface FitConfirm { fit: Level; reason: string; by: string; byNm: string; at: string }
export interface EvalData { answers: Record<string, string>; notes: Record<string, string>; confirm: FitConfirm | null }
export interface ReviewEntry { id: string; side: "AX" | "HX"; userId: string; userNm: string; agree: AgreeCd; text: string; at: string; context: "SELECTION" | "MEASURE" }
export interface AiResult { grade: Level; summary: string; strengths: string[]; risks: string[];
  indicatorComments: { indicatorId: string; comment: string }[]; replayNotes: string; balanceNote: string;
  model: string; promptVersion: number; criteriaVersion: number; assessedAt: string; assessedBy: string }
export interface Project { prjId: string; prjNm: string; sysNm: string; pmUserId: string; pmUserNm: string; status: ProjectStatus;
  statusNote: string | null; devTypeCd: string | null; mainLangCd: string | null; domainCd: string | null; sysTypeCd: string | null;
  answerCnt: number; indicatorCnt: number; suggestFit: Fit; finalFit: Fit; aiFit: Fit | null; axAgree: AgreeCd; hxAgree: AgreeCd;
  critVer: number; base: ProjectBase; eval: EvalData; reviews: ReviewEntry[]; ai: AiResult | null;
  regUserId: string; regAt: string; updUserId: string; updAt: string }
export interface HistoryEntry { histId: number; targetTyp: "PROJECT" | "CRITERIA" | "USER" | "CODES" | "AI_PROMPT" | "UPLOAD" | "MEASURE";
  targetId: string; actionCd: string; summary: string; diff: unknown; userId: string; userNm: string; regAt: string }
export const DEV_TYPE_INDICATOR = "devType";
export const EXEC_TYPE_INDICATOR = "execType";
```
```ts
// src/lib/criteria/defaults.ts
export const DEFAULT_RULE: FitRule; export function defaultCriteria(): Criteria; export function defaultCodes(): Codes;
```

- [ ] **Step 1: failing test** `tests/criteria-defaults.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { defaultCriteria, defaultCodes } from "@/lib/criteria/defaults";
import { DEV_TYPE_INDICATOR, EXEC_TYPE_INDICATOR } from "@/lib/types";

describe("defaultCriteria", () => {
  const c = defaultCriteria();
  const inds = c.areas.flatMap((a) => a.indicators);
  it("4개 영역 17개 지표", () => {
    expect(c.areas).toHaveLength(4);
    expect(inds).toHaveLength(17);
  });
  it("Major 8개", () => expect(inds.filter((i) => i.tier === "MAJOR")).toHaveLength(8));
  it("지표·선택지 id 유일", () => {
    const ids = inds.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of inds) expect(new Set(i.options.map((o) => o.id)).size).toBe(i.options.length);
  });
  it("분류용 지표 존재", () => {
    expect(inds.some((i) => i.id === DEV_TYPE_INDICATOR)).toBe(true);
    expect(inds.some((i) => i.id === EXEC_TYPE_INDICATOR)).toBe(true);
  });
  it("버전 1, 규칙 기본값", () => {
    expect(c.version).toBe(1);
    expect(c.rule).toEqual({ lowMinMajorLow: 2, highMaxMajorLow: 0, highMinMajorHigh: "half" });
  });
  it("코드 기본값", () => {
    const k = defaultCodes();
    expect(k.langs.length).toBeGreaterThanOrEqual(7);
    expect(k.target.byFit).toEqual({ H: 3, M: 3, L: 3 });
  });
});
```

- [ ] **Step 2:** `npm test` → FAIL (module not found)
- [ ] **Step 3:** 구현 — 스펙 5.4 표의 지표·선택지 그대로. id: 영역 `char`/`know`/`tool`/`gov`, 지표 `devType`, `reqType`, `execType`, `scope`, `risk`, `rag`, `funcSpec`, `archDoc`, `ifSpec`, `exception`, `netModel`, `readScope`, `agentScope`, `telemetry`, `vcs`, `devRule`, `regression`, `aiReview`. 선택지 id 는 `new`/`mixed`/`legacy` 처럼 영문 슬러그. codes 는 스펙 5.5, target `{ total: 9, byFit: {H:3,M:3,L:3}, minPerDevType: 1, minLangKinds: 3 }`.
- [ ] **Step 4:** `npm test` PASS
- [ ] **Step 5:** Commit `feat: 도메인 타입과 기본 평가 기준`

### Task 3: 적합도 판정 `fitness.ts`

**Files:** Create `src/lib/fitness.ts`; Test `tests/fitness.test.ts`

**Interfaces (Produces):**
```ts
export interface ProfileCell { indicatorId: string; areaId: string; tier: Tier; level: Level | null; optionLabel: string | null }
export interface FitEvaluation { profile: ProfileCell[]; answerCnt: number; indicatorCnt: number;
  majorCount: Record<Level, number> & { total: number; answered: number }; suggest: Fit; ruleText: string; minorLows: string[] }
export function buildProfile(c: Criteria, answers: Record<string, string>): ProfileCell[];
export function evaluateFit(c: Criteria, answers: Record<string, string>): FitEvaluation;
export function reconcileAnswers(c: Criteria, answers: Record<string, string>, notes: Record<string, string>): { answers: Record<string, string>; notes: Record<string, string> };
export function deriveColumns(c: Criteria, p: Pick<Project, "base" | "eval">): Pick<Project, "devTypeCd" | "mainLangCd" | "domainCd" | "sysTypeCd" | "answerCnt" | "indicatorCnt" | "suggestFit" | "finalFit" | "critVer">;
export const FIT_LABEL: Record<Fit, string>; // H:"상" M:"중" L:"하" NA:"미평가"
```
규칙: Major 모두 응답 아니면 `NA`. `highMinMajorHigh === "half"` → `Math.floor(total/2)+1`. ruleText 예: `"Major 8개 중 하 0개, 상 5개 → 상"`, 미응답 시 `"Major 8개 중 3개 미응답 → 미평가"`.

- [ ] **Step 1: failing test**

```ts
import { describe, it, expect } from "vitest";
import { defaultCriteria } from "@/lib/criteria/defaults";
import { evaluateFit, reconcileAnswers, buildProfile } from "@/lib/fitness";
import type { Criteria, Level } from "@/lib/types";

const c = defaultCriteria();
const majors = c.areas.flatMap((a) => a.indicators).filter((i) => i.tier === "MAJOR");
const minors = c.areas.flatMap((a) => a.indicators).filter((i) => i.tier === "MINOR");
const pick = (ind: { options: { id: string; level: Level }[] }, lv: Level) => ind.options.find((o) => o.level === lv)!.id;
function answer(majorLevels: Level[], minorLevel: Level = "H") {
  const a: Record<string, string> = {};
  majors.forEach((m, i) => (a[m.id] = pick(m, majorLevels[i])));
  minors.forEach((m) => (a[m.id] = pick(m, m.options.some((o) => o.level === minorLevel) ? minorLevel : "H")));
  return a;
}

describe("evaluateFit", () => {
  it("Major 하 0개 + 상 과반(5/8) → 상", () => {
    expect(evaluateFit(c, answer(["H","H","H","H","H","M","M","M"])).suggest).toBe("H");
  });
  it("Major 상이 정확히 절반(4/8) → 중", () => {
    expect(evaluateFit(c, answer(["H","H","H","H","M","M","M","M"])).suggest).toBe("M");
  });
  it("Major 하 1개 → 중", () => {
    expect(evaluateFit(c, answer(["H","H","H","H","H","H","H","L"])).suggest).toBe("M");
  });
  it("Major 하 2개 → 하", () => {
    expect(evaluateFit(c, answer(["H","H","H","H","H","H","L","L"])).suggest).toBe("L");
  });
  it("Minor 가 전부 하여도 제안은 바뀌지 않고 보완 신호에 나온다", () => {
    const r = evaluateFit(c, answer(["H","H","H","H","H","M","M","M"], "L"));
    expect(r.suggest).toBe("H");
    expect(r.minorLows.length).toBeGreaterThan(0);
  });
  it("Major 하나라도 미응답 → 미평가", () => {
    const a = answer(["H","H","H","H","H","H","H","H"]);
    delete a[majors[0].id];
    const r = evaluateFit(c, a);
    expect(r.suggest).toBe("NA");
    expect(r.ruleText).toContain("미응답");
  });
  it("존재하지 않는 선택지 id 는 미응답 취급", () => {
    const a = answer(["H","H","H","H","H","H","H","H"]);
    a[majors[0].id] = "nope";
    expect(evaluateFit(c, a).suggest).toBe("NA");
  });
  it("규칙 값 변경 반영 (lowMinMajorLow=1)", () => {
    const c2: Criteria = { ...c, rule: { ...c.rule, lowMinMajorLow: 1 } };
    expect(evaluateFit(c2, answer(["H","H","H","H","H","H","H","L"])).suggest).toBe("L");
  });
  it("응답 수 집계", () => {
    const r = evaluateFit(c, { [majors[0].id]: pick(majors[0], "H") });
    expect(r.answerCnt).toBe(1);
    expect(r.indicatorCnt).toBe(17);
  });
});

describe("reconcileAnswers", () => {
  it("기준에서 사라진 지표·선택지 응답과 메모를 버린다", () => {
    const r = reconcileAnswers(c, { devType: "new", gone: "x", risk: "nope" }, { devType: "m", gone: "n" });
    expect(r.answers).toEqual({ devType: "new" });
    expect(r.notes).toEqual({ devType: "m" });
  });
});

describe("buildProfile", () => {
  it("지표 순서대로 17칸", () => {
    const p = buildProfile(c, {});
    expect(p).toHaveLength(17);
    expect(p.every((x) => x.level === null)).toBe(true);
  });
});
```
- [ ] **Step 2:** FAIL 확인 → **Step 3:** 구현 (`deriveColumns`: finalFit = eval.confirm?.fit ?? "NA", mainLangCd = base.langCds[0] ?? null, devTypeCd = answers[DEV_TYPE_INDICATOR] ?? null, critVer = c.version) → **Step 4:** PASS → **Step 5:** Commit `feat: 지표 프로필 기반 적합도 판정`

### Task 4: 균형 분석 `balance.ts`

**Files:** Create `src/lib/balance.ts`; Test `tests/balance.test.ts`

**Interfaces:**
```ts
export interface BalanceWarning { kind: "TOTAL" | "FIT" | "DEV_TYPE" | "LANG"; message: string }
export interface BalanceReport { selectedCount: number; byFit: Record<Fit, number>; byDevType: Record<string, number>;
  byLang: Record<string, number>; byDomain: Record<string, number>; bySysType: Record<string, number>; warnings: BalanceWarning[] }
export function analyzeBalance(projects: Project[], c: Criteria, codes: Codes, statuses?: ProjectStatus[]): BalanceReport;
```
선정 집합 기본 = `["SELECTED"]`. 적합도는 `finalFit`, NA 면 `suggestFit`. 경고 문장 예: `"하 적합도 목표 3건 중 1건"`, `"개발 성격 '레거시' 선정 0건"`, `"언어 2종 (목표 3종 이상)"`, `"선정 7건 (목표 9건)"`. 개발 성격 라벨은 기준의 devType 지표 선택지 라벨에서.

- [ ] **Step 1: failing test** — 픽스처 함수 `mk(partial)` 로 Project 생성(필수 필드 기본값). 케이스: (a) 선정 0건 → TOTAL·FIT 3개·DEV_TYPE 3개 경고, (b) 목표 충족(상3/중3/하3, 신규·혼합·레거시 각 1+, 언어 3종, 9건) → warnings 빈 배열, (c) SELECTED 아닌 상태 제외, (d) finalFit NA 면 suggestFit 사용, (e) statuses 인자 `["SELECTED","RESERVE"]` 반영.
- [ ] **Step 2-4:** FAIL → 구현 → PASS
- [ ] **Step 5:** Commit `feat: 선정 포트폴리오 균형 분석`

### Task 5: 권한 `permissions.ts`

**Files:** Create `src/lib/auth/permissions.ts`; Test `tests/permissions.test.ts`

**Interfaces:**
```ts
export const ROLE_LABEL: Record<Role, string>; // AX 관리자, HX 검토자, 과제 PM, 개발자, 테스트 수행자, 열람자
export interface Actor { userId: string; role: Role }
export type Action =
  | "project.create" | "project.edit" | "project.submit" | "project.status" | "project.confirm" | "project.review"
  | "criteria.manage" | "codes.manage" | "users.manage" | "history.view" | "export"
  | "ai.use" | "measure.feature" | "measure.effort" | "measure.defect" | "measure.upload.usage"
  | "measure.upload.commit" | "measure.settings" | "measure.comment";
export function can(actor: Actor, action: Action, ctx?: { project?: Pick<Project, "pmUserId" | "status">; feature?: { devUserId: string | null } }): boolean;
export function canAccessPath(role: Role, pathname: string): boolean;
export function homePathFor(role: Role): string; // DEVELOPER→/today, TESTER→/defects, 그 외 "/"
export function reviewSide(actor: Actor & { orgCd: OrgCd }): "AX" | "HX" | null;
```
규칙 요약:
- AX_ADMIN: 모든 action true.
- project.create: AX_ADMIN, PM.
- project.edit: AX_ADMIN 은 status 무관 true / PM 은 `pmUserId===userId && status∈{DRAFT,SUPPLEMENT}`.
- project.submit: PM 본인 && DRAFT|SUPPLEMENT.
- project.review: AX_ADMIN, HX_REVIEWER. measure.comment: AX_ADMIN, HX_REVIEWER.
- export: VIEWER 제외 전원.
- measure.feature: PM 본인 과제 && status SELECTED. measure.effort: DEVELOPER && feature.devUserId===userId && project SELECTED. measure.defect: TESTER(SELECTED 과제). measure.upload.usage: DEVELOPER. measure.upload.commit: PM 본인 과제.
- 나머지 관리 action: AX_ADMIN 만.
- 경로: `/admin/*` AX_ADMIN 만, `/today` DEVELOPER·AX_ADMIN, `/defects` TESTER·AX_ADMIN·HX_REVIEWER·PM(조회), `/collect` AX_ADMIN·PM·DEVELOPER, `/check` AX_ADMIN·PM, 그 외 로그인 사용자 전원. `/api/*` 는 미들웨어에서 로그인만 확인(행위 인가는 각 라우트).

- [ ] **Step 1: failing test** — 역할×행위 매트릭스 표를 `it.each` 로. 필수 케이스: PM 남의 과제 edit false, PM 본인 SUBMITTED edit false, PM 본인 SUPPLEMENT edit true, HX project.edit false, HX project.review true, VIEWER export false, DEVELOPER 남의 기능 effort false, DEVELOPER 본인 기능이지만 과제 REVIEW 상태 effort false, `canAccessPath("PM","/admin/users")` false, `canAccessPath("HX_REVIEWER","/admin")` false, `homePathFor("DEVELOPER")==="/today"`.
- [ ] **Step 2-4** → **Step 5:** Commit `feat: 역할·행위 권한 매트릭스`

### Task 6: 설정 로더 · Store 인터페이스 · JSON 저장소 · 시드

**Files:**
- Create: `src/lib/config.ts`, `src/lib/store/types.ts`, `src/lib/store/json.ts`, `src/lib/store/index.ts`, `src/lib/store/seed.ts`, `src/lib/criteria/samples.ts`, `src/lib/auth/password.ts`
- Test: `tests/store-json.test.ts`, `tests/password.test.ts`

**Interfaces:**
```ts
// config.ts
export interface AppConfig { db: { user: string; password: string; connectString: string } | null; authSecret: string | null;
  llm: { enabled: boolean; baseUrl: string; apiKey: string; model: string; temperature: number; timeoutMs: number } }
export function loadConfig(): AppConfig;          // process.cwd()/config.yml, 없으면 기본값. 캐시.
export function resetConfigCache(): void;          // 테스트용

// store/types.ts
export type MeasKind = "FEATURE" | "EFFORT" | "DEFECT" | "AIUSE" | "COMMIT";
export interface MeasRow { datId: string; kind: MeasKind; prjId: string; wbsId: string | null; workDt: string | null;
  userId: string | null; srcCd: string; data: unknown; regUserId: string; regAt: string; updAt: string }
export interface HistoryFilter { targetTyp?: string; targetId?: string; userId?: string; from?: string; to?: string; limit?: number }
export interface Store {
  kind: "oracle" | "json";
  users: { list(): Promise<UserRecord[]>; get(id: string): Promise<UserRecord | null>; insert(u: UserRecord): Promise<void>; update(id: string, patch: Partial<UserRecord>): Promise<void> };
  projects: { list(): Promise<Project[]>; get(id: string): Promise<Project | null>; insert(p: Project): Promise<void>;
    update(p: Project, expectedUpdAt: string): Promise<boolean>; nextId(): Promise<string> };
  config: { get<T>(key: string): Promise<{ value: T; verNo: number; updAt: string } | null>; set(key: string, value: unknown, verNo: number, userId: string): Promise<void>; keys(prefix: string): Promise<string[]> };
  history: { add(e: Omit<HistoryEntry, "histId">): Promise<void>; list(f: HistoryFilter): Promise<HistoryEntry[]> };
  meas: { list(prjId: string, kind?: MeasKind): Promise<MeasRow[]>; listAll(kind?: MeasKind): Promise<MeasRow[]>; upsert(rows: MeasRow[]): Promise<void>; remove(datId: string): Promise<void> };
}
// store/json.ts
export function createJsonStore(dir: string): Store;   // 파일: users.json projects.json config.json history.json meas.json
// store/index.ts
export async function getStore(): Promise<Store>;      // 싱글턴. db 있으면 oracle(Task 7), 없으면 json(data/). 최초 1회 ensureSeed.
// store/seed.ts
export async function ensureSeed(store: Store, opts: { samples: boolean }): Promise<void>;
// password.ts
export function hashPassword(plain: string): { hash: string; salt: string };
export function verifyPassword(plain: string, hash: string, salt: string): boolean;
export function validatePasswordPolicy(plain: string): string | null; // 8자 이상
```
- JSON store: 파일별 Promise 체인 뮤텍스로 쓰기 직렬화, 임시 파일 쓰고 rename(원자적). `projects.update` 는 저장본 `updAt !== expectedUpdAt` 이면 false. `nextId` = `PRJ-` + (최대 번호+1, 4자리 zero-pad).
- seed: users 비면 `admin/admin123!/AX_ADMIN/SKAX` 생성. config `CRITERIA` 없으면 defaultCriteria, `CODES` 없으면 defaultCodes. `samples: true`(JSON 모드만)면 projects 비었을 때 `samples.ts` 의 12개 과제(다양한 상태·적합도·언어·도메인, 그중 1건 `PRJ-0001` SELECTED — 측정 seed 는 Task 22) + 데모 계정 `hx01`(HX_REVIEWER), `pm01`·`pm02`(PM), `dev01`·`dev02`(DEVELOPER), `qa01`(TESTER), `view01`(VIEWER) — 비밀번호 모두 `demo1234!`.

- [ ] **Step 1: failing tests**
```ts
// tests/store-json.test.ts (발췌 — 모든 케이스 작성)
import { mkdtempSync } from "fs"; import { tmpdir } from "os"; import path from "path";
import { createJsonStore } from "@/lib/store/json"; import { ensureSeed } from "@/lib/store/seed";
const fresh = () => createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-")));
it("seed: admin 계정과 기준·코드 생성, 두 번 실행해도 중복 없음", async () => {
  const s = fresh(); await ensureSeed(s, { samples: false }); await ensureSeed(s, { samples: false });
  expect((await s.users.list()).map((u) => u.userId)).toEqual(["admin"]);
  expect((await s.config.get("CRITERIA"))?.value).toBeTruthy();
});
it("projects.update: updAt 불일치면 false 이고 저장 안 됨", async () => { /* insert → update(expected=다른값) false → get 원본 유지 */ });
it("nextId 순번", async () => { /* 빈 상태 PRJ-0001, insert 후 PRJ-0002 */ });
it("동시 insert 10건 유실 없음", async () => { /* Promise.all 10 insert → list 10 */ });
it("meas.upsert 같은 datId 두 번 → 1행, 값은 나중 것", async () => {});
it("history.list 최신순·limit", async () => {});
it("samples: 12개 과제, PRJ-0001 SELECTED", async () => {});
// tests/password.test.ts
it("hash/verify 왕복, 틀린 비밀번호 false, 정책 8자", () => {});
```
- [ ] **Step 2-4** → **Step 5:** Commit `feat: 설정 로더와 JSON 저장소, 초기 시드`

### Task 7: Oracle 저장소 · 자동 DDL

**Files:** Create `src/lib/store/oracle.ts`, `src/lib/store/schema.ts`, `sql/create_tables.sql`; Modify `src/lib/store/index.ts`; Test `tests/schema.test.ts`

**Interfaces:**
```ts
// schema.ts
export const TABLES: { name: string; ddl: string[] }[];   // CREATE TABLE + INDEX + COMMENT 문장 배열
export function renderSqlFile(): string;                  // sql/create_tables.sql 내용 생성 (스크립트와 동일 소스)
// oracle.ts
export async function createOracleStore(cfg: { user: string; password: string; connectString: string }): Promise<Store>;
```
- 드라이버는 `await import("oracledb")`. 실패 시 throw → `getStore()` 가 잡아 `StoreUnavailableError` 로 감싸고 API 는 503 `{error:{code:"DB_UNAVAILABLE"}}`.
- 풀: `createPool({ ...cfg, poolMin: 1, poolMax: 8 })`, `fetchAsString = [oracledb.CLOB]`, `autoCommit: true`.
- `ensureSchema`: `SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE 'POC\_%' ESCAPE '\'` → 없는 테이블만 DDL 실행.
- 컬럼은 스펙 8절(선정) + `STATUS_NOTE VARCHAR2(1000)` + 측정 3.1절. JSON 컬럼은 CLOB + `CHECK (... IS JSON)` 없이(구버전 호환).
- `projects.update`: `UPDATE ... WHERE PRJ_ID=:id AND UPD_DT_STR=:expected` 대신 `UPD_DT` 를 ISO 문자열 `VARCHAR2(30)` 로 저장해 정확 비교(TIMESTAMP 정밀도 문제 회피). 모든 *_DT/AT 컬럼 동일하게 ISO 문자열.
- `meas.upsert`: `MERGE INTO POC_MEAS_DAT t USING (SELECT :datId DAT_ID ... FROM DUAL) s ON (t.DAT_ID=s.DAT_ID) WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ...` 를 `executeMany`.
- `nextId`: `SELECT MAX(TO_NUMBER(SUBSTR(PRJ_ID,5))) FROM POC_PRJ_MAS`; insert 가 ORA-00001 이면 최대 3회 재시도(서비스에서).
- `history.HIST_ID`: `NUMBER GENERATED BY DEFAULT AS IDENTITY`.

- [ ] **Step 1: failing test** `tests/schema.test.ts`: TABLES 5개 이름 정확, 모든 DDL 에 `${`·따옴표 보간 없음, `renderSqlFile()` 이 각 `CREATE TABLE POC_` 포함, 커밋된 `sql/create_tables.sql` 내용과 `renderSqlFile()` 이 같음(파일 갱신 누락 방지).
- [ ] **Step 2-4** (sql 파일은 `node -e` 로 renderSqlFile 출력 저장하는 `scripts/gen-sql.mjs` 대신, 테스트가 실패 메시지로 diff 를 보여주면 수동 갱신) → typecheck PASS
- [ ] **Step 5:** Commit `feat: Oracle 저장소와 테이블 자동 생성`

### Task 8: 인증 — 세션 · 가드 · 로그인 API · 미들웨어

**Files:** Create `src/lib/auth/session.ts`, `src/lib/auth/guard.ts`, `src/lib/auth/loginLimiter.ts`, `src/lib/api.ts`, `src/app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`, `password/route.ts`, `src/middleware.ts`; Test `tests/session.test.ts`, `tests/login-limiter.test.ts`

**Interfaces:**
```ts
// session.ts (Web Crypto 만 — Edge 공용)
export const AUTH_COOKIE = "poc_session"; export const SESSION_TTL_SEC = 8 * 3600;
export interface SessionPayload { sub: string; name: string; role: Role; org: OrgCd; exp: number }
export async function signSession(p: Omit<SessionPayload, "exp">, secret: string, now?: number): Promise<string>;
export async function verifySession(token: string | undefined, secret: string, now?: number): Promise<SessionPayload | null>;
export function getSecret(): string; // process.env.AUTH_SECRET ?? "poc-portal-dev-secret". next.config.mjs 가 시작 시 config.yml 의 auth.secret 으로 AUTH_SECRET 을 채운다(환경변수가 우선). 클라이언트 번들에 들어가지 않도록 client 컴포넌트는 session.ts 를 import 하지 않는다.
// api.ts
export function ok<T>(data: T, init?: number): NextResponse;
export function fail(status: number, code: string, message: string): NextResponse;
export async function readJson<T>(req: Request): Promise<T | null>;
// guard.ts
export async function requireUser(): Promise<{ ok: true; actor: Actor & { userNm: string; orgCd: OrgCd } } | { ok: false; res: NextResponse }>;
// loginLimiter.ts
export function checkLock(userId: string, now?: number): { locked: boolean; retryAfterSec: number };
export function recordFailure(userId: string, now?: number): void; export function recordSuccess(userId: string): void;
```
- 로그인: `USE_YN=false` 거부, 실패 5회/10분 잠금, 성공 시 lastLoginAt 갱신·이력 없음.
- 미들웨어: `/login`, `/api/auth/login`, `/_next`, 정적 파일 통과. 비로그인 페이지 → `/login?next=`, API → 401. `canAccessPath` false → 페이지 `/403`, API 403.
- `next.config.mjs` 수정: 시작 시 `config.yml` 의 `auth.secret` 이 있고 `process.env.AUTH_SECRET` 이 없으면 주입(`env` 키 사용하지 않고 `process.env` 직접 설정 — 서버 런타임에만 존재).

- [ ] **Step 1: failing tests**: sign→verify 왕복, 서명 변조 null, 만료 null(now 주입), 다른 secret null, role 값이 잘못된 payload null. limiter: 5회 실패 후 locked, 10분 후 해제, 성공 시 카운터 초기화.
- [ ] **Step 2-4** → **Step 5:** Commit `feat: 세션 인증과 경로 인가 미들웨어`

### Task 9: 이력 · 클라이언트 API 래퍼

**Files:** Create `src/lib/history.ts`, `src/lib/apiClient.ts`, `src/lib/diff.ts`; Test `tests/diff.test.ts`

```ts
// diff.ts — 변경 전/후 비교용
export function shallowDiff(before: Record<string, unknown>, after: Record<string, unknown>): { key: string; before: unknown; after: unknown }[];
// history.ts
export async function record(store: Store, actor: { userId: string; userNm: string }, e: Pick<HistoryEntry, "targetTyp" | "targetId" | "actionCd" | "summary"> & { diff?: unknown }): Promise<void>;
// apiClient.ts (클라이언트)
export class ApiError extends Error { status: number; code: string }
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T>; // {data} 언랩, 401 → 세션만료 이벤트
export function onSessionExpired(cb: () => void): () => void;
export async function download(url: string, fallbackName: string): Promise<void>; // blob → a[download]
```
- [ ] **Step 1-4:** diff 테스트(중첩 객체는 JSON 문자열 비교로 1단계만, 동일 키 제외) → 구현
- [ ] **Step 5:** Commit `feat: 이력 기록과 클라이언트 API 래퍼`

---

## Phase B — UI 기반

### Task 10: 디자인 시스템 · 앱 셸 · 로그인

**Files:**
- Create: `src/styles/tokens.css`, `src/app/globals.css`, `src/app/layout.tsx`(수정), `src/components/ui/*.tsx` + `*.module.css`: `Button`, `Badge`, `FitBadge`, `ProfileStrip`, `AgreementSeal`, `StatusChip`, `DataTable`, `Modal`, `Tabs`, `Toast`(+`ToastProvider`), `Stepper`, `EmptyState`, `Skeleton`, `Field`(Input/Select/Textarea/RadioCard), `KpiTile`, `SectionHeader`, `Popover`
- Create: `src/components/shell/AppShell.tsx`, `Sidebar.tsx`, `ContextBar.tsx`, `nav.ts`, `src/components/auth/AuthProvider.tsx`, `SessionExpiredModal.tsx`
- Create: `src/app/login/page.tsx` + css, `src/app/(main)/layout.tsx`, `src/app/403/page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/api/meta/route.ts`
- Create: `src/lib/labels.ts` (상태·역할·합의·적합도 라벨/색 단일 소스)

요구사항:
- 폰트: `globals.css` 에서 `@import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";` (node_modules 경유 → Next 가 번들). 확인 실패 시 `pretendard/dist/web/static/pretendard.css`.
- 토큰(CSS 변수): 색(위 Global Constraints) + `--surface #FFFFFF`, `--muted #5B6475`, `--subtle #8A8F98`, `--line #E4E1D8`, `--accent-soft #E8EAF6`, 각 적합도 soft 배경(10% 틴트), 간격 4px 스케일, 반경 6/10, 그림자 `0 1px 2px rgba(20,33,61,.06)` 하나.
- 타이포 클래스: `.eyebrow`(11px, 600, letter-spacing .12em, uppercase, muted), `.h1`(28/700), `.h2`(16/700), 본문 14px, `tabular-nums` 유틸.
- `FitBadge({ fit, confirmed, size })`: 확정=채움, 제안=점선 테두리+글자, NA=회색 "미평가". 항상 글자 표시.
- `ProfileStrip({ profile, size })`: 영역 4묶음(묶음 간 6px 간격), Major 칸 10×18 / Minor 칸 7×12(sm 은 축소), 색=수준, 미응답=빈 테두리. hover 시 Popover 로 `지표명 · 선택값(수준)`. `aria-label` 로 텍스트 요약 제공.
- `AgreementSeal({ ax, hx })`: 두 원형 인장 + 라벨 AX/HX, 상태별 스타일(동의 채움 인디고/그린? → 동의=그린 채움, 이견=브릭 테두리, 보류=앰버 채움 50%, 미응답=회색 점선). title 속성에 문장.
- `DataTable`: 정렬 가능 헤더, sticky header, 행 hover, 선택 체크박스(옵션), 빈 상태 슬롯, 페이지네이션(10/20/50).
- AppShell: 좌측 Sidebar 240px(접힘 64px, localStorage 기억 try/catch), 그룹 "선정"(대시보드, 과제 포트폴리오, 선정 보드, 보고서) / "생산성 측정"(측정 대시보드, 오늘 공수 입력, 결함 관리, 데이터 수집, 데이터 점검) / "관리"(평가 기준, 코드·목표, 측정 설정, 계정, 변경 이력, AI 판정*). 메뉴는 `canAccessPath` 로 필터, AI 는 `/api/meta` 의 `aiEnabled` 로.
- ContextBar: 페이지 제목 영역 + 우측 `평가 기준 v{n} · {게시일}` 칩, JSON 모드면 `로컬 데모 데이터` 칩(앰버), 사용자 이름·소속 배지·역할, 메뉴(내 정보, 로그아웃).
- `/api/meta`: `{ storeKind, aiEnabled, criteriaVersion, criteriaPublishedAt }`.
- 로그인 페이지: 좌 55% 인디고-잉크 그라디언트 패널(제목 "AI Tool PoC 과제 선정", 부제 "SK hynix × SK AX Replay 생산성 검증", 4단계 진행 타임라인), 우측 폼(ID/비밀번호, 오류 메시지, 잠금 안내). JSON 모드면 폼 아래 데모 계정 표.
- 인쇄: `@media print` 기본 규칙(사이드바·컨텍스트바·`.no-print` 숨김).
- 반응형: 1024px 미만 사이드바 자동 접힘, 640px 미만 오버레이 메뉴.

- [ ] **Step 1:** 구현
- [ ] **Step 2:** `npm run typecheck` + `npm run build` PASS
- [ ] **Step 3:** `npm run dev` → `/login` 로그인(admin/admin123!) → 빈 대시보드 셸 확인(브라우저)
- [ ] **Step 4:** Commit `feat: 디자인 시스템과 앱 셸, 로그인`

---

## Phase C — 선정 기능

### Task 11: 과제 서비스 · API

**Files:** Create `src/lib/projects/service.ts`, `src/lib/projects/validate.ts`, `src/lib/projects/view.ts`, `src/lib/criteria/service.ts`; API: `src/app/api/projects/route.ts`(GET 목록, POST 생성), `[id]/route.ts`(GET, PUT), `[id]/submit/route.ts`, `[id]/status/route.ts`, `[id]/confirm/route.ts`, `[id]/reviews/route.ts`, `bulk/route.ts`, `src/app/api/users/options/route.ts`(PM·개발자 선택 목록), `src/app/api/criteria/route.ts`(GET 현재 게시본), `src/app/api/codes/route.ts`(GET); Test `tests/project-service.test.ts`, `tests/validate.test.ts`

**Interfaces:**
```ts
export type ServiceResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string; message: string };
export interface ProjectInput { prjNm: string; sysNm: string; pmUserId?: string; base: ProjectBase; answers: Record<string, string>; notes: Record<string, string> }
export function validateForSubmit(input: ProjectInput, c: Criteria): { field: string; message: string }[]; // 필수: prjNm, sysNm, domainCd, sysTypeCd, langCds≥1, description, 모든 Major 응답
export function validateDraft(input: ProjectInput): { field: string; message: string }[];                  // prjNm 만 필수 + 길이 제한
export function toView(p: Project, actor: Actor): Project;   // AX_ADMIN 아니면 ai=null, aiFit=null
export async function createProject(store: Store, actor: ActorFull, input: ProjectInput): Promise<ServiceResult<Project>>;
export async function updateProject(store: Store, actor: ActorFull, id: string, input: ProjectInput, expectedUpdAt: string): Promise<ServiceResult<Project>>;
export async function submitProject(store, actor, id, expectedUpdAt): Promise<ServiceResult<Project>>;
export async function changeStatus(store, actor, id, to: ProjectStatus, note: string | null, expectedUpdAt): Promise<ServiceResult<Project>>; // SUPPLEMENT/EXCLUDED 는 note 필수
export async function confirmFit(store, actor, id, fit: Level, reason: string, expectedUpdAt): Promise<ServiceResult<Project>>;        // 제안과 다르면 reason 필수
export async function addReview(store, actor, id, input: { agree: AgreeCd; text: string; context: "SELECTION" | "MEASURE" }): Promise<ServiceResult<Project>>; // axAgree/hxAgree 갱신, updAt 검사 안 함(스레드 append)
export async function reevaluateAll(store, actor): Promise<ServiceResult<{ changed: number }>>;
// criteria/service.ts
export async function getPublishedCriteria(store: Store): Promise<Criteria>;
export async function getCodes(store: Store): Promise<Codes>;
```
- 모든 변경은 `deriveColumns` 로 파생 컬럼 갱신 + `record()` 이력(diff 포함).
- `ActorFull = Actor & { userNm: string; orgCd: OrgCd }`.
- PM 이 생성하면 pmUserId = 본인 강제. AX 가 생성 시 pmUserId 필수(존재하는 PM 역할 사용자).
- 상태 전이 표: DRAFT→SUBMITTED(submit), SUBMITTED→REVIEW, REVIEW→SUPPLEMENT|SELECTED|RESERVE|EXCLUDED, SUPPLEMENT→SUBMITTED(submit), SELECTED|RESERVE|EXCLUDED→REVIEW(되돌리기). 그 외 409 `INVALID_TRANSITION`.
- GET 목록 쿼리: `status, fit, devType, lang, domain, pm, q` 필터 → 서버에서 필터링(소량).

- [ ] **Step 1: failing tests** (JSON store + seed, samples false):
  - PM 생성 → pmUserId 본인, status DRAFT, suggestFit 계산됨
  - PM 이 남의 과제 update → 403 / 본인 SUBMITTED update → 403
  - updAt 불일치 → 409 `CONFLICT`
  - submit: Major 미응답이면 422 + 필드 목록
  - changeStatus SUPPLEMENT note 없음 → 422, DRAFT→SELECTED → 409
  - confirmFit 제안과 다름 + reason 빈값 → 422; 성공 시 finalFit 반영
  - addReview HX → hxAgree 갱신, side "HX"
  - toView: HX 에게 ai 필드 null
  - reevaluateAll: 기준 v2 에서 지표 삭제 → answers 정리, confirm 유지, critVer=2
  - 모든 변경이 history 1건 이상 남김
- [ ] **Step 2-4** → **Step 5:** Commit `feat: 과제 서비스와 API`

### Task 12: 과제 포트폴리오 목록 `/projects`

**Files:** `src/app/(main)/projects/page.tsx`, `src/features/projects/ProjectList.tsx`, `ProjectFilters.tsx`, `BulkBar.tsx`, `useProjects.ts`, css
- 필터 바(상태·적합도·개발 성격·언어·도메인·PM·키워드), URL 쿼리 동기화(`useSearchParams` + `router.replace`).
- 열: 과제코드 / 과제명(+시스템명 2줄) / PM / 개발 성격 / 언어 / 지표 프로필 / 적합도(FitBadge 확정·제안) / 응답 `15/17` / 상태 / 합의 씰 / 수정일(상대시간 + title 절대시간).
- 상단 요약: 필터 결과 n건, 적합도 분포 미니 칩.
- 우상단 [엑셀 내려받기](Task 18 이후 활성) [과제 등록](권한).
- AX: 체크 선택 → 하단 고정 BulkBar(상태 변경 / 제안대로 적합도 확정).
- 빈 상태·로딩 스켈레톤.
- [ ] 구현 → typecheck → 브라우저 확인 → Commit `feat: 과제 포트폴리오 목록`

### Task 13: 과제 상세 `/projects/[id]`

**Files:** `src/app/(main)/projects/[id]/page.tsx`, `src/features/project-detail/{Header,OverviewTab,EvaluationTab,RationaleTab,ReviewTab,HistoryTab,StatusDialog,ConfirmFitDialog}.tsx`, css; API `src/app/api/projects/[id]/history/route.ts`
- 헤더: eyebrow 과제코드·시스템명, 제목, 상태칩, 대형 FitBadge, ProfileStrip(md), 합의 씰, 액션(권한별: 편집, 제출, 상태 변경, 적합도 확정, 의견 작성).
- 탭: 개요 / 지표 평가 / 판정 근거 / 검토·합의 / (측정 — Task 24 슬롯, SELECTED 만) / (AI 의견 — Task 30 슬롯) / 이력. 탭은 `?tab=` 쿼리.
- 판정 근거: 영역별 표(지표, Major/Minor, 선택값, 수준 칩) + 규칙 문장 박스 + Minor 보완 신호 + 확정 기록.
- 검토·합의: 측별 2열(SK AX / SK hynix) 스레드, 각 열 상단 현재 동의 상태, 작성 폼(동의/이견/보류 세그먼트 + 의견).
- 기준 버전 불일치 시 "평가 기준 v{old} 기준 — 최신 v{new}" 배너.
- [ ] 구현 → 확인 → Commit `feat: 과제 상세 화면`

### Task 14: 과제 등록·편집 스텝퍼

**Files:** `src/app/(main)/projects/new/page.tsx`, `[id]/edit/page.tsx`, `src/features/project-form/{ProjectForm,StepBasic,StepBaseline,StepEvaluation,PreviewBar}.tsx`, css
- 3단계 Stepper(완료 체크), 단계 이동 시 자동 임시저장(PUT/POST, 409 시 토스트 + 새로고침 버튼).
- 기본 정보: 스펙 6.5. 언어는 칩 다중 선택(첫 번째 = 주 언어 표시).
- 실적: 날짜 2개, M/M 숫자(소수 1), 단계별 M/M 4칸 + 합계 자동 표시(입력한 총 M/M 과 다르면 안내), 규모 3칸, Replay 대상 단계 체크.
- 평가: 영역 카드마다 질문(영역 question) eyebrow, 지표별 RadioCard 그룹(선택지 라벨 + 힌트 + 수준 점 색), Major 배지, 메모 토글.
- 하단 고정 PreviewBar: ProfileStrip + 제안 FitBadge(`evaluateFit` 클라이언트 실행) + `응답 12/17` + [임시저장] [제출]. 제출 실패 시 첫 오류 필드로 스크롤 + 강조.
- [ ] 구현 → 확인(PM 계정으로 등록→제출) → Commit `feat: 과제 등록·편집 스텝퍼`

### Task 15: 선정 보드 `/selection`

**Files:** `src/app/(main)/selection/page.tsx`, `src/features/selection/{Board,BoardCard,BalancePanel,TransitionDialog}.tsx`, css; API `src/app/api/balance/route.ts` (GET → `analyzeBalance` 결과)
- 6열 칸반, 열 머리 건수. 카드: 과제명, FitBadge sm, ProfileStrip sm, 개발 성격·언어 칩, 합의 씰, 보완요청 배지.
- AX_ADMIN: HTML5 drag&drop. 허용 안 되는 전이는 드롭 영역 비활성 표시. 사유 필요 전이·SELECTED 경고(미확정/HX 미동의)는 TransitionDialog.
- 우측 BalancePanel(320px, sticky): 선정 n/목표, 적합도 3칸 게이지(건수/목표), 개발 성격·언어·도메인·시스템 유형 건수 리스트, 경고 목록. "예비 포함" 토글.
- [ ] 구현 → 확인 → Commit `feat: 선정 보드와 균형 패널`

### Task 16: 대시보드 `/`

**Files:** `src/app/(main)/page.tsx`, `src/features/dashboard/{KpiRow,BalanceMatrix,BalanceWarnings,DistributionChart,MyTasks,ActivityFeed}.tsx`, css; API `src/app/api/dashboard/route.ts`
- `/api/dashboard`: `{ kpi: { candidates, submitted, confirmed: Record<Fit,number>, selected, target, hxAgreed }, balance: BalanceReport, distribution: { lang: {code,label,all,selected}[]; sysType: [...] }, myTasks: {prjId, prjNm, reason}[], activity: HistoryEntry[] }`.
- BalanceMatrix: 행 = 적합도 상/중/하, 열 = 축 선택(개발 성격 기본 / 도메인 / 언어 / 시스템 유형 세그먼트). 칸 안 과제 칩(선정=채움, 후보=외곽선, 클릭 → 상세). 선정 0건 칸 = 사선 패턴 배경 + "공백".
- DistributionChart: recharts 가로 막대, 후보(라이트) vs 선정(인디고).
- [ ] 구현 → 확인 → Commit `feat: 선정 대시보드`

### Task 17: 관리 — 평가 기준 · 코드·목표

**Files:** `src/app/(main)/admin/criteria/page.tsx`, `src/features/admin/criteria/{CriteriaEditor,IndicatorEditor,RuleEditor,ImpactPreview,VersionList}.tsx`; `src/app/(main)/admin/codes/page.tsx`, `src/features/admin/codes/CodesEditor.tsx`; `src/lib/criteria/validate.ts`; API `src/app/api/admin/criteria/route.ts`(GET draft+published, PUT draft), `publish/route.ts`, `preview/route.ts`, `versions/route.ts`, `src/app/api/admin/codes/route.ts`(PUT), `src/app/api/admin/reevaluate/route.ts`; Test `tests/criteria-validate.test.ts`

```ts
export function validateCriteria(c: Criteria): string[]; // 영역≥1, 지표 이름 필수, 선택지≥2, id 유일, Major≥1, 규칙 정수 0 이상
export function impactOf(projects: Project[], from: Criteria, to: Criteria): { from: Record<Fit, number>; to: Record<Fit, number>; changed: { prjId: string; prjNm: string; before: Fit; after: Fit }[] };
```
- 편집기: 영역 아코디언 → 지표 행(이름, 설명, Major/Minor 토글, 선택지 목록[라벨·수준 세그먼트·힌트], 위/아래 이동, 삭제). 새 지표/선택지 id 는 `ind-` + 랜덤 6자.
- RuleEditor 문장형: "Major 지표 중 **하**가 [2]개 이상이면 **하**", "Major 지표 중 **하**가 [0]개 이하이고 **상**이 [과반 ▾ | n개] 이상이면 **상**", "그 외 **중**".
- 초안 저장 → 영향 미리보기(ImpactPreview: 분포 전/후, 바뀌는 과제 목록) → 게시(확인 모달) → 게시 후 "재판정 실행" 버튼.
- 버전 목록: `CRITERIA@n` 키 목록, 클릭 시 읽기 전용 보기.
- 코드·목표: 언어/도메인/시스템 유형 코드 테이블 편집(코드 불변, 라벨 수정, 추가, 사용 중이면 삭제 경고) + 균형 목표 입력.
- [ ] tests(validateCriteria, impactOf) → 구현 → 확인 → Commit `feat: 평가 기준·코드 관리`

### Task 18: 관리 — 계정 · 이력 · 내 정보 + 엑셀 · 보고서

**Files:**
- `src/app/(main)/admin/users/page.tsx`, `src/features/admin/users/{UserTable,UserDialog,ResetPasswordDialog}.tsx`, API `src/app/api/admin/users/route.ts`, `[id]/route.ts`, `[id]/reset-password/route.ts`
- `src/app/(main)/admin/history/page.tsx`, `src/features/admin/history/HistoryView.tsx`, API `src/app/api/admin/history/route.ts`
- `src/app/(main)/me/page.tsx` (비밀번호 변경 → `/api/auth/password`)
- `src/lib/export/projectsXlsx.ts`, API `src/app/api/export/projects/route.ts`; Test `tests/projects-xlsx.test.ts`
- `src/app/(main)/report/page.tsx`, `src/features/report/*`, `src/styles/print.css`

```ts
export async function buildProjectsWorkbook(projects: Project[], c: Criteria, codes: Codes): Promise<Buffer>;
// 시트: "과제 목록"(기본정보·실적·제안/확정 적합도·상태·합의), "지표 응답"(행=과제, 열=지표, 셀=선택 라벨, 배경=수준색), "평가 기준"(영역·지표·Tier·선택지·수준·판정 규칙 문장)
```
- 계정: 자기 자신 비활성화·역할 강등 금지(마지막 AX_ADMIN 보호). 초기화 비밀번호는 1회 표시.
- 이력: 필터 + 행 펼치면 diff 표(전/후).
- 엑셀 응답: `Content-Disposition: attachment; filename*=UTF-8''PoC_과제목록_YYYYMMDD.xlsx`.
- 보고서: A4 가로 페이지 구분(`break-after: page`), 표지 → 선정 요약 → 균형 매트릭스(정적 렌더) → 선정·예비 과제 표 → 평가 기준 부록. 상단 [인쇄] 버튼(`window.print()`, no-print).
- [ ] xlsx 테스트(시트 3개, 행 수 = 과제 수+헤더, 파일 시그니처 `PK`) → 구현 → 확인 → Commit `feat: 계정·이력 관리, 엑셀 내려받기, 보고서`

---

## Phase D — Replay 측정

### Task 19: 측정 도메인 · 지표 계산

**Files:** Create `src/lib/measure/types.ts`, `keys.ts`, `size.ts`, `postfix.ts`, `metrics.ts`, `defaults.ts`; Test `tests/measure/metrics.test.ts`, `size.test.ts`, `postfix.test.ts`, `tests/measure/fixtures.ts`

**Interfaces:**
```ts
// types.ts
export type Phase = "DESIGN" | "DEV" | "UNIT" | "INTEG";
export const PHASES: Phase[]; export const PHASE_LABEL: Record<Phase, string>; // 상세설계·개발·단위테스트·통합테스트
export type FeatureStatus = "WAIT" | "DOING" | "DONE";
export interface Feature { prjId: string; wbsId: string; name: string; typeCd: string; devUserId: string | null; devUserNm: string | null;
  status: FeatureStatus; completedAt: string | null; baseline: Record<Phase, number> & { defects: number; evidence: string; evidenceVerified: boolean }; note: string }
export interface Effort { prjId: string; wbsId: string; workDt: string; phase: Phase; hours: number; userId: string; aiLevel: "NONE" | "PARTIAL" | "LEAD" | null; memo: string; srcCd: "MANUAL" | "GRID" }
export interface Defect { prjId: string; wbsId: string; defectId: string; foundDt: string; phase: Phase; cause: string; severity: "CRITICAL" | "NORMAL"; title: string; testCaseRef: string; srcCd: "MANUAL" | "JIRA" }
export interface AiUse { prjId: string; wbsId: string | null; workDt: string; userId: string; model: string; requests: number;
  inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reportedCost: number | null; srcCd: "OTEL" | "LOCAL_LOG" | "MANUAL" }
export interface Commit { prjId: string; hash: string; workDt: string; author: string; message: string; wbsId: string | null; added: number; deleted: number }
export interface TokenPrice { model: string; input: number; output: number; cacheRead: number; cacheWrite: number } // 원 / 1M tokens
export interface MeasureSettings { laborRatePerHour: number; tokenPrices: TokenPrice[]; postFixDays: number; phases: Record<Phase, boolean>;
  crossCheckToleranceDays: number; idleAlertDays: number; mdHours: number; sizeBands: { S: number; M: number; L: number };
  featureTypes: { code: string; label: string }[]; wbsPattern: string; jiraMappings: Record<string, JiraMapping> }
export interface JiraMapping { idCol: string; createdCol: string; summaryCol: string; wbsCol: string | null; priorityMap: Record<string, "CRITICAL" | "NORMAL">; phaseCol: string | null; causeCol: string | null }
export type Size = "S" | "M" | "L";
export interface MetricSet { featureCount: number; doneCount: number; reference: boolean; sumA: number; sumB: number;
  hoursPerFeature: number | null; savingRate: number | null; phaseSaving: Record<Phase, number | null>;
  aiCost: number; aiRequests: number; costPerFeature: number | null; costDiffPerFeature: number | null;
  defectRateA: number | null; defectRateB: number | null; postFixRate: number | null; postFixLines: number; totalLines: number }
export interface FeatureMetric { feature: Feature; a: number; b: number; aByPhase: Record<Phase, number>; bByPhase: Record<Phase, number>;
  savingRate: number | null; size: Size; sizeOutOfRange: boolean; aiCost: number; aiRequests: number; defectsB: number; postFixLines: number; totalLines: number }
export interface MetricsResult { overall: MetricSet; byProject: Record<string, MetricSet>; byType: Record<string, MetricSet>;
  byTypeSize: Record<string, MetricSet>; /* key `${typeCd}|${size}` */ byFeature: FeatureMetric[];
  requestsByDay: { date: string; requests: number; cost: number }[]; unpricedModels: string[] }
export interface MeasureInput { features: Feature[]; efforts: Effort[]; defects: Defect[]; usages: AiUse[]; commits: Commit[]; settings: MeasureSettings }
// size.ts
export function classifySize(aHours: number, bands: MeasureSettings["sizeBands"]): { size: Size; outOfRange: boolean }; // <S→S, <M→M, else L; outOfRange: a<8 || a>bands.L
// postfix.ts
export function addDays(isoDate: string, n: number): string;
export function isPostFix(commitDt: string, completedAt: string | null, days: number): boolean; // completedAt < commitDt <= completedAt+days
// metrics.ts
export function aiCostOf(u: AiUse, prices: TokenPrice[]): number | null; // 단가 없으면 null
export function computeMetrics(input: MeasureInput): MetricsResult;
// defaults.ts
export function defaultMeasureSettings(): MeasureSettings; // 스펙 3.2 기본값, laborRatePerHour 0, tokenPrices []
// keys.ts
export const datId: { feature(prjId: string, wbsId: string): string; effort(prjId: string, wbsId: string, date: string, phase: Phase, userId: string): string;
  defect(prjId: string, defectId: string): string; aiuse(prjId: string, date: string, userId: string, wbsId: string | null, model: string, src: string): string; commit(prjId: string, hash: string): string };
```
계산 규칙(스펙 4절) — 집계 대상: 생산성·경제성·결함률은 **완료 기능**; postFix 는 완료 기능의 WBS-ID 커밋; reference = 해당 칸 기능 수(featureCount) < 2. 분모 0 → null. AI 비용은 완료 기능 WBS-ID 의 사용량만 6번 식에 넣고, overall.aiCost 는 과제 전체 사용량(WBS 미상 포함) 합.

- [ ] **Step 1: fixtures + failing tests**
```ts
// tests/measure/fixtures.ts — 스펙 9절 seed 와 동일 데이터를 export (Task 22 seed 가 이 파일을 import 해서 같은 값을 쓴다 → src/lib/measure/sampleData.ts 로 두고 테스트가 import)
// tests/measure/metrics.test.ts
import { computeMetrics } from "@/lib/measure/metrics";
import { sampleMeasureInput } from "@/lib/measure/sampleData";

const r = computeMetrics(sampleMeasureInput());
const by = (w: string) => r.byFeature.find((f) => f.feature.wbsId === w)!;

it("seed 기대 절감률 60% / 39% / 17%", () => {
  expect(Math.round(by("WBS-3.2.1").savingRate! * 100)).toBe(60);
  expect(Math.round(by("WBS-3.4.2").savingRate! * 100)).toBe(39);
  expect(Math.round(by("WBS-4.1.3").savingRate! * 100)).toBe(17);
});
it("전체 절감률은 공수 가중 (120-70)/120, 단순 평균 아님", () => {
  expect(r.overall.savingRate).toBeCloseTo(50 / 120, 6);
  expect(r.overall.savingRate).not.toBeCloseTo((0.6 + 22 / 56 + 4 / 24) / 3, 3);
});
it("기능당 투입시간 70/3", () => expect(r.overall.hoursPerFeature).toBeCloseTo(70 / 3, 6));
it("WBS-3.2.1 10-22 커밋은 사후 수정", () => expect(by("WBS-3.2.1").postFixLines).toBeGreaterThan(0));
it("규모: 40h→L, 56h→L, 24h→M", () => {
  expect(by("WBS-3.2.1").size).toBe("L"); expect(by("WBS-3.4.2").size).toBe("L"); expect(by("WBS-4.1.3").size).toBe("M");
});
it("기능 1개 칸은 참고값", () => expect(r.byTypeSize["SCREEN|L"].reference).toBe(true));
it("완료 기능이 없으면 null (NaN 아님)", () => {
  const input = sampleMeasureInput(); input.features.forEach((f) => { f.status = "DOING"; f.completedAt = null; });
  const m = computeMetrics(input).overall;
  expect(m.savingRate).toBeNull(); expect(m.hoursPerFeature).toBeNull(); expect(m.costPerFeature).toBeNull();
});
it("통합테스트 단계 토글 시 A·B 모두 해당 단계 포함", () => { /* settings.phases.INTEG=true + INTEG baseline/effort 추가 → sumA, sumB 둘 다 증가 */ });
it("AI 비용: 토큰 4종 × 단가 / 1M, 단가 없는 모델은 unpricedModels", () => {});
it("기능당 총비용·비용 차이", () => { /* rate 50,000 → (70*50000 + aiCost)/3, 차이 = 120*50000/3 - 그 값 */ });
it("결함률 A=Σbaseline.defects/3, B=결함수/3", () => {});
it("사후 수정률 = 사후 라인 / 전체 라인, 라인 0 이면 null", () => {});
it("미완료 기능의 공수는 생산성 지표에서 제외", () => {});
```
`size.test.ts`: 15.9→S, 16→M, 39.9→M, 40→L, 7→S outOfRange, 81→L outOfRange. `postfix.test.ts`: 완료일 당일 false, +1 true, +14 true, +15 false, completedAt null false, 월 경계 addDays.
- [ ] **Step 2-4:** FAIL → `sampleData.ts`(스펙 9절: A 단계 분해 3.2.1=8/24/8, 3.4.2=12/32/12, 4.1.3=4/14/6; 유형 코드 `SCREEN`/`IF_BATCH`/`MES_LOGIC`/`LEGACY`; 커밋·사용량·결함 소량, 연도 2026) + 구현 → PASS
- [ ] **Step 5:** Commit `feat: Replay 측정 지표 계산 모듈`

### Task 20: 데이터 점검 · 파서

**Files:** Create `src/lib/measure/crosscheck.ts`, `src/lib/measure/csv.ts`, `src/lib/measure/parsers/{aiusageCsv,otel,commitsCsv,jiraCsv}.ts`; Test `tests/measure/{crosscheck,csv,parsers}.test.ts` + `tests/fixtures/{otel.json,otel.csv,usage.csv,commits.csv,jira.csv}`

```ts
// csv.ts — RFC4180(따옴표·줄바꿈·BOM) 파서/작성기
export function parseCsv(text: string): string[][]; export function toCsv(rows: (string | number | null)[][]): string;
export interface ParseResult<T> { rows: T[]; warnings: { line: number; message: string }[] }
export function extractWbs(text: string | null | undefined, pattern: string): string | null;
// parsers
export function parseAiUsageCsv(text: string, ctx: { prjId: string; wbsPattern: string }): ParseResult<AiUse>;   // 스크립트 출력 형식
export function parseOtel(text: string, ctx: { prjId: string; wbsPattern: string; fileName: string }): ParseResult<AiUse>; // .json(OTLP metrics + logs) / .csv(timestamp,metric,type,model,value,user,project,wbs|branch)
export function parseCommitsCsv(text: string, ctx: { prjId: string; wbsPattern: string }): ParseResult<Commit>;
export function parseJiraCsv(text: string, ctx: { prjId: string; wbsPattern: string; mapping: JiraMapping }): ParseResult<Defect>;
export function jiraHeaders(text: string): string[];
// crosscheck.ts
export interface CrossIssue { wbsId: string; featureName: string; kind: "COMMIT_OUTSIDE" | "AI_OUTSIDE" | "NO_TRACE"; detail: string; dates: string[] }
export interface IdleIssue { wbsId: string; featureName: string; devUserNm: string | null; lastWorkDt: string | null; idleDays: number }
export interface CheckReport { cross: CrossIssue[]; idle: IdleIssue[]; commitViolation: { total: number; violations: number; rate: number | null }; unknownWbsUsage: number; unpricedModels: string[] }
export function runChecks(input: MeasureInput, today: string): CheckReport;
```
- OTel: `claude_code.token.usage` 데이터포인트 attr `type`(input/output/cacheRead/cacheCreation), `model`, `user.email`|`user.account_uuid`, 일자 = timeUnixNano 의 로컬 날짜; `claude_code.api_request` 로그 레코드 수 = requests; `claude_code.cost.usage` → reportedCost. 같은 (일자·사용자·WBS·모델) 로 합산.
- 커밋: `@hash|date|author|subject` 블록 형식 원문도 허용(스크립트 미사용 사용자 대비) — 첫 줄이 `@` 로 시작하면 git log 원문 파싱, 아니면 CSV.
- 실패 행은 건너뛰고 warnings.
- [ ] tests: CSV 따옴표/BOM/CRLF, extractWbs(`poc/WBS-3.2.1`, `[WBS-3.2.1] x`, 없음), usage csv 정상·숫자 오류 행 경고, OTel json/csv 샘플 합산, commits csv·git 원문·바이너리 `-`, jira 매핑·priority 매핑·WBS 를 summary 에서 추출, crosscheck(허용 오차 경계 1일 포함/2일 위반, idle 3일, NO_TRACE, 위반율) → 구현 → PASS
- [ ] Commit `feat: 측정 데이터 파서와 점검 규칙`

### Task 21: 로컬 수집 스크립트 (Python)

**Files:** Create `scripts/collect_ai_usage.py`, `scripts/extract_commits.py`, `scripts/tests/test_collect.py`, `scripts/tests/test_extract.py`, `scripts/tests/fixtures/{claude/*.jsonl, codex/*.jsonl, gitlog.txt}`, `scripts/README.md`

- 표준 라이브러리만(Python 3.8+). 출력 CSV UTF-8(BOM 없음), 헤더 스펙 6.1 순서.
- collect: `--claude-dir`(기본 `~/.claude/projects`), `--codex-dir`(기본 `~/.codex/sessions`), `--since`, `--user`(기본 `getpass.getuser()`), `--wbs-pattern`(기본 `WBS-[0-9]+(?:\.[0-9]+)*`), `--out`(기본 `ai_usage_<user>_<today>.csv`). Claude: assistant 행, `message.id` 중복 제거, 일자는 timestamp 로컬 날짜. Codex: 파일별 `token_count` 누적 → 직전 대비 차이(음수면 리셋으로 보고 현재값), 모델은 `turn_context`/`session_meta` 에서, 브랜치 `session_meta.payload.git.branch`. 파서 함수 분리(`parse_claude_line`, `parse_codex_file`), 예외 행 `stderr` 경고.
- extract: `--repo`(기본 `.`), `--since`, `--branch`, `--out`. `subprocess.run(["git","-C",repo,"log","--date=short","--numstat","--pretty=@%h|%ad|%an|%s", ...])`, `|` 가 subject 에 있어도 앞 3개만 분리.
- README: 사용법(Windows `py`, macOS `python3`), 주 1회 제출 안내.
- [ ] `python -m unittest discover scripts/tests` 테스트 먼저(클로드 중복 id, codex 누적 차이·리셋·깨진 행, git 원문 파싱·바이너리) → 구현 → PASS
- [ ] Commit `feat: AI 사용량·커밋 로컬 수집 스크립트`

### Task 22: 측정 저장 · 서비스 · API · seed

**Files:** Create `src/lib/measure/repo.ts`, `src/lib/measure/service.ts`; Modify `src/lib/store/seed.ts`(측정 seed), API:
`src/app/api/measure/[prjId]/route.ts`(GET 원천+지표), `features/route.ts`(POST upsert), `features/[wbsId]/route.ts`(PUT, DELETE), `efforts/route.ts`(POST 배치 upsert), `grid/route.ts`(PUT 그리드 셀), `defects/route.ts`(POST, DELETE), `usage/route.ts`(POST 수기), `upload/route.ts`(POST multipart: kind=usage|otel|commits|jira, dryRun), `comments` 는 기존 reviews API(context MEASURE) 재사용;
`src/app/api/measure/today/route.ts`(GET 내 기능, POST 저장), `src/app/api/measure/summary/route.ts`(GET 전체 지표 + 과제별 + 산점도 데이터), `src/app/api/measure/check/route.ts`, `src/app/api/admin/measure-settings/route.ts`(GET, PUT), `src/app/api/scripts/[name]/route.ts`;
Test `tests/measure/service.test.ts`

```ts
// repo.ts
export async function loadInput(store: Store, prjIds: string[] | "ALL"): Promise<MeasureInput>;
export function toRow(kind: MeasKind, obj: Feature | Effort | Defect | AiUse | Commit, actorId: string, now: string): MeasRow;
export async function getSettings(store: Store): Promise<MeasureSettings>;
// service.ts
export async function upsertFeature(store, actor, prjId, f: Omit<Feature, "prjId">, unit: "h" | "MD"): Promise<ServiceResult<Feature>>;
export async function saveTodayEfforts(store, actor, date: string, items: { prjId: string; wbsId: string; phase: Phase; hours: number; aiLevel: Effort["aiLevel"] }[], completes: { prjId: string; wbsId: string }[]): Promise<ServiceResult<{ saved: number }>>;
export async function setGridCell(store, actor, prjId, wbsId, phase: Phase, targetHours: number): Promise<ServiceResult<{ adjustment: number }>>; // 차이만큼 GRID 행(오늘) 갱신
export async function applyUpload(store, actor, prjId, kind: "usage" | "otel" | "commits" | "jira", fileName: string, text: string, dryRun: boolean): Promise<ServiceResult<{ inserted: number; updated: number; warnings: { line: number; message: string }[] }>>;
export async function addDefect(...); export async function addManualUsage(...);
```
- 모든 변경 권한은 `can()` (measure.*). 대상 과제 SELECTED 아님 → 409 `NOT_MEASURING`.
- 업로드 이력: `record(targetTyp "UPLOAD", summary "커밋 CSV 42건 (신규 40, 갱신 2, 경고 1)")`.
- seed(JSON 모드): `PRJ-0001` 에 `sampleData.ts` 의 기능·공수·커밋·사용량·결함 적재, 기능 담당 dev01, 측정 설정 단가 예시(인건비 60,000원/h, 모델 단가 예시 2종 — 화면에 "예시값" 표시).
- [ ] tests: hours 0 저장 시 해당 행 삭제(빈 기록 방지), MD 환산(2MD→16h), 개발자 남의 기능 403, 같은 날 같은 단계 두 번 저장 → 1행, 그리드 보정(합계 16 → 20 지정 시 GRID +4, 다시 18 지정 → GRID +2 로 갱신), 업로드 dryRun 은 저장 안 함, 같은 커밋 CSV 재업로드 inserted 0 updated n, SELECTED 아닌 과제 409
- [ ] Commit `feat: 측정 데이터 서비스와 API`

### Task 23: 오늘 공수 입력 `/today`

**Files:** `src/app/(main)/today/page.tsx`, `src/features/measure/today/{TodayForm,FeatureEffortCard}.tsx`, css
- 상단: 날짜 선택(◀ 오늘 ▶), "내 담당 기능 n건".
- 카드: WBS-ID eyebrow, 기능명, 과제명, 상태칩, 누적 B / A (예: `12h / 40h`), 측정 단계별 숫자 입력(스테퍼 −/+ 0.5, `inputmode="decimal"`), 기존 기록 값 프리필, AI 활용 3버튼, [완료 처리] 체크(완료일 = 선택 날짜).
- 하단 고정 [저장] (변경 건수 표시), 저장 후 토스트 "3개 기능 · 16h 저장".
- 모바일 360px: 카드 1열, 입력 칸 2열 그리드.
- 빈 상태: "배정된 기능이 없습니다 — 과제 PM 에게 문의".
- [ ] 구현 → dev01 로그인 확인(첫 화면 /today) → Commit `feat: 개발자 오늘 공수 입력`

### Task 24: 과제 상세 > 측정 탭 (공수 기록표 그리드 외)

**Files:** `src/features/measure/tab/{MeasureTab,EffortGrid,BaselinePopover,DefectList,UsagePanel,CommitSummary,MeasureComments}.tsx`, css; Modify `src/features/project-detail/*` 탭 슬롯
- EffortGrid: 스펙 5.2. 열 머리 위 색 띠(PL=인디고 소프트, 개발자=그린 소프트, 자동=회색) + 범례. 셀 편집: 클릭/Enter 진입, Tab/Shift+Tab 이동, Enter 저장, Esc 취소, 저장 중 스피너, 실패 시 셀 붉은 테두리 + 토스트. 권한 없는 열은 읽기 전용(커서 기본). 행 추가(PL): 하단 "+ 기능 추가" 행. 합계 행: A·단계별 B·B·절감률(지표 모듈 overall). 절감률 셀: 막대 미니 게이지 + %.
- BaselinePopover: 단계별 A(h/MD 토글), 당시 결함 수, 근거 메모/링크, 근거 확인 체크.
- DefectList: 표 + 수기 등록 버튼(권한).
- UsagePanel: 일자별 요청·비용 recharts 막대, 기능별 표(요청·토큰·비용·출처).
- CommitSummary: WBS별 커밋 수·변경 라인·사후 수정 라인(강조), 규칙 위반 수.
- MeasureComments: reviews(context MEASURE) 스레드, HX·AX 작성.
- [ ] 구현 → 확인(pm01 로 A 입력, dev01 로 그리드 셀) → Commit `feat: 과제 측정 탭과 공수 기록표 그리드`

### Task 25: 결함 관리 · 데이터 수집 · 데이터 점검 화면

**Files:** `src/app/(main)/defects/page.tsx`, `src/features/measure/defects/{DefectsView,DefectDialog,JiraImport}.tsx`; `src/app/(main)/collect/page.tsx`, `src/features/measure/collect/{CollectView,UploadPanel,ManualUsageForm,ScriptGuide,UploadHistory}.tsx`; `src/app/(main)/check/page.tsx`, `src/features/measure/check/CheckView.tsx`; css
- 공통 과제 선택기(SELECTED 과제 드롭다운, URL `?prj=`).
- JiraImport: 파일 → 헤더 읽기 → 매핑 폼(저장된 매핑 프리필) → dryRun 미리보기(신규/갱신/경고) → 반영 → 매핑 저장.
- UploadPanel(종류별 탭): 드롭존, dryRun 결과 카드, 경고 행 표(최대 50행 + "외 n건"), [반영].
- 사용량 탭 상단 고정 안내: "로컬 로그는 기본 30일 후 삭제되므로 주 1회 이상 제출".
- ScriptGuide: 스크립트 2개 다운로드 버튼 + OS별 명령 예시(복사 버튼) + 커밋 메시지 규칙 박스.
- UploadHistory: history(targetTyp UPLOAD) 표.
- CheckView: 3섹션(교차 검증 / 미입력 / 커밋 규칙 위반율·WBS 미상·단가 미설정), 각 건수 배지, 행 클릭 → 해당 과제 측정 탭.
- [ ] 구현 → 확인(fixtures CSV 업로드) → Commit `feat: 결함 관리·데이터 수집·데이터 점검 화면`

### Task 26: 측정 대시보드 · 측정 설정 · 측정 내보내기

**Files:** `src/app/(main)/measure/page.tsx`, `src/features/measure/dashboard/{Caveats,MetricKpis,FeatureCompareChart,PhaseSavingChart,TypeSizeMatrix,ProjectCompareTable,FitScatter}.tsx`; `src/app/(main)/admin/measure/page.tsx`, `src/features/admin/measure/MeasureSettingsForm.tsx`; `src/lib/export/measureXlsx.ts`, `src/app/api/export/measure/route.ts`, `src/app/api/export/measure-csv/route.ts`; Test `tests/measure-xlsx.test.ts`; `src/lib/format.ts`(+ test `tests/format.test.ts`)

```ts
// format.ts — 화면 전용 반올림 (계산은 원값)
export function pct(v: number | null): string;   // null → "—", 0.6 → "60%"
export function hours(v: number | null): string; // 1자리
export function won(v: number | null): string;   // 천 단위 콤마 + "원"
export async function buildMeasureWorkbook(input: MeasureInput, result: MetricsResult, projects: Project[]): Promise<Buffer>; // 스펙 7.5 시트 8개
```
- Caveats: 항상 표시(접기 없음), 앰버 좌측 바, 3항목 + "근거 확인 x/y" 동적.
- KPI 9개: 그룹 3개(생산성·경제성·품질), 각 타일 = 값 + 설명 한 줄 + 참고값/계산불가 표기. A/B 쌍 지표(결함률)는 두 값 병기.
- 차트: 기능별 A vs B 막대(단계 누적 B), 단계별 절감률 막대, 유형×규모 매트릭스(칸: 절감률·n, 참고값 음영 + "참고"), 과제별 표, FitScatter(x=확정 적합도 상/중/하 밴드 + 지터, y=절감률, r=완료 기능 수, 툴팁 과제명).
- 설정 폼: 스펙 7.4 전 항목, 모델 단가 표 편집(행 추가/삭제), 유형 코드 편집, 저장 시 이력.
- [ ] format·xlsx 테스트 → 구현 → 확인 → Commit `feat: 측정 대시보드·설정·내보내기`

---

## Phase E — AI 판정 (보조)

### Task 27: AI 판정

**Files:** Create `src/lib/ai/prompt.ts`, `src/lib/ai/parse.ts`, `src/lib/ai/assess.ts`, `src/app/api/ai/assess/route.ts`, `src/app/api/ai/prompt/route.ts`, `src/app/api/ai/ping/route.ts`, `src/app/(main)/admin/ai/page.tsx`, `src/features/ai/{AiAdmin,PromptEditor,AssessRunner,AiResultTab}.tsx`; Modify `package.json`(+`@langchain/openai@^1.6.2`, `@langchain/core@^1.2.17`), 상세 탭 슬롯(`next/dynamic` 로 `AiResultTab`); Test `tests/ai.test.ts`

```ts
export const PROMPT_TEMPLATE: string; // "## 판정 기준 (상/중/하가 무엇인가)\n\n## Major 지표 해석\n\n## 선정 원칙\n\n## 주의사항\n" + 각 섹션 예시 문장 주석
export function buildAssessPrompt(args: { consultantPrompt: string; criteria: Criteria; project: Project; balance: BalanceReport; codes: Codes }): { system: string; user: string };
export function parseAssessResponse(text: string): { ok: true; value: Omit<AiResult, "model" | "promptVersion" | "criteriaVersion" | "assessedAt" | "assessedBy"> } | { ok: false; error: string }; // ```json 펜스 제거, grade "상|중|하|H|M|L" 정규화, 필수 필드 검사
export async function assessOne(cfg: AppConfig["llm"], prompt: { system: string; user: string }): Promise<string>; // ChatOpenAI({ model, apiKey, temperature, timeout, configuration: { baseURL } }).invoke
```
- `llm.enabled` false → 모든 AI API 404, 메뉴·탭 숨김.
- 실행: 클라이언트가 과제 id 를 하나씩 `POST /api/ai/assess {prjId}` 순차 호출(진행률), 결과 저장 + 이력.
- 상세 AI 탭: 등급, 요약, 강점/리스크, 지표별 코멘트(지표명 매핑), Replay 유의사항, 균형 의견, 메타(모델·프롬프트 v·시각), [확정 적합도로 반영] → ConfirmFitDialog 프리필(사유 = "AI 의견: " + summary).
- 화면 고지: "사내 LLM 으로 과제 정보가 전송됩니다".
- [ ] tests: prompt 에 컨설턴트 텍스트·모든 지표명·출력 형식 포함, 빈 컨설턴트 프롬프트면 throw, parse(펜스·한글 등급·필드 누락 오류·깨진 JSON) → 구현 → enabled=false 로 메뉴 숨김 확인 → Commit `feat: AI 적합도 의견 (보조 기능)`

---

## Phase F — 마무리

### Task 28: 문서 · 최종 검증

**Files:** `README.md`, `CLAUDE.md`(인덱스: 명령, 구조, 불변 규칙 8줄 이내)
- README: 외부망 실행(`npm install && npm run dev`, 데모 계정 표), 사내 실행(`cp config.example.yml config.yml` → db 입력 → `npm run dev`, 테이블 자동 생성, DBA 수동 DDL 경로), 운영 실행(`npm run build && npm start`, `AUTH_SECRET`), 스크립트 사용법 링크, 화면 경로 목록.
- [ ] `npm test` 전부 PASS, `python -m unittest discover scripts/tests` PASS, `npm run typecheck` PASS, `npm run build` PASS
- [ ] `rm -rf data && npm run dev` → 역할별 브라우저 점검: admin(기준 편집·게시·재판정, 선정 보드 드래그, 엑셀, 보고서 인쇄 미리보기) / pm01(등록→제출, 측정 A 입력) / hx01(의견·동의, 편집 불가 확인) / dev01(/today 저장 1분 내) / qa01(결함·Jira import) / view01(관리 메뉴 없음, 엑셀 불가)
- [ ] 360px 폭에서 /today, 1280px·1920px 에서 대시보드 확인
- [ ] Commit `docs: 실행 안내와 프로젝트 인덱스`
