# PoC 과제 선정 포털 — 설계 문서

- 작성일: 2026-10-07
- 작성: SK AX (devGWeloper)
- 상태: 사용자 검토 대기

## 1. 배경과 목적

SK hynix 는 AI Tool 도입으로 DT 생산성이 향상됐다는 지표를 확보하려 한다. 방법은 **Replay 테스트** —
AI Tool 없이 이미 완료된 프로젝트를 AI Tool 로 다시 수행(분석/설계/개발/테스트)해 공수·품질을 비교한다.

과제 성격(신규/레거시, 언어, 변경 범위 등)에 따라 AI 효과 편차가 크므로, 후보 과제를 **지표로 평가해
적합도 상/중/하로 분류**하고 **유형이 고르게 분포되도록** 최종 과제를 선정해야 한다.

이 포털은 그 선정 과정을 SK AX 와 SK hynix 가 **함께 보고 합의**하는 공식 화면이다.
대상 사용자에 고객사 의사결정자가 포함되므로 화면 품질과 신뢰감이 핵심 요구사항이다.

### 성공 기준
1. 과제 PM 이 자기 과제 정보를 직접 입력·제출할 수 있다.
2. 지표(Major/Minor, 가중치, 등급 기준)가 확정되지 않았으므로 화면에서 바꿀 수 있고, 바꾼 이력과 버전이 남는다.
3. 과제별 점수와 등급의 **산출 근거가 투명하게** 보인다.
4. 선정 포트폴리오의 **유형 균형**(빈 칸)이 한눈에 보인다.
5. AX·HX 양측의 의견과 동의 여부가 과제 단위로 기록된다.
6. 회의 배포용 보고서를 인쇄/PDF 로 뽑을 수 있다.
7. *(보조, 제거 가능)* AX 관리자(컨설턴트)가 화면에서 작성한 프롬프트로 LLM 에게 등급 판정을 요청하고, 제안을 검토 후 반영할 수 있다.

## 2. 기술 스택 · 운영

| 항목 | 결정 |
|---|---|
| 프레임워크 | Next.js 14.2.35 (App Router), React 18.3.1, TypeScript 5.5.3 strict |
| DB | Oracle (`oracledb` ^6, lazy import). 접속 계정이 테이블을 직접 소유(단일 계정) |
| DB 미구성 시 | `data/*.json` 파일 저장소로 자동 전환 + 샘플 데이터 시드 (로컬 시연용) |
| LLM | 사내 OpenAI 호환 엔드포인트, `@langchain/openai` (ChatOpenAI, `configuration.baseURL`) |
| 차트 | recharts |
| 스타일 | CSS Modules + 전역 디자인 토큰(CSS 변수). UI 라이브러리 미사용(완전 제어) |
| 폰트 | Pretendard (npm `pretendard` 패키지로 **셀프 호스팅** — 사내망 CDN 차단 대비) |
| 테스트 | vitest (점수 계산 · 권한 · 프롬프트 생성 · 저장소 JSON 구현) |
| 설정 | `config.yml` 1개 (dev/prd 구분 없음). git 에는 `config.example.yml` 만 커밋 |
| 배포 | `deploy.sh`: git fetch/reset → `npm install` → `npm run build` → `npm prune --omit=dev` → `nohup next start -p 5175` |
| 인증 비밀키 | 환경변수 `AUTH_SECRET` (미설정 시 개발용 기본값 + 경고 로그) |

`config.yml` 형태:
```yaml
db:
  user: ""
  password: ""
  connectString: ""   # host:port/service — 비우면 JSON 파일 저장소 사용
llm:
  enabled: false      # AI 판정(보조 기능) 사용 여부
  baseUrl: ""         # 사내 OpenAI 호환 엔드포인트
  apiKey: ""
  model: ""
  temperature: 0.2
  timeoutMs: 60000
```

## 3. 역할과 권한

| 역할 코드 | 이름 | 소속 | 권한 |
|---|---|---|---|
| `AX_ADMIN` | AX 관리자 | SK AX | 전체. 지표/프롬프트 설정, **AI 판정**, 등급 보정, 상태 변경·선정 확정, 계정 관리, 이력 조회 |
| `HX_REVIEWER` | HX 검토자 | SK hynix | 전체 열람, 과제별 HX 의견·동의 표시, 보고서 출력 |
| `PM` | 과제 PM | 양사 | 과제 등록(본인이 PM), **본인 과제만** 편집·제출, 나머지 열람 |
| `VIEWER` | 열람자 | 양사 | 대시보드·목록·상세 열람(AI 판정 결과 제외) |

- 최초 계정 시드: 계정 테이블이 비어 있으면 `admin` / `admin123!` / `AX_ADMIN` 1건 자동 생성.
- 권한 판정은 `src/lib/auth/permissions.ts` 단일 소스. 미들웨어(경로 차단), 메뉴 노출, API 가드가 모두 같은 함수를 쓴다.
- **AI 판정은 메뉴 숨김 + API 차단 + 상세 화면 탭 숨김** 3중. 과제 상세 API 응답에서도 AX_ADMIN 이 아니면 AI 결과 필드를 제거한다.
- PM 편집 가능 조건: `PM_USER_ID = 본인` 이고 상태가 `DRAFT` 또는 `REWORK`.
- 세션: HMAC 서명 httpOnly 쿠키(8시간), 비밀번호 scrypt 해시. 로그인 5회 연속 실패 시 10분 잠금(메모리 카운터).

## 4. 과제 상태 워크플로

```
DRAFT(작성중) ──PM 제출──▶ SUBMITTED(제출) ──AX 검토 시작──▶ REVIEW(검토중)
     ▲                                                        │
     └──────────── REWORK(보완요청) ◀──AX 보완요청──────────────┤
                                                              ├──▶ SELECTED(선정)
                                                              ├──▶ RESERVE(예비)
                                                              └──▶ EXCLUDED(제외)
```
- 상태 변경은 AX_ADMIN 만(PM 의 제출 제외). 보완요청/제외 시 사유 필수.
- `SELECTED` 로 바꿀 때 HX 동의가 없으면 경고를 띄우되 막지는 않는다(합의 회의 현장 운영 고려).

## 5. 평가 모델

### 5.1 지표 구조 (CRITERIA 설정, JSON)
```
Criteria { version, status: DRAFT|PUBLISHED, publishedAt, publishedBy,
  majorWeight (기본 2), minorWeight (기본 1),
  gradeCut: { high: 70, mid: 45 },
  areas: [ { id, name, question, weight(기본 1), indicators: [
      { id, name, description, tier: MAJOR|MINOR,
        options: [ { id, label, score(0~100), hint } ] } ] } ] }
```

### 5.2 점수 산출 (순수 함수 `src/lib/scoring.ts`)
- 지표 가중치 = tier 가중치(Major/Minor) × 영역 가중치
- 영역 점수 = Σ(선택지 점수 × 지표 tier 가중치) / Σ(응답한 지표 tier 가중치) — 0~100
- 총점 = 응답한 전체 지표에 대해 Σ(선택지 점수 × tier 가중치 × 영역 가중치) / Σ(tier 가중치 × 영역 가중치) — 0~100, 소수 1자리
- 완료율 = 응답 지표 수 / 전체 지표 수. **완료율 < 100% 면 자동 등급은 `미평가`**(점수는 참고 표시)
- 자동 등급: 총점 ≥ high → 상, ≥ mid → 중, 그 외 → 하
- **최종 등급 = 보정 등급(AX_ADMIN, 사유 필수) ?? 자동 등급**
- AI 제안 등급은 별도 보관·표시하며 최종 등급에 자동 반영되지 않는다. "반영" 버튼 = 보정 등급으로 복사(사유에 AI 근거 요약 자동 기입).
- 산출 근거 화면: 지표별 선택값·점수·가중치·기여도(총점 대비 기여 포인트)를 표로 보여준다.

### 5.3 기준 버전 관리
- 설정 화면에서 편집하면 DRAFT 로 저장, "게시" 시 version+1 로 PUBLISHED.
- 과제는 평가 당시 `CRIT_VER` 를 기록. 기준이 새로 게시되면 이전 버전으로 평가된 과제에 "기준 변경됨" 배지 + AX 관리자의 **일괄 재계산** 버튼(응답은 지표 id 로 유지, 사라진 지표 응답은 버린다).

### 5.4 기본 지표 초안 (모두 화면에서 수정 가능)

**① 과제 특성 — 생산성 효과가 클 일인가**
| 지표 | Tier | 선택지(점수) |
|---|---|---|
| 개발 성격 | MAJOR | 신규 100 / 혼합 60 / 레거시 30 |
| 대표 요구사항 유형 | MAJOR | 표준 패턴 100 / 예외 처리 위주 60 / 신규 설계 30 |
| 수행 유형 | MINOR | 전환·신규 100 / 기능 변경 50 |
| 변경 범위 | MINOR | 단일 모듈 100 / 복수 모듈 60 / 복수 시스템 30 |
| 영향도 Risk | MAJOR | 낮음 100 / 보통 60 / 높음 20 |

**② 지식 자산화 — AI 가 참고할 맥락이 있나**
| 지표 | Tier | 선택지(점수) |
|---|---|---|
| 지식 그래프 / RAG | MINOR | 구축됨 100 / 일부 50 / 없음 0 |
| 기능 정의서 | MAJOR | 최신·상세 100 / 있으나 부분·구버전 50 / 없음 0 |
| 아키텍처 문서 | MINOR | 최신 100 / 부분 50 / 없음 0 |
| 인터페이스·데이터 명세서 | MINOR | 최신 100 / 부분 50 / 없음 0 |
| 예외 사례 정리 | MINOR | 정리됨 100 / 일부 50 / 없음 0 |

**③ AI 도구 활용성 — Agent 가 어디까지 실행하나**
| 지표 | Tier | 선택지(점수) |
|---|---|---|
| 실행망 모델 연결 | MAJOR | 연결 가능 100 / 제한적 50 / 불가 0 |
| 자산 읽기 범위 | MINOR | 전체 소스·문서 100 / 일부 50 / 불가 0 |
| Agent 수행 범위 | MAJOR | 빌드·테스트 실행까지 100 / 코드 생성·수정 60 / 조언·검토만 20 |
| 텔레메트리 수집 | MINOR | 자동 수집 100 / 수동 기록 50 / 불가 0 |

**④ 개발 거버넌스 — 결과를 통제·검증할 수 있나**
| 지표 | Tier | 선택지(점수) |
|---|---|---|
| 버전 관리 | MAJOR | Git 100 / SVN 등 기타 VCS 70 / 없음 0 |
| 레거시 개발 규칙 | MINOR | 문서화됨 100 / 암묵적 50 / 없음 0 |
| 회귀시험 | MAJOR | 자동화 100 / 수동 시나리오 50 / 없음 0 |
| AI 산출물 검토 체계 | MINOR | 체계 있음 100 / 담당자 재량 50 / 없음 0 |

> 참고: 같은 지표에 대해 "PoC 적합도"와 "생산성 효과 크기"는 방향이 다를 수 있다(예: 레거시는 효과 측정 가치가 크지만 적합도는 낮음). 이 긴장은 점수가 아니라 **균형 분석**(6.4)으로 다룬다 — 적합도 순 정렬만으로 뽑으면 신규 과제로 쏠리므로 레거시·혼합 칸이 비면 경고한다.

### 5.5 분류 속성 (점수와 별개, 균형 분석용)
과제 기본정보의 코드값으로 관리(`CODES` 설정, 화면에서 편집):
- 개발 성격(지표 값 재사용), 수행 유형(지표 값 재사용)
- 주 개발 언어: Java / C# / Python / JavaScript·TypeScript / C·C++ / PL/SQL / 기타
- 업무 도메인: 제조·FAB / 품질 / 설비 / 연구개발 / 경영지원 / 인프라 / 기타
- 시스템 유형: 웹 / 배치 / 인터페이스·EAI / 데이터·분석 / 임베디드·장비 / 기타

## 6. 화면

### 6.0 디자인 방향
**"Executive Briefing"** — 컨설팅 보고서를 화면으로 옮긴 느낌. 고객 임원 앞 회의 화면에 띄워도 정돈되어 보여야 한다.

- **톤**: 밝은 웜 그레이 바탕(`#F5F4F0`) 위 흰 "시트" 카드, 짙은 잉크 네이비 텍스트(`#14213D`).
  장식 최소화, 얇은 헤어라인(1px `#E4E1D8`)과 넉넉한 여백으로 위계를 만든다. 그림자는 거의 쓰지 않는다.
- **강조색**: 단 하나 — 딥 인디고(`#2B3A8C`). 활성 상태·주요 버튼·선정 하이라이트에만.
- **등급색**(전 화면 일관): 상 `#1E7A5A`(그린) / 중 `#B7791F`(앰버) / 하 `#B4443C`(브릭) / 미평가 `#8A8F98`.
  색만으로 구분하지 않도록 등급 배지에 항상 글자(상/중/하) 병기.
- **타이포**: Pretendard. 페이지 제목 28/700, 섹션 제목 16/700 + 상단 소제목(11px 대문자 영문 레이블, 자간 넓게 — 예: `PORTFOLIO BALANCE`).
  숫자는 `font-variant-numeric: tabular-nums`. KPI 숫자는 큰 사이즈(40/700)로 보고서 느낌.
- **레이아웃**: 좌측 슬림 내비(240px, 접힘 지원) + 상단 컨텍스트 바(현재 기준 버전 `기준 v3 · 2026.10.07 게시`, 로그인 사용자·소속 배지).
  콘텐츠 최대폭 1440px. 1280px 노트북과 회의실 대형 화면 모두 고려.
- **시그니처 요소**:
  1. **포트폴리오 균형 매트릭스** — 개발 성격 × 업무 도메인(축 전환 가능) 격자. 각 칸에 과제 점(등급색), 선정 과제는 채운 원·후보는 빈 원. 선정 0건인 칸은 사선 패턴으로 "공백" 표시.
  2. **합의 씰** — 과제마다 `AX ●  HX ●` 두 개의 작은 인장(동의=채움, 이견=브릭 테두리, 미응답=회색 점선).
  3. **점수 분해 막대** — 4개 영역 기여도를 한 줄 누적 막대로(목록·상세 공통).
- **인터랙션**: 과한 애니메이션 없음. 150ms 페이드/슬라이드만. 저장 시 우상단 토스트. 빈 상태·로딩 스켈레톤·오류 상태 모두 디자인.
- **인쇄**: `@media print` 전용 스타일 — 내비/버튼 제거, A4 가로, 페이지 머리말(문서명·기준 버전·출력일시).

### 6.1 로그인 `/login`
좌측 절반: 프로젝트 타이틀 "AI Tool PoC 과제 선정" + 한 줄 목적 설명 + 진행 단계(후보 접수 → 평가 → 합의 → 확정). 우측: 로그인 폼.

### 6.2 대시보드 `/`
- KPI 5개: 후보 과제 수 / 평가 완료율 / 등급 분포(상·중·하 미니 막대) / 선정 확정 수(목표 대비, 목표는 설정값) / HX 합의율
- 포트폴리오 균형 매트릭스(6.0-1)
- 분포 차트: 언어별 · 시스템 유형별 — 전체 후보 vs 선정 비교 막대
- 영역별 평균 점수(전체 vs 선정) 레이더
- 최근 활동 피드(이력 10건) · 내 할 일(PM: 작성중/보완요청 과제, HX: 의견 미입력 과제, AX: 제출된 검토 대기 과제)

### 6.3 과제 포트폴리오 `/projects`
- 필터: 상태, 최종 등급, 개발 성격, 언어, 도메인, PM, 키워드. URL 쿼리에 반영(링크 공유 가능).
- 테이블 열: 과제코드, 과제명/시스템, PM, 개발 성격, 언어, 점수 분해 막대 + 총점, 자동/최종 등급(보정 시 표시), 완료율, 상태, 합의 씰, 수정일.
- 정렬, 페이지 크기 선택, CSV 내보내기(현재 필터 기준, UTF-8 BOM — 엑셀 한글 깨짐 방지).
- AX_ADMIN: 다중 선택 → 일괄 상태 변경 / AI 판정 요청.

### 6.4 과제 상세 `/projects/[id]`
헤더: 과제명, 코드, 상태, 최종 등급 대형 배지, 총점, 합의 씰, 액션 버튼(권한별).
탭:
1. **개요** — 기본정보 + 원 프로젝트 실적(기준선)
2. **지표 평가** — 4개 영역 카드, 지표별 선택값(편집 가능한 사용자에게는 라디오 카드)
3. **점수 근거** — 산출 표(지표·선택·점수·가중치·기여도), 등급 기준선 표시, 보정 이력
4. **검토·합의** — AX 의견 / HX 의견 스레드(작성자·소속·시각), 각 측 동의/이견/보류 표시
5. **AI 판정** *(AX_ADMIN 전용)* — 최근 판정 결과: 제안 등급, 신뢰도, 근거 요약, 지표별 코멘트, 리스크, Replay 시 유의사항, 사용 모델·프롬프트 버전·시각. "보정 등급으로 반영" 버튼
6. **이력** — 이 과제의 변경 이력 타임라인

### 6.5 과제 등록/편집 `/projects/new`, `/projects/[id]/edit`
3단계 스텝퍼, 단계마다 임시저장:
1. **기본 정보** — 과제명*, 시스템명*, 업무 도메인*, 시스템 유형*, 주 개발 언어*(복수), 프레임워크/기술스택, 과제 설명*, PM(AX_ADMIN 은 지정, PM 은 본인 고정), 담당 조직
2. **원 프로젝트 실적 (Replay 기준선)** — 수행 기간(시작·종료), 총 투입 공수(M/M), 단계별 공수(분석/설계/개발/테스트 M/M), 산출물 규모(선택: 화면 수, 프로그램 수, LOC), 주요 산출물 보유 여부, Replay 대상 단계(체크: 분석/설계/개발/테스트)
3. **지표 평가** — 영역별 카드, 각 지표 설명 + 선택지 라디오 카드(선택지별 힌트), 지표별 보충 메모(선택)

하단 고정 바: 실시간 예상 점수·등급 미리보기, 완료율, [임시저장] [제출]. 필수값 누락 시 제출 불가 + 해당 위치로 스크롤.

### 6.6 선정 보드 `/selection`
- 칸반 6열(작성중·제출·검토중·선정·예비·제외; 보완요청은 작성중 열에 배지로). 카드: 과제명, 등급, 점수, 개발 성격·언어 칩, 합의 씰.
- AX_ADMIN 은 드래그로 상태 변경(사유 필요한 전환은 모달).
- 우측 **균형 체크 패널**: 선정 과제 기준으로 개발 성격·언어·도메인·시스템 유형별 건수, 목표 대비 미달 항목 경고, 상/중/하 혼합 비율.

### 6.7 보고서 `/report`
회의 배포용 인쇄 최적화 페이지: 표지 정보(기준 버전·일시) → 선정 요약 KPI → 균형 매트릭스 → 선정/예비 과제 표(등급·점수·근거 요약·합의) → 평가 기준 부록(지표·가중치). 브라우저 인쇄 → PDF.

### 6.8 설정 (AX_ADMIN)
- `/admin/criteria` **평가 기준** — 영역/지표/선택지 트리 편집, Major/Minor 토글, 가중치·등급 기준 입력, 변경 미리보기(현재 과제들의 등급 변동 시뮬레이션: "상 5→4, 중 6→7"), 게시, 버전 목록.
- `/admin/codes` **코드 관리** — 언어·도메인·시스템 유형 코드, 선정 목표 건수, 균형 목표(예: 개발 성격별 최소 1건).
- `/admin/ai` **AI 판정** *(보조, `llm.enabled` 일 때만)* — ①컨설턴트 프롬프트 편집(섹션 머리말 템플릿, 버전 저장) ②LLM 연결 상태 확인(테스트 호출) ③과제 선택 → 일괄 판정 실행(순차 처리, 진행률 표시) ④판정 결과 목록(자동/최종/AI 등급 불일치 하이라이트).
- `/admin/users` **계정** — 등록(ID, 이름, 소속, 역할, 초기 비밀번호), 수정, 비활성화, 비밀번호 초기화.
- `/admin/history` **변경 이력** — 필터(대상·사용자·기간), 변경 전/후 비교.

### 6.9 공통
- 내 정보: 비밀번호 변경.
- 403/404/오류 페이지 디자인.
- 세션 만료 시 안내 모달 → 로그인 화면(돌아올 경로 유지).

## 7. AI 판정 (보조 기능 — 제거 가능)

**우선순위: 낮음.** 기본 기능(1~6, 8~11)을 먼저 완성하고 마지막 단계에서 붙인다. 언제든 빠질 수 있으므로:
- `config.yml` 의 `llm.enabled: false`(기본값)면 메뉴·탭·API·컬럼 표시가 전부 사라진다.
- 코드는 `src/lib/ai/`, `src/features/ai/`, `src/app/(main)/admin/ai/`, `src/app/api/ai/` 에만 둔다. 다른 모듈은 AI 를 import 하지 않는다(과제 상세의 AI 탭은 동적 import 슬롯). 폴더 삭제 + `AI_GRADE`/`AI_JSON` 무시로 제거 가능.

**프롬프트는 컨설턴트가 화면에서 직접 작성한다.** 앱은 판정 틀만 제공한다.
- `/admin/ai` 의 프롬프트 편집기에 컨설턴트가 **상/중/하 판정 기준, Major 지표가 무엇이고 왜 중요한지, 선정 원칙**을 자연어로 적는다. 빈 템플릿에 섹션 머리말(판정 기준 / Major 지표 해석 / 선정 원칙 / 주의사항)과 예시 문장만 깔아 둔다.
- 컨설턴트는 AX_ADMIN 계정으로 접근한다(AI 메뉴는 AX_ADMIN 전용 유지).
- 프롬프트는 버전으로 저장되고 판정 결과에 사용된 프롬프트 버전이 기록된다.

- 서버 전용 모듈 `src/lib/ai/`. API `POST /api/ai/assess { projectIds[] }` — AX_ADMIN 가드.
- 프롬프트 구성(`buildAssessPrompt`, 순수 함수 · 테스트 대상):
  - **system**: 역할(SK hynix AI Tool Replay PoC 과제 선정 평가자) + **컨설턴트가 작성한 프롬프트** + 출력 JSON 스키마(고정, 앱이 붙임)
  - **user**: 현재 게시 기준(영역·지표·Tier·선택지·점수·가중치·등급 기준), 대상 과제 기본정보·실적·지표 응답·자동 점수, 현재 선정 포트폴리오 분포 요약(균형 판단용)
- 출력 스키마(JSON, `withStructuredOutput` 미지원 엔드포인트 대비 JSON 문자열 파싱 + 검증 폴백):
  `{ grade: "상"|"중"|"하", confidence: 0~1, summary, strengths[], risks[], indicatorComments: [{indicatorId, comment}], replayNotes, balanceNote }`
- 저장: 과제의 `AI_JSON` 에 `{ ...결과, model, promptVersion, criteriaVersion, assessedAt, assessedBy }`. 이전 결과 1건만 보관(이력 테이블엔 요약 기록).
- 실패 처리: 타임아웃/파싱 실패는 과제 단위로 오류 표시, 나머지는 계속 진행. API 키는 서버에서만 읽고 응답·로그에 남기지 않는다.
- 보내는 데이터는 사내 엔드포인트로만 간다. 화면에 "사내 LLM 으로 과제 정보가 전송됩니다" 고지.

## 8. 데이터 모델 (조인 없음, 4 테이블)

모든 조회는 테이블 단독. 화면에 필요한 사람 이름 등은 과제 행에 **비정규화**(PM 이름 저장)하거나 앱 메모리에서 매핑.

### `POC_USER_MAS` 계정
`USER_ID`(PK, VARCHAR2 50) · `USER_NM` · `ORG_CD`(SKAX/SKHYNIX) · `DEPT_NM` · `ROLE_CD`(AX_ADMIN/HX_REVIEWER/PM/VIEWER) · `PWD_HASH` · `PWD_SALT` · `USE_YN` · `LAST_LOGIN_DT` · `REG_DT` · `UPD_DT`

### `POC_PRJ_MAS` 과제
| 컬럼 | 설명 |
|---|---|
| `PRJ_ID` PK VARCHAR2(20) | `PRJ-0001` 형식(앱에서 MAX+1 채번, 유니크 제약으로 충돌 시 재시도) |
| `PRJ_NM`, `SYS_NM` | 과제명, 시스템명 |
| `PM_USER_ID`, `PM_USER_NM` | PM (이름 비정규화) |
| `STATUS_CD` | DRAFT/SUBMITTED/REVIEW/REWORK/SELECTED/RESERVE/EXCLUDED |
| `DEV_TYPE_CD`, `MAIN_LANG_CD`, `DOMAIN_CD`, `SYS_TYPE_CD` | 필터·균형용 (BASE_JSON 에서 복제) |
| `TOTAL_SCORE` NUMBER(5,1), `COMPLETE_RATE` NUMBER(5,1) | 자동 점수, 완료율 |
| `AUTO_GRADE`, `OVR_GRADE`, `FINAL_GRADE` | H/M/L/NA |
| `AI_GRADE` | AI 제안 등급(목록 비교용, AX 외 응답에서 제거) |
| `AX_AGREE_CD`, `HX_AGREE_CD` | AGREE/DISAGREE/HOLD/NONE |
| `CRIT_VER` NUMBER | 평가 기준 버전 |
| `BASE_JSON` CLOB | 기본정보 + 원 프로젝트 실적 |
| `EVAL_JSON` CLOB | `{ answers: {indicatorId: optionId}, notes: {indicatorId: text}, areaScores, override: {grade, reason, by, at} }` |
| `REVIEW_JSON` CLOB | 의견 스레드 `[{side, userId, userNm, agree, text, at}]` |
| `AI_JSON` CLOB | 최근 AI 판정 결과 |
| `REG_USER_ID`, `REG_DT`, `UPD_USER_ID`, `UPD_DT` | 감사 |

### `POC_CFG_MAS` 설정
`CFG_KEY`(PK: `CRITERIA`, `CRITERIA_DRAFT`, `CODES`, `AI_PROMPT`) · `CFG_JSON` CLOB · `VER_NO` · `UPD_USER_ID` · `UPD_DT`
- 게시된 기준의 과거 버전은 `CRITERIA@3` 같은 키로 보관(버전 목록 조회 = `CFG_KEY LIKE 'CRITERIA@%'`).

### `POC_HIST_HIS` 변경 이력
`HIST_ID`(PK, NUMBER IDENTITY) · `TARGET_TYP`(PROJECT/CRITERIA/USER/CODES/AI_PROMPT) · `TARGET_ID` · `ACTION_CD`(CREATE/UPDATE/SUBMIT/STATUS/OVERRIDE/REVIEW/AI_ASSESS/PUBLISH/…) · `SUMMARY` VARCHAR2(500) · `DIFF_JSON` CLOB · `USER_ID` · `USER_NM` · `REG_DT`

DDL 은 `sql/create_tables.sql` 1개 파일(코멘트 포함), 롤백 구문 동봉.
CLOB 은 `oracledb.fetchAsString = [oracledb.CLOB]` 로 문자열 조회.

## 9. 코드 구조

```
src/
  app/                    라우트(얇게). 화면 컴포넌트는 features/ 로
    (auth)/login/
    (main)/               로그인 후 레이아웃(내비·컨텍스트 바)
      page.tsx            대시보드
      projects/ selection/ report/ admin/{criteria,codes,ai,users,history}/ me/
    api/                  파싱 + 가드 + 응답. 로직은 lib/ 로
  features/<화면>/         화면 전용 컴포넌트
  components/ui/          공용 UI(Button, Badge, GradeBadge, AgreementSeal, ScoreBar, Table, Modal, Tabs, Toast, Stepper, EmptyState …)
  lib/
    config.ts             config.yml 로더
    store/                Store 인터페이스 + oracle.ts + json.ts + index.ts(선택)
    scoring.ts            점수·등급 산출(순수)
    balance.ts            균형 분석(순수)
    criteria/defaults.ts  기본 지표·코드·프롬프트
    auth/                 session.ts, password.ts, permissions.ts(순수), guard.ts
    ai/                   prompt.ts(순수), assess.ts(LangChain 호출)
    history.ts            이력 기록 헬퍼
    apiClient.ts          클라이언트 fetch 래퍼(401 처리)
    types.ts
  styles/tokens.css       디자인 토큰
  middleware.ts
sql/create_tables.sql
config.example.yml
deploy.sh
```

### Store 인터페이스
```ts
interface Store {
  users: { list(); get(id); create(u); update(id, patch); }
  projects: { list(filter?); get(id); create(p); update(id, patch); nextId(); }
  config: { get<T>(key); set(key, value, userId); listKeys(prefix); }
  history: { add(entry); list(filter); }
}
```
- `getStore()` 가 config 의 db 설정 유무로 Oracle/JSON 구현 선택.
- Oracle 드라이버 로드 실패 시 오류 로그 + 화면 상단 "DB 연결 실패" 배너(JSON 으로 조용히 바꾸지 않는다 — 운영에서 데이터가 엉뚱한 곳에 쌓이는 것을 막기 위해). JSON 모드는 **db 설정이 비어 있을 때만**.
- JSON 모드는 컨텍스트 바에 "로컬 데모 데이터" 배지 표시.

## 10. 오류 처리

- API 응답 형식 통일: 성공 `{ data }`, 실패 `{ error: { code, message } }` + HTTP 상태.
- 401 → 클라이언트 전역 세션 만료 모달. 403 → 토스트 + 권한 안내.
- 낙관적 동시성: 과제 수정 시 `UPD_DT` 를 함께 보내고 다르면 409 "다른 사용자가 먼저 수정했습니다" + 새로고침 안내.
- SQL 은 모두 바인드 변수.
- 입력 검증은 서버에서 수행(클라이언트 검증은 UX 용).

## 11. 테스트 · 검증

- vitest 단위 테스트: `scoring`(가중치·완료율·경계값·보정 우선), `permissions`(역할×행위 매트릭스, PM 본인 과제/상태 조건), `balance`, `ai/prompt`(필수 섹션 포함·AI 응답 파싱/검증), `store/json`(CRUD·채번·동시성 409).
- `npx tsc --noEmit`, `npm run build` 통과.
- JSON 모드로 실행해 역할별(AX/HX/PM/VIEWER) 주요 흐름을 브라우저로 확인: 로그인 → PM 등록·제출 → AX 검토·보정 → HX 의견·동의 → 선정 → 보고서 인쇄 미리보기.
- Oracle·LLM 실 연동은 사내망에서 사용자가 확인(연결 테스트 버튼 제공).

## 12. 범위 밖 (이번 버전)

- SSO 연동, 이메일/메신저 알림, 엑셀 업로드 일괄 등록, Replay 실행 결과(실측 공수) 입력·비교 화면.
  → 구조는 열어 둔다: 실측 비교는 `BASE_JSON` 의 기준선 + 향후 `RESULT_JSON` 컬럼 추가로 확장 가능.
