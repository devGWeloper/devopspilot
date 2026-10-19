# 측정 기준 데이터 적용 · Codex 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `생산성 측정 PoC 데이터.xlsx` 의 데이터 모델·지표를 포털에 적용하고, 관리 페이지(`/master`)와 Codex 수집으로 통일한다.

**Architecture:** 모델(types/units) → 매칭 → 지표(metrics) → 수집(ingest) → 계정 → 엑셀(workbook) → 서비스 → 화면 순으로 아래층부터 바꾼다. 저장소 5테이블·확정 흐름은 유지.

**Tech Stack:** Next.js 14, TypeScript strict, vitest, exceljs, Python 표준 라이브러리

**Spec:** `docs/superpowers/specs/2026-10-19-measure-base-data-design.md`

## Global Constraints
- 단위 코드 = `과제ID-요구사항ID-단계`, reqKey = `과제ID-요구사항ID`
- 지표 계산은 `measure/metrics.ts` 에만, 1 M/D 시간·단가·토큰 단가는 설정값
- AI 대화 원문 저장 금지, 후보 토큰(hints)만
- 테이블 5개, 바인드 변수만, `schema.ts` ↔ `sql/create_tables.sql` 일치
- 업무 화면 무채색, 색은 위험 신호에만 · 주석은 '왜'만 · "재작업/재수행" 금지

## Review Focus
- 과제가 다른 같은 요구사항 ID(REQ0047) — 확정·배정이 섞이지 않아야 함 → Task 1·3 테스트
- 토큰 단가 없는 모델 — 비용 빈칸·건수 표시, 순절감 계산은 계속 → Task 3
- 엑셀에 날짜 셀(측정 완료일)·숫자 셀 서식 → Task 6
- Codex 이벤트가 여러 묶음으로 나눠 들어옴 — 활동 시간이 이어져야 함 → Task 4
- 재확정 후 다음 날 확정률이 늦게 바뀌지 않아야 함(firstConfirmedAt) → Task 3

---

### Task 1: 모델 · 단위
- Files: `src/lib/types.ts`, `src/lib/measure/units.ts`, `src/lib/projects/normalize.ts`(신규), `tests/helpers.ts`, `tests/measure/units.test.ts`
- Produces: `Stage { cd, workType, ownerId, ownerNm, baseMd, difficulty, grade, baseSrc, done, doneAt, fit, spec, ctx, gen }`, `Requirement { reqId, name, stages }`, `Project` + `promisCd`, `axHq`(−`wbsYn`), `reqKey(prjId, reqId)`, `unitCode(prjId, reqId, cd)`, `Unit.reqKey`, `reqDone(req)`, `normalizeProject(raw)`
- [ ] 테스트: 다른 과제 같은 reqId → 단위 코드가 다름, 옛 형식(요구사항 단위 grade·done) → 태그로 내려 채움
- [ ] 구현 · 통과 · 커밋

### Task 2: 태그 추출 · 매칭
- Files: `src/lib/measure/match.ts`, `tests/measure/match.test.ts`
- `extractHints(text)`: 하이픈+숫자 포함 토큰, 최대 20. `matchSession`: 태그 일치 → reqKey 일치 → reqId 단독(내 담당 중 유일)
- [ ] 테스트 · 구현 · 커밋

### Task 3: 설정 · 지표
- Files: `measure/types.ts`, `measure/defaults.ts`, `measure/metrics.ts`, `tests/measure/metrics.test.ts`
- `Settings { mdHours, gradePrice, gradePriceMm, tokenPrice: Record<model,{input,cached,output}>, measureStart, workTypes }`, `AiSession.tokens`, `sessionCost(s, settings): number|null`
- `Agg` + `saveMd`, `netAmt`, `outShare`, `aiCostMissing`; `tagRate(ix, userIds)`, `nextDayConfRate(ix, userIds)`; `METRICS` 정의 목록; `DayConf.firstConfirmedAt`; confKey 는 reqKey 기준
- [ ] 테스트 · 구현 · 커밋

### Task 4: Codex 수집
- Files: `measure/ingest.ts`, `measure/service.ts`(ingestOtel·uploadLog), `src/app/api/otel/v1/metrics` 삭제, `scripts/collect_ai_usage.py`, 테스트
- [ ] Codex 로그 이벤트 → 활동 시간(5분 상한)·토큰·hints, 계정 aiAcct 매핑, lastMs 이어 계산
- [ ] 스크립트 Codex 전용 + 토큰 · 파이썬 테스트 · 커밋

### Task 5: 계정
- Files: `types.ts`(UserRecord `hqNm`, `aiAcct`), `users/service.ts`, `store/oracle.ts`, `store/schema.ts`, `sql/create_tables.sql`, `store/json.ts`
- [ ] 테스트 · 구현 · 커밋

### Task 6: 엑셀 5시트
- Files: `src/lib/projects/workbook.ts`(신규: `parseWorkbookGrids`, `buildWorkbook`), `projects/service.ts`(`importWorkbook`), `/api/master/import`, `/api/master/export`, xlsxImport.ts·템플릿 삭제
- [ ] 테스트(시트별 파싱·오류·병합) · 구현 · 커밋

### Task 7: 화면
- `/master`(과제·공수 태그·개발자·기준정보·집계 로직), `/` 조회 전용, `/admin` 탭 정리, `/dashboard` 지표 8개·근거 토큰, `/selection`·dims 태그 단위, 공수 입력 라벨, 가이드 Codex, nav
- [ ] typecheck · build · 화면 확인 · 커밋

### Task 8: 샘플 데이터 · 문서
- `store/sampleData.ts` 새 형식, CLAUDE.md·README 갱신, 전체 검증
