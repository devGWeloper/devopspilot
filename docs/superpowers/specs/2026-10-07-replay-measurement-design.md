# Replay 생산성 측정 모듈 — 설계 문서

- 작성일: 2026-10-07
- 원천 요구사항: `replay.md` (단, 이 세션에서 사용자가 직접 정한 사항이 우선)
- 선행 문서: [2026-10-07-poc-selection-design.md](2026-10-07-poc-selection-design.md) — 기술 스택·권한·저장소·디자인 방향을 그대로 따른다
- 상태: 사용자 검토 대기

## 1. 목적과 범위

선정(`SELECTED`)된 과제가 그대로 **생산성 측정** 단계로 넘어가 측정 데이터 입력·수집·지표 산출까지 이 포털에서 끝낸다. 엑셀로 따로 관리하던 측정 데이터를 전부 옮기는 것이 목적이다.

### 세션 결정 사항과의 정합
| replay.md | 세션 결정 | 적용 |
|---|---|---|
| 엔티티 6종(기능·실적·공수·결함·사용량·커밋) | "스키마는 진짜 간단하게, 테이블 여러 개로 조인 걸지 말 것" | **측정 데이터 테이블 1개**(`POC_MEAS_DAT`, 종류 구분 컬럼 + JSON). 조인 없음, 집계는 앱에서 |
| 9개 정량 지표 | 선정 화면은 점수 없음 | 선정 화면은 정성 그대로. 측정 지표는 실측값이므로 **측정 화면에서만** 숫자 사용 |
| CSV 업로드(AI 사용량·커밋·Jira) | 엑셀 일괄 업로드 제외 | 과제 일괄 등록 업로드는 계속 제외. 측정 원천 데이터 CSV 업로드는 포함 |
| 설정 화면 | AX 관리자 설정 | 기존 `POC_CFG_MAS` 에 `MEASURE` 키로 저장 |

### 측정 방식 (배경)
- 완료된 과제의 일부 기능(WBS-ID 단위)을 AI Tool(Claude Code / Codex)로 다시 개발해 **기존 실적(A)** 과 **Replay 테스트(B)** 를 비교.
- 입력 고정: 당시 확정된 요구정의서·설계서·테스트케이스. 수행자: 원 수행자가 아닌 개발자.
- 측정 구간: 상세설계·개발·단위테스트 (+통합테스트는 설정으로 선택). 요구분석·고객협의 제외.
- 산출물 동일 → 공수·비용·품질만 비교.

### 용어 (화면 전체 통일)
- **기존 실적 (A)**, **Replay 테스트 (B)**, **사후 수정**, **공수 기록표**
- "재수행", "재작업" 은 UI 문구·코드 식별자·문서 어디에도 쓰지 않는다. (선정 워크플로의 `REWORK` 상태 표시명은 "보완요청" 유지, 코드값은 `REWORK` → `SUPPLEMENT` 로 변경)

## 2. 역할 확장

| 역할 | 추가 | 측정 모듈 권한 |
|---|---|---|
| `AX_ADMIN` | — | 전체 + 측정 설정 + 모든 업로드 |
| `PM` | — | 본인 과제: 기능 등록, 기존 실적(A) 입력, 담당 개발자 지정, 커밋 CSV 업로드 |
| `DEVELOPER` | **신규** | 본인 담당 기능: 공수 기록(B), 완료 처리, AI 사용량 CSV 업로드(본인 분) |
| `TESTER` | **신규** | 측정 중 과제: 결함 등록·수정, Jira CSV import |
| `HX_REVIEWER` | — | 조회 + 코멘트만 |
| `VIEWER` | — | 조회 |

- 로그인 후 첫 화면: DEVELOPER → `/today`, TESTER → `/defects`, 그 외 → 대시보드.
- 측정 메뉴는 `SELECTED` 과제가 1건 이상일 때 의미가 있으나 항상 노출(빈 상태 안내).
- `permissions.ts` 에 역할×행위 매트릭스로 추가(단위 테스트 확장).

## 3. 데이터 모델

### 3.1 `POC_MEAS_DAT` 측정 데이터 (신규, 단일 테이블)
| 컬럼 | 설명 |
|---|---|
| `DAT_ID` PK VARCHAR2(200) | 자연키. 같은 키 재업로드 = 덮어쓰기(idempotent) |
| `KIND_CD` | `FEATURE` / `EFFORT` / `DEFECT` / `AIUSE` / `COMMIT` |
| `PRJ_ID` | 과제 |
| `WBS_ID` | 기능 WBS-ID (과제 내 유일) |
| `WORK_DT` VARCHAR2(10) | 기준일 `YYYY-MM-DD` (공수 작업일·결함 발견일·사용 일자·커밋일; 기능은 완료일) |
| `USER_ID` | 작성자/개발자/커밋 작성자 |
| `SRC_CD` | 출처 `MANUAL` / `OTEL` / `LOCAL_LOG` / `JIRA` / `GIT` / `GRID` |
| `DATA_JSON` CLOB | 종류별 상세 |
| `REG_USER_ID`, `REG_DT`, `UPD_DT` | 감사 |

인덱스: `(PRJ_ID, KIND_CD)`. 조회는 항상 `WHERE PRJ_ID = :p [AND KIND_CD = :k]` 단독.

**`DAT_ID` 규칙 및 `DATA_JSON`**
| 종류 | DAT_ID | DATA_JSON |
|---|---|---|
| FEATURE | `FEAT:{prjId}:{wbsId}` | `{ name, typeCd, devUserId, devUserNm, status: WAIT/DOING/DONE, completedAt, baseline: { design, dev, unit, integ (h), defects, evidence, evidenceVerified }, note }` |
| EFFORT | `EFF:{prjId}:{wbsId}:{date}:{phase}:{userId}` (1인·1일·1단계 1행). 그리드 보정은 userId 자리에 `GRID` | `{ phase: DESIGN/DEV/UNIT/INTEG, hours, aiLevel: NONE/PARTIAL/LEAD/null, memo }` |
| DEFECT | `DEF:{prjId}:{defectId}` | `{ defectId, phase, cause, severity: CRITICAL/NORMAL, side: A/B, title, testCaseRef }` |
| AIUSE | `USE:{prjId}:{date}:{userId}:{wbsId}:{model}:{src}` | `{ model, requests, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reportedCost }` |
| COMMIT | `CMT:{prjId}:{hash}` | `{ hash, author, message, added, deleted, wbsParsed: bool }` |

- 결함의 `side`: B(Replay 테스트 중 발견)만 이 테이블에 쌓는다. A 결함 수는 기능의 `baseline.defects` 로 받는다(당시 테스트케이스 기준 집계값).
- 사후 수정 여부는 저장하지 않는다 — 완료일과 설정값으로 매번 계산.
- 공수를 MD 로 입력하면 `× 설정.mdHours(기본 8)` 로 환산해 h 로 저장.
- 업로드 이력은 기존 `POC_HIST_HIS`(`TARGET_TYP='UPLOAD'`, 건수·경고 요약)를 쓴다.

### 3.2 설정 (`POC_CFG_MAS`, `CFG_KEY='MEASURE'`)
```
{ laborRatePerHour,                 // 인건비 시간당 단가(원), 전 과제 단일 값
  tokenPrices: [ { model, input, output, cacheRead, cacheWrite } ],  // 원 / 100만 토큰
  postFixDays: 14,                  // 사후 수정 판정 기간(일)
  phases: { design: true, dev: true, unit: true, integ: false },
  crossCheckToleranceDays: 1,
  idleAlertDays: 3,                 // 미입력 경고 기준
  mdHours: 8,
  sizeBands: { S: 16, M: 40, L: 80 },// 상한(h): S < 16 ≤ M < 40 ≤ L
  featureTypes: [ 화면, IF·배치, MES 도메인 로직, 레거시 수정 ],     // 코드 관리
  wbsPattern: "WBS-[0-9]+(\\.[0-9]+)*" }
```
- 모델 단가가 없는 모델의 사용량은 비용 0 + "단가 미설정" 경고(데이터 점검 화면).

## 4. 지표 (계산식 고정, `src/lib/measure/metrics.ts` 한 곳)

모든 화면·엑셀은 이 모듈 결과만 쓴다. 입력: 기능·공수·결함·사용량·커밋 행 배열 + 설정. 순수 함수.

공통 정의
- **측정 단계** = 설정 `phases` 에서 켜진 단계. A·B 모두 같은 단계 집합으로 합산.
- **완료 기능** = `status = DONE` 이고 완료일이 있는 기능. 생산성·경제성 지표는 **완료 기능만** 대상으로 A 와 B 를 함께 집계(비교 대상 일치).
- A(기능) = Σ 측정 단계 baseline h, B(기능) = Σ 측정 단계 EFFORT h.

| # | 지표 | 계산 |
|---|---|---|
| 1 | 기능당 투입시간 | Σ B ÷ 완료 기능 수 |
| 2 | 공수 절감률 | (Σ A − Σ B) ÷ Σ A — **공수 가중**. 기능별 절감률 평균 금지 |
| 3 | 단계별 절감률 | 단계마다 2번 식 (상세설계 / 개발 / 단위테스트 [/ 통합]) |
| 4 | AI 비용 | Σ (토큰 4종 각각 × 모델별 단가 ÷ 1,000,000). 보고된 비용(OTel cost)은 참고 표시만 |
| 5 | AI 요청 수 | Σ requests — 기능별·일자별 |
| 6 | 기능당 총비용 | (Σ B × 인건비 단가 + 완료 기능의 AI 비용) ÷ 완료 기능 수 |
| 7 | 기능당 비용 차이 | (Σ A × 인건비 단가 ÷ 완료 기능 수) − 6번 |
| 8 | 결함률 | A: Σ baseline.defects ÷ 기능 수 / B: B 결함 건수 ÷ 기능 수 (완료 기능 기준) |
| 9 | 사후 수정률 | Σ 사후 수정 커밋 변경 라인 ÷ Σ 해당 WBS-ID 전체 변경 라인. 사후 수정 커밋 = 완료일 < 커밋일 ≤ 완료일 + N일. 변경 라인 = added + deleted |

집계 규칙
- 단위: 전체 / 과제별 / 유형별 / 유형 × 규모.
- 규모 = 기능 A 합계: `< 16h → S`, `16 ≤ A < 40 → M`, `≥ 40 → L` (8h 미만·80h 초과는 S·L 로 넣고 "범위 밖" 표시).
- 집계 칸의 기능 수 < 2 → 값 옆에 **참고값** 표시.
- 분모 0 → `—`(계산 불가) 표시, 0% 로 보이지 않게.
- 표시 반올림은 화면에서만(정수 %, 시간 소수 1자리). 계산은 원값 유지.

**검증 기대값 (seed = 단위 테스트)**: WBS-3.2.1 A 40 / B 16 → 60%, WBS-3.4.2 A 56 / B 34 → 39%, WBS-4.1.3 A 24 / B 20 → 17%. WBS-3.2.1 의 10-22 커밋은 사후 수정(완료일 10-10 + 14일 이내).

## 5. 입력

### 5.1 오늘 공수 입력 `/today` (DEVELOPER 홈, 모바일 폭 대응)
- 내 담당 기능(진행·대기) 카드 목록이 바로 보임. 날짜 선택(기본 오늘).
- 카드마다 측정 단계별 숫자 입력 칸(0.5h 단위 스테퍼 + 직접 입력), AI 활용 정도 3버튼(선택), [완료 처리] 체크.
- 하단 단일 [저장] — 입력 칸이 채워진 기능만 저장. 같은 날·같은 기능·같은 단계 기록은 덮어쓴다(3.1 의 EFFORT 키).
- 목표: 기능 3개 입력 1분 이내. 키보드 Tab 순서·숫자 키패드(`inputmode="decimal"`).

### 5.2 공수 기록표 그리드 (과제 상세 > 측정 탭)
- 열: WBS-ID | 기능명 | 유형 | 기존 실적 A | 설계 h | 개발 h | 테스트 h | (통합 h) | 완료일 | Replay B | 절감률
- 열 머리 색 띠로 입력 주체 구분: **PL 사전 기입**(WBS·기능명·유형·A) / **개발자 기입**(단계 h·완료일) / **자동 계산**(B·절감률). 범례 상단 고정.
- 인라인 편집(셀 클릭/Enter, Tab 이동, Esc 취소), 행 추가 = 기능 등록(PL).
- 단계 h 셀은 EFFORT 합계를 보여준다. 그리드에서 값을 바꾸면 차이만큼 `SRC_CD='GRID'` 보정 기록을 오늘 날짜로 남긴다(일별 기록을 지우지 않음, 같은 날 다시 고치면 그 보정 행을 갱신).
- A 셀 클릭 → 단계별 A·결함 수·근거·**근거 확인 여부** 체크 팝오버. h/MD 단위 토글.
- 하단 합계 행(지표 모듈 결과).

### 5.3 결함 관리 `/defects`
- 수기 등록 폼(과제, WBS-ID, 발견 단계, 원인, 심각도, 제목, 테스트케이스 참조).
- **Jira CSV import**: 업로드 → 열 매핑 화면(Issue key→결함 ID, Created→발견일, Priority→심각도 매핑 표, WBS-ID 는 지정 열 또는 Summary 에서 정규식 추출) → 미리보기(신규/갱신/오류 건수) → 반영. 매핑은 과제별로 기억(설정 JSON).
- 같은 결함 ID 재업로드 = 덮어쓰기.

## 6. 자동 수집

### 6.1 AI 사용량
업로드 화면에서 과제를 고르고 파일을 올린다(WBS-ID 는 과제 내 유일이므로 과제가 필수).

- **1안 OTel**: OTel 수집기 export 업로드.
  - JSON(OTLP metrics/logs JSON)과 CSV 둘 다 받는다. 사용 항목: `claude_code.token.usage`(attr `type`: input/output/cacheRead/cacheCreation, `model`), `claude_code.cost.usage`, `claude_code.api_request` 이벤트 건수, 리소스 속성 `project`, `team`, `user.email`/`user.account_uuid`.
  - WBS-ID 는 속성 중 `wbs`/`branch` 가 있으면 정규식 추출, 없으면 "WBS 미상" 으로 적재(점검 화면에 표시).
  - 수집기 export 형식은 환경마다 달라 파서를 `parsers/otel.ts` 로 분리, 실패 행은 건너뛰고 경고 목록으로 보여준다.
- **2안 로컬 로그**: `scripts/collect_ai_usage.py`
  - Python 3.8+ 표준 라이브러리만 사용(사내 PC 설치 부담 없음). Windows/macOS/Linux.
  - Claude Code: `~/.claude/projects/**/*.jsonl` 의 `type=="assistant"` 행 → `message.usage` 4종, `timestamp`, `gitBranch`, `message.model`. 행 수 = 요청 수. 같은 `message.id` 가 여러 행에 나뉘어 기록되면 1회로 센다.
  - Codex: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` 의 `token_count` 이벤트(누적값) → 직전 값과의 차이. 브랜치는 세션 메타에서 읽고 없으면 미상. 파서 분리, 실패 행 경고.
  - 옵션: `--since YYYY-MM-DD`, `--user <사번>`(기본 OS 사용자명), `--wbs-pattern`, `--out`.
  - 출력 CSV: `date,user,wbs_id,model,requests,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,source`.
  - 화면 안내: "로컬 로그는 기본 30일 후 삭제되므로 주 1회 이상 제출".
- **3안 수기**: 사용량 수기 입력 폼, 출처 `MANUAL` 로 구분 표시.
- 같은 일자·개발자·WBS-ID·모델(·출처) 조합은 덮어쓴다.

### 6.2 커밋 (Bitbucket API 불필요)
- 규칙: 메시지 `[WBS-ID] 내용`, 브랜치명에도 WBS-ID.
- `scripts/extract_commits.py` (Python 표준 라이브러리, 크로스플랫폼): 저장소 경로에서
  `git log --date=short --numstat --pretty="@%h|%ad|%an|%s"` 실행 → `hash,date,author,message,added,deleted` CSV. 옵션 `--since`, `--branch`, `--out`. 바이너리 파일(`-`) 은 0 라인.
- 웹: CSV 업로드 → 메시지에서 WBS-ID 파싱해 기능 연결. 없으면 `wbsParsed=false`("규칙 위반")로 저장·집계. 같은 해시 재업로드 = 덮어쓰기.

### 6.3 데이터 수집 화면 `/collect`
- 탭: AI 사용량 업로드 / 커밋 업로드 / 수기 입력 / 업로드 이력.
- 업로드 흐름: 파일 선택 → 파싱 미리보기(신규·갱신·경고 건수, 경고 행 목록) → 반영.
- 스크립트 다운로드(`GET /api/scripts/{name}` 가 `scripts/` 파일을 내려줌) + 사용법(복사 버튼 있는 명령 예시).

## 7. 화면

메뉴 그룹 "생산성 측정" 추가: 측정 대시보드 · 오늘 공수 입력 · 결함 관리 · 데이터 수집 · 데이터 점검. 설정은 기존 관리 그룹에 "측정 설정".

### 7.1 측정 대시보드 `/measure`
- 필터: 과제(전체/개별), 유형.
- **해석 주의사항 상자 (항상 표시, 접기 불가)**:
  1. 요구사항이 확정된 상태에서 시작하므로 절감률이 과대평가될 수 있다 — '개발 구간 상한값'으로 해석.
  2. 기존 WBS 실적에 계획값이 들어간 경우 기준값 오차가 있다 — 근거 확인 완료 기능 비율 표시(예: "근거 확인 7/10").
  3. 과제당 기능 10개 내외로 표본이 적다 — 경향 확인용.
- KPI 9개 (생산성 3 · 경제성 4 · 품질 2 그룹), 참고값·계산 불가 표기 일관.
- 기능별 A vs B 막대(단계 누적), 단계별 절감률 막대, 유형 × 규모 매트릭스(칸: 절감률·기능 수, 2개 미만 참고값 음영), 과제별 비교 표.
- **선정 적합도(상/중/하) 대비 실제 절감률 산점도** — x: 확정 적합도(지터), y: 과제 절감률, 점 크기: 완료 기능 수. 선정 지표 검증용.

### 7.2 과제 상세 > 측정 탭 (SELECTED 과제에만)
공수 기록표 그리드 · 결함 목록 · AI 사용량(일자별 요청·비용, 기능별 표) · 커밋 요약(WBS별 커밋 수·라인·사후 수정 라인, 규칙 위반 수) · HX 코멘트 스레드(측정 맥락).

### 7.3 데이터 점검 `/check`
- 교차 검증: 기능별 공수 기록 기간 [최초, 최종 작업일] 과 그 WBS-ID 의 커밋일·AI 사용일 비교 — 기간 ± 허용 오차 밖이면 목록화. 공수는 있는데 커밋·AI 기록이 없는 기능도 표시.
- 미입력: 상태 `DOING` 인데 최근 `idleAlertDays` 일 공수 기록이 없는 기능(담당자 표시).
- 커밋 규칙 위반 비율(과제별), WBS 미상 사용량, 단가 미설정 모델.

### 7.4 측정 설정 `/admin/measure` (AX_ADMIN)
단가(인건비·모델별 토큰 4종), 사후 수정 기간, 측정 단계 토글, 교차 검증 허용 오차, 미입력 기준, MD 환산, 규모 구간, 기능 유형 코드, WBS 정규식. 변경 이력 기록.

### 7.5 내보내기
`GET /api/export/measure?prjId=` → .xlsx (컨설턴트 전달용)
- 시트: 지표 요약(전체·과제·유형·유형×규모, 참고값 표시) / 공수 기록표 / 공수 기록 원천 / 결함 / AI 사용량 / 커밋(사후 수정 여부 계산 열 포함) / 설정 스냅샷 / 해석 주의사항.
- CSV 는 원천 시트 단위로 개별 다운로드.

## 8. 코드 구조 (선행 문서 구조에 추가)

```
src/lib/measure/
  metrics.ts         지표 9개·집계 (순수, 유일한 계산 위치)
  postfix.ts         사후 수정 판정 (순수)
  crosscheck.ts      데이터 점검 (순수)
  size.ts            규모 분류 (순수)
  keys.ts            DAT_ID 생성
  parsers/ otel.ts  aiusageCsv.ts  commitsCsv.ts  jiraCsv.ts
  repo.ts            Store 경유 MEAS 데이터 접근
src/features/measure/  today/  defects/  collect/  check/
src/app/(main)/measure/ today/ defects/ collect/ check/ admin/measure/
src/app/api/measure/...  api/export/measure  api/scripts/[name]
scripts/collect_ai_usage.py  scripts/extract_commits.py
```
`Store` 에 `meas: { list(prjId, kind?), upsert(rows[]), remove(id) }` 추가. Oracle 은 `MERGE INTO POC_MEAS_DAT` 배치(`executeMany`).

## 9. Seed (JSON 모드 샘플 데이터)

선정 샘플 과제 중 1건을 `SELECTED` + 측정 데이터 포함으로 둔다.
| WBS-ID | 기능 | 유형 | A | B (설계/개발/테스트) | 완료일 |
|---|---|---|---|---|---|
| WBS-3.2.1 | 설비 이력 조회 화면 | 화면 | 40h | 3 / 9 / 4 | 2026-10-10 |
| WBS-3.4.2 | Lot 이동 정보 IF | IF·배치 | 56h | 6 / 18 / 10 | 2026-10-14 |
| WBS-4.1.3 | 레거시 정산 로직 수정 | 레거시 수정 | 24h | 4 / 10 / 6 | 2026-10-15 |
- A 의 단계 분해는 합계가 맞도록 예시값 지정(예: 3.2.1 = 8/24/8).
- 커밋: 각 기능 개발 기간 커밋 몇 건 + `2026-10-22 [WBS-3.2.1] 조회 오류 수정` (사후 수정) + WBS 없는 커밋 1건(규칙 위반 예시).
- AI 사용량·결함 소량 포함 → 대시보드·점검 화면이 비지 않게.

## 10. 테스트

- `metrics`: seed 기대값 60% / 39% / 17%(반올림 표시), 공수 가중 vs 단순 평균 차이 케이스, 단계 토글(통합 포함/제외), 완료 기능만 집계, 분모 0, 참고값(기능 < 2), AI 비용 토큰 4종·단가 미설정, 기능당 비용 차이.
- `postfix`: 경계(완료일 당일 제외, +N일 포함, +N+1 제외), seed 10-22 커밋.
- `size`: 경계값 16·40, 범위 밖.
- `crosscheck`: 허용 오차 경계, 미입력 일수.
- 파서: Claude Code jsonl(중복 message.id), Codex 누적 차이·형식 불일치 행 건너뜀, 커밋 numstat(바이너리), Jira 매핑, OTel 샘플.
- Python 스크립트: 샘플 로그 fixture 로 `python -m unittest` (표준 라이브러리).
- 역할×행위 권한 확장 테스트.

## 11. 구현 순서 (전체)

1. 선정 포털 기본 기능 (선행 문서)
2. 측정 모듈 (이 문서)
3. AI 판정 (보조)

## 12. 결정 필요 항목 (구현은 기본값으로 진행, 완료 보고 때 재확인)
- OTel 수집기 위치와 export 형식(현재: OTLP JSON + 단순 CSV 둘 다 수용)
- 인건비 단가 기준(직급 평균 / 표준 단가) — 설정값으로 입력
- 모델별 사내 토큰 단가
- Codex 세션 로그에서 브랜치를 못 읽는 경우의 WBS 매핑 방식
