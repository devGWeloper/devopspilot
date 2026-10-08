# CLAUDE.md

AI 활용 생산성 향상 PoC 포털 — Next.js 14 (App Router) · React 18 · TypeScript strict. 실행·화면 목록은 README.md.

## 명령
`npm test` (vitest) · `python -m unittest discover -s scripts/tests` · `npm run typecheck` · `npm run build` (빌드 전 `.next` 삭제 권장)

## 구조
- `src/lib/` 비즈니스 규칙(순수 함수, 테스트 대상) — `fitness.ts`(적합도), `balance.ts`, `auth/permissions.ts`(권한 단일 소스), `measure/metrics.ts`(측정 지표 유일한 계산 위치)
- `src/lib/store/` `Store` 인터페이스 + `json.ts`(DB 미설정) + `oracle.ts`(자동 DDL, `schema.ts` ↔ `sql/create_tables.sql` 일치를 테스트가 검사)
- `src/app/api/` 라우트는 `route()` 래퍼(인증→저장소→처리)만 쓰고 로직은 `lib/*/service.ts`
- `src/features/<화면>/` 화면 컴포넌트, `src/components/ui/` 공용 UI

## 불변 규칙
1. 선정 화면에 숫자 점수·가중치를 두지 않는다. 적합도 = Major 지표 수준 규칙(제안) + AX 확정.
2. DB 는 조인 없음, 테이블 5개(`POC_*`). SQL 값은 바인드 변수만.
3. 클라이언트는 `/api` 를 `lib/apiClient.ts` 의 `api()`/`download()` 로만 호출.
4. 측정 지표 계산은 `measure/metrics.ts` 에만. 단가·기간은 설정값(하드코딩 금지).
5. "재수행"·"재작업" 용어 금지(보완요청 코드 `SUPPLEMENT`). 명칭은 "AI 활용 생산성 향상 PoC".
6. AI 코드는 `lib/ai`, `features/ai`, `app/api/ai`, `app/(main)/admin/ai` 에만. 상세 화면은 `next/dynamic` 슬롯으로만 연결.
7. 주석은 '왜'만.
