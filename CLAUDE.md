# CLAUDE.md

AI 활용 생산성 향상 PoC 포털 — Next.js 14 (App Router) · React 18 · TypeScript strict. 실행·화면 목록은 README.md. 설계: `docs/superpowers/specs/2026-10-15-effort-portal-revamp-design.md`.

## 명령
`npm test` (vitest) · `python -m unittest discover -s scripts/tests` · `npm run typecheck` · `npm run build` (빌드 전 `.next` 삭제 권장) · `npm run local` (build + start, 사내 시연용)

## 구조
- 화면: `/selection` 과제 선정 현황(관리자·열람자 첫 화면, `/` 는 역할별 첫 화면으로 보냄) · `/status` 과제 현황(조회) · `/effort` 공수 입력 · `/dashboard` 측정 결과(+`/basis` 산출 근거) · `/master` 기준 데이터(엑셀 5시트 편집·올리기·내려받기) · `/monitor` 공수 모니터링 · `/guide` 작성 가이드 · `/admin` 시스템 관리. 페이지는 서버 컴포넌트가 `lib/views.ts` 로 데이터를 만들어 넘기고, 변경 후 `router.refresh()`(`features/common/useMutate`).
- `src/lib/dims.ts` 과제 성격 분류 축(선정 분포·성격별 결과 공용)
- `src/lib/measure/` — `metrics.ts`(측정 지표 유일한 계산 위치·지표 정의 `metricDefs`, `traceUnits`→`aggTrace` 로 근거와 숫자가 같은 경로), `monitor.ts`(이상 감지 규칙), `match.ts`(Codex 세션 → 공수 태그 매칭), `ingest.ts`(Codex OTLP 로그 이벤트·로그 업로드 파싱), `service.ts`(공수 입력·확정·배정)
- `src/lib/projects/` — `workbook.ts`(기준정보 엑셀 '생산성 측정 PoC 데이터' 5시트 읽기·쓰기), `service.ts`(엑셀 병합·과제/요구사항/단계 편집), `normalize.ts`(이전 저장 형식 맞춤), `form.ts`(선정 현황 항목)
- `src/lib/auth/permissions.ts` 권한 단일 소스 (ADMIN · DEVELOPER · VIEWER)
- `src/lib/store/` `Store` 인터페이스 + `json.ts`(DB 미설정, 메모리 사본) + `oracle.ts`(자동 DDL, `schema.ts` ↔ `sql/create_tables.sql` 일치를 테스트가 검사)
- `src/app/api/` 라우트는 `route()` 래퍼(인증→저장소→처리)만 쓰고 로직은 `lib/*/service.ts`. `/api/otel/v1/*` 만 세션 대신 수집 토큰.

## 불변 규칙
1. 과제 선정은 포털에서 하지 않는다. 관리자가 선정된 과제를 엑셀/화면으로 넣고 나머지는 조회만.
2. 측정 단위 = 요구사항 × SDLC 단계 4개(AN 분석·DS 설계·DV 개발·TS 테스트 — 배포·운영 없음, 운영 과제 없음), 단위 코드(공수 태그) `과제ID-요구사항ID-단계`. 요구사항 ID 는 과제 안에서만 유일(내부 키 `reqKey`). 단계 하나에 담당 1명. 측정 결과는 확정된 날만 집계. 화면 용어는 '요구사항'(공수 태그는 코드 값을 가리킬 때만).
3. DB 는 조인 없음, 테이블 5개(`POC_*`). SQL 값은 바인드 변수만.
4. 클라이언트는 `/api` 를 `lib/apiClient.ts` 의 `api()`/`download()` 로만 호출.
5. 측정 지표 계산은 `measure/metrics.ts` 에만. 등급 단가·토큰 단가·M/D 시간·업무 유형은 설정값(하드코딩 금지). AI 도구는 Codex, AI 비용은 토큰 × 모델 단가(없으면 빈칸).
6. AI 대화 원문은 저장하지 않는다 — 요구사항 코드 후보(hints)만.
7. "재수행"·"재작업" 용어 금지. 명칭은 "AI 활용 생산성 향상 PoC". 업무 화면은 무채색, 색은 위험 신호에만.
8. 주석은 '왜'만.
