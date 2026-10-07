# PoC 과제 선정 포털 — 설계 문서

- 작성일: 2026-10-07
- 작성: SK AX (devGWeloper)
- 상태: 사용자 검토 대기 (rev.2 — 점수 제거, 운영 방식 확정)
- 후속 문서: [2026-10-07-replay-measurement-design.md](2026-10-07-replay-measurement-design.md) — 측정 모듈, 역할 DEVELOPER·TESTER 추가, 테이블 POC_MEAS_DAT 추가

## 1. 배경과 목적

SK hynix 는 AI Tool 도입으로 DT 생산성이 향상됐다는 지표를 확보하려 한다. 방법은 **Replay 테스트** —
AI Tool 없이 이미 완료된 프로젝트를 AI Tool 로 다시 수행(분석/설계/개발/테스트)해 비교한다.

과제 성격(신규/레거시, 언어, 변경 범위 등)에 따라 AI 효과 편차가 크다. 그래서 후보 과제를 지표로
**적합도 상/중/하로 분류**하고, 최종 선정은 **상·중·하와 과제 유형이 고르게 섞이도록** 한다
(잘 맞는 과제만 고르면 생산성 효과가 과대평가된다).

이 포털은 그 과정을 SK AX 와 SK hynix 가 **함께 보고 합의**하는 공식 화면이다.
고객사 의사결정자가 보는 화면이므로 화면 품질과 신뢰감이 핵심 요구사항이다.

### 설계 원칙: 점수 없음
지표는 **정성 판단**이다. 화면 어디에도 숫자 점수·총점·가중치를 두지 않는다.
- 지표 응답 = 선택지, 각 선택지는 **적합 수준(상/중/하)** 에 대응한다.
- 과제 적합도 = 지표 프로필(어느 지표가 상·중·하인지)을 보고 **판정 규칙이 제안 → AX 관리자가 확정**.
- 숫자는 건수(과제 수, 지표 응답 수)에만 쓴다.

### 성공 기준
1. 과제 PM 이 자기 과제 정보를 직접 입력·제출할 수 있다.
2. 지표(Major/Minor, 선택지, 판정 규칙)가 확정되지 않았으므로 화면에서 바꿀 수 있고, 버전·이력이 남는다.
3. 과제별 적합도 판정의 **근거(지표 프로필)가 한눈에** 보인다.
4. 선정 포트폴리오의 **균형(상/중/하 × 과제 유형)** 과 빈 칸이 한눈에 보인다.
5. AX·HX 양측의 의견과 동의 여부가 과제 단위로 기록된다.
6. 과제 목록과 선정 결과를 엑셀로 내려받고, 회의용 보고서를 인쇄/PDF 로 뽑을 수 있다.
7. *(보조, 제거 가능)* 컨설턴트가 화면에서 작성한 프롬프트로 LLM 에게 적합도 판정 의견을 받을 수 있다.

## 2. 기술 스택 · 운영

| 항목 | 결정 |
|---|---|
| 프레임워크 | Next.js 14.2.35 (App Router), React 18.3.1, TypeScript 5.5.3 strict |
| DB | Oracle (`oracledb` ^6, lazy import). 접속 계정이 테이블을 직접 소유(단일 계정) |
| DB 미구성 시 | `data/*.json` 파일 저장소 + 샘플 데이터 자동 시드 (외부망·로컬 시연) |
| LLM *(보조)* | 사내 OpenAI 호환 엔드포인트, `@langchain/openai` (ChatOpenAI, `configuration.baseURL`) |
| 차트 | recharts |
| 엑셀 | `exceljs` (서식 있는 .xlsx 생성, 내려받기 전용) |
| 스타일 | CSS Modules + 전역 디자인 토큰(CSS 변수). UI 라이브러리 미사용 |
| 폰트 | Pretendard (npm `pretendard` 패키지로 셀프 호스팅 — 사내망 CDN 차단 대비) |
| 테스트 | vitest |
| 인증 | 자체 로그인(SSO 없음) |

### 운영 방식 — "config.yml 만 바꾸고 `npm run dev`"
- 외부망: `config.yml` 없음 → JSON 저장소로 그대로 동작.
- 사내망: `config.example.yml` 을 `config.yml` 로 복사해 DB 정보만 채우고 `npm install && npm run dev`.
- **테이블 자동 생성**: Oracle 연결 시 최초 1회 `USER_TABLES` 를 확인해 `POC_` 테이블이 없으면 DDL 을 실행한다(단일 계정이 소유하므로 권한 문제 없음). 같은 DDL 을 `sql/create_tables.sql` 로도 제공(DBA 수동 실행용).
- 계정 테이블이 비어 있으면 `admin` / `admin123!` (AX_ADMIN) 자동 생성.
- `config.yml` 은 gitignore (비밀번호·API 키 보호). 별도 배포 스크립트 없음.
- 포트 기본 3000 (`npm run dev` / `npm run build && npm start` 둘 다 동작).

`config.example.yml`:
```yaml
db:
  user: ""
  password: ""
  connectString: ""   # host:port/service — 비우면 로컬 JSON 저장소 사용
auth:
  secret: ""          # 세션 서명 키 — 비우면 개발용 기본값(경고 로그)
llm:
  enabled: false      # AI 판정(보조 기능)
  baseUrl: ""
  apiKey: ""
  model: ""
  temperature: 0.2
  timeoutMs: 60000
```

## 3. 역할과 권한

| 역할 코드 | 이름 | 소속 | 권한 |
|---|---|---|---|
| `AX_ADMIN` | AX 관리자 | SK AX | 전체. 지표 설정, 적합도 확정, 상태 변경·선정 확정, 계정 관리, 이력, *(AI 판정)* |
| `HX_REVIEWER` | HX 검토자 | SK hynix | 전체 열람, 과제별 HX 의견·동의 표시, 엑셀·보고서 출력 |
| `PM` | 과제 PM | 양사 | 과제 등록(본인이 PM), **본인 과제만** 편집·제출, 나머지 열람 |
| `VIEWER` | 열람자 | 양사 | 대시보드·목록·상세 열람 |

- 권한 판정은 `src/lib/auth/permissions.ts` 단일 소스. 미들웨어(경로 차단), 메뉴 노출, API 가드가 같은 함수를 쓴다.
- PM 편집 가능 조건: `PM_USER_ID = 본인` 이고 상태가 `DRAFT` 또는 `SUPPLEMENT`.
- 세션: HMAC 서명 httpOnly 쿠키(8시간), 비밀번호 scrypt 해시(Node 내장 crypto). 로그인 5회 연속 실패 시 10분 잠금(메모리 카운터).
- AI 기능은 AX_ADMIN 전용: 메뉴 숨김 + API 차단 + 다른 역할의 응답에서 AI 필드 제거.

## 4. 과제 상태 워크플로

```
DRAFT(작성중) ──PM 제출──▶ SUBMITTED(제출) ──AX 검토 시작──▶ REVIEW(검토중)
     ▲                                                        │
     └──────────── SUPPLEMENT(보완요청) ◀──AX 보완요청──────────────┤
                                                              ├──▶ SELECTED(선정)
                                                              ├──▶ RESERVE(예비)
                                                              └──▶ EXCLUDED(제외)
```
- 상태 변경은 AX_ADMIN 만(PM 의 제출 제외). 보완요청/제외 시 사유 필수.
- `SELECTED` 로 바꿀 때 적합도 미확정이거나 HX 동의가 없으면 경고(막지는 않음 — 합의 회의 현장 운영 고려).

## 5. 평가 모델

### 5.1 지표 구조 (CRITERIA 설정, JSON)
```
Criteria { version, publishedAt, publishedBy,
  rule: { highMaxMajorLow: 0, highMinMajorHigh: "half", lowMinMajorLow: 2 },
  areas: [ { id, name, question, indicators: [
      { id, name, description, tier: MAJOR|MINOR,
        options: [ { id, label, level: H|M|L, hint } ] } ] } ] }
```

### 5.2 적합도 판정 (순수 함수 `src/lib/fitness.ts`)
1. **지표 프로필** = 지표별 응답 수준(H/M/L/미응답). Major 와 Minor 를 구분해 집계.
2. **제안 적합도** (모든 Major 지표에 응답했을 때만; 아니면 `미평가`):
   - **하**: Major 중 `하` 가 `lowMinMajorLow`(기본 2)개 이상
   - **상**: Major 중 `하` 가 `highMaxMajorLow`(기본 0)개 이하 **그리고** Major 중 `상` 이 `highMinMajorHigh`(기본 과반) 이상
   - **중**: 그 외
   - Minor 는 제안 적합도를 바꾸지 않는다. 대신 화면에 "보완 신호"(Minor `하` 목록)로 보인다.
   - 규칙 값은 평가 기준 화면에서 바꿀 수 있다(문장형 입력: "Major 지표 중 하가 [2]개 이상이면 하").
3. **확정 적합도** = AX 관리자가 확정한 값(제안과 다르면 사유 필수). 미확정이면 제안 적합도를 점선 배지로 표시.
4. 판정 근거 화면: 영역별로 지표·선택값·수준·Major 여부를 표로, 적용된 규칙 문장을 그대로 보여준다
   (예: "Major 8개 중 하 0개, 상 5개 → 상").

### 5.3 기준 버전 관리
- 설정 화면에서 편집 → 초안 저장 → "게시" 시 version+1.
- 과제는 판정 당시 `CRIT_VER` 를 기록. 새 기준 게시 후 이전 버전 과제엔 "기준 변경됨" 배지 + AX 관리자 **일괄 재판정**(응답은 지표·선택지 id 로 유지, 사라진 지표 응답은 버림. 확정 적합도는 유지하고 제안만 갱신).
- 게시 전 **변동 미리보기**: "제안 적합도 상 5→4, 중 6→7" 처럼 현재 과제들에 미치는 영향 표시.

### 5.4 기본 지표 초안 (모두 화면에서 수정 가능)

**① 과제 특성 — 생산성 효과가 클 일인가**
| 지표 | Tier | 선택지 (수준) |
|---|---|---|
| 개발 성격 | MAJOR | 신규(상) / 혼합(중) / 레거시(하) |
| 대표 요구사항 유형 | MAJOR | 표준 패턴(상) / 예외 처리 위주(중) / 신규 설계(하) |
| 수행 유형 | MINOR | 전환·신규(상) / 기능 변경(중) |
| 변경 범위 | MINOR | 단일 모듈(상) / 복수 모듈(중) / 복수 시스템(하) |
| 영향도 Risk | MAJOR | 낮음(상) / 보통(중) / 높음(하) |

**② 지식 자산화 — AI 가 참고할 맥락이 있나**
| 지표 | Tier | 선택지 (수준) |
|---|---|---|
| 지식 그래프 / RAG | MINOR | 구축됨(상) / 일부(중) / 없음(하) |
| 기능 정의서 | MAJOR | 최신·상세(상) / 부분·구버전(중) / 없음(하) |
| 아키텍처 문서 | MINOR | 최신(상) / 부분(중) / 없음(하) |
| 인터페이스·데이터 명세서 | MINOR | 최신(상) / 부분(중) / 없음(하) |
| 예외 사례 정리 | MINOR | 정리됨(상) / 일부(중) / 없음(하) |

**③ AI 도구 활용성 — Agent 가 어디까지 실행하나**
| 지표 | Tier | 선택지 (수준) |
|---|---|---|
| 실행망 모델 연결 | MAJOR | 연결 가능(상) / 제한적(중) / 불가(하) |
| 자산 읽기 범위 | MINOR | 전체 소스·문서(상) / 일부(중) / 불가(하) |
| Agent 수행 범위 | MAJOR | 빌드·테스트 실행까지(상) / 코드 생성·수정(중) / 조언·검토만(하) |
| 텔레메트리 수집 | MINOR | 자동 수집(상) / 수동 기록(중) / 불가(하) |

**④ 개발 거버넌스 — 결과를 통제·검증할 수 있나**
| 지표 | Tier | 선택지 (수준) |
|---|---|---|
| 버전 관리 | MAJOR | Git(상) / 기타 VCS(중) / 없음(하) |
| 레거시 개발 규칙 | MINOR | 문서화됨(상) / 암묵적(중) / 없음(하) |
| 회귀시험 | MAJOR | 자동화(상) / 수동 시나리오(중) / 없음(하) |
| AI 산출물 검토 체계 | MINOR | 체계 있음(상) / 담당자 재량(중) / 없음(하) |

### 5.5 분류 속성 (균형 분석용, 판정과 별개)
과제 기본정보의 코드값(`CODES` 설정, 화면에서 편집):
- 개발 성격·수행 유형 (지표 응답 재사용)
- 주 개발 언어: Java / C# / Python / JavaScript·TypeScript / C·C++ / PL/SQL / 기타
- 업무 도메인: 제조·FAB / 품질 / 설비 / 연구개발 / 경영지원 / 인프라 / 기타
- 시스템 유형: 웹 / 배치 / 인터페이스·EAI / 데이터·분석 / 임베디드·장비 / 기타

### 5.6 균형 목표 (`CODES` 설정)
- 선정 목표 건수 (예: 9건)
- 적합도별 목표 (예: 상 3 / 중 3 / 하 3)
- 차원별 최소 커버리지 (예: 개발 성격 각 값 ≥ 1건, 언어 ≥ 3종)
- 균형 분석(`src/lib/balance.ts`, 순수)이 목표 대비 부족·편중 항목을 경고 문장으로 낸다.

## 6. 화면

### 6.0 디자인 방향
**"Executive Briefing"** — 컨설팅 보고서를 화면으로 옮긴 느낌. 고객 임원 앞 회의 화면에 띄워도 정돈되어 보여야 한다.

- **톤**: 밝은 웜 그레이 바탕(`#F5F4F0`) 위 흰 시트 카드, 짙은 잉크 네이비 텍스트(`#14213D`).
  장식 최소화, 1px 헤어라인(`#E4E1D8`)과 넉넉한 여백으로 위계를 만든다. 그림자는 거의 쓰지 않는다.
- **강조색**: 하나 — 딥 인디고(`#2B3A8C`). 활성 상태·주요 버튼·선정 하이라이트에만.
- **적합도 색**(전 화면 일관): 상 `#1E7A5A` / 중 `#B7791F` / 하 `#B4443C` / 미평가 `#8A8F98`.
  색만으로 구분하지 않도록 배지에 항상 글자(상/중/하) 병기.
- **타이포**: Pretendard. 페이지 제목 28/700, 섹션 제목 16/700 + 위에 작은 영문 레이블(11px 대문자, 넓은 자간 — 예: `PORTFOLIO BALANCE`). 건수 숫자는 tabular-nums.
- **레이아웃**: 좌측 슬림 내비(240px, 접힘 지원) + 상단 컨텍스트 바(`평가 기준 v3 · 2026.10.07 게시`, 사용자·소속 배지, JSON 모드면 "로컬 데모 데이터" 배지). 콘텐츠 최대폭 1440px.
- **시그니처 요소**:
  1. **지표 프로필 스트립** — 17개 지표를 영역별 4묶음의 작은 칸으로 나열, 칸 색 = 응답 수준(상/중/하/미응답), Major 는 더 크게. 목록·카드·상세에서 같은 컴포넌트로 쓰며, 칸에 마우스를 올리면 지표명·선택값. 숫자 없이 과제의 성격이 보인다.
  2. **포트폴리오 균형 매트릭스** — 적합도(상/중/하) × 개발 성격(축 전환: 도메인/언어/시스템 유형) 격자. 각 칸에 과제 칩, 선정 과제는 채움·후보는 외곽선. 선정 0건 칸은 사선 패턴으로 "공백".
  3. **합의 씰** — `AX ●  HX ●` 두 인장(동의=채움, 이견=브릭 테두리, 보류=앰버, 미응답=회색 점선).
- **인터랙션**: 150ms 페이드/슬라이드 정도만. 저장 토스트. 빈 상태·로딩 스켈레톤·오류 상태 모두 디자인.
- **인쇄**: `@media print` — 내비/버튼 제거, A4 가로, 머리말(문서명·기준 버전·출력일시).

### 6.1 로그인 `/login`
좌측: "AI Tool PoC 과제 선정" 타이틀, 목적 한 줄, 진행 단계(후보 접수 → 평가 → 합의 → 확정). 우측: 로그인 폼.

### 6.2 대시보드 `/`
- 요약 지표(건수): 후보 과제 / 제출 완료 / 적합도 확정(상·중·하 분포) / 선정 확정(목표 대비) / HX 합의 완료
- 포트폴리오 균형 매트릭스
- 균형 체크: 목표 대비 부족 항목 경고 문장 목록 ("레거시 과제 선정 0건", "하 적합도 목표 3건 중 1건")
- 분포 차트: 언어별 · 시스템 유형별 — 후보 vs 선정 막대
- 내 할 일(역할별) · 최근 활동(이력 10건)

### 6.3 과제 포트폴리오 `/projects`
- 필터: 상태, 확정/제안 적합도, 개발 성격, 언어, 도메인, PM, 키워드. URL 쿼리에 반영.
- 열: 과제코드, 과제명/시스템, PM, 개발 성격, 언어, **지표 프로필 스트립**, 적합도(확정 실선 / 제안 점선), 응답 현황(15/17), 상태, 합의 씰, 수정일.
- 정렬, 페이지 크기, **엑셀 내려받기**(현재 필터 기준).
- AX_ADMIN: 다중 선택 → 일괄 상태 변경 / 일괄 적합도 확정(제안대로).

### 6.4 과제 상세 `/projects/[id]`
헤더: 과제명, 코드, 상태, 적합도 대형 배지(확정/제안), 합의 씰, 권한별 액션.
탭:
1. **개요** — 기본정보 + 원 프로젝트 실적(기준선)
2. **지표 평가** — 4개 영역 카드, 지표별 선택값·수준·메모
3. **판정 근거** — 지표 프로필 표, 적용된 판정 규칙 문장, 확정 이력(누가·언제·사유)
4. **검토·합의** — AX/HX 의견 스레드, 측별 동의/이견/보류
5. **AI 의견** *(AX_ADMIN, `llm.enabled` 일 때만)*
6. **이력** — 이 과제의 변경 타임라인

### 6.5 과제 등록/편집 `/projects/new`, `/projects/[id]/edit`
3단계 스텝퍼, 단계마다 임시저장:
1. **기본 정보** — 과제명*, 시스템명*, 업무 도메인*, 시스템 유형*, 주 개발 언어*(복수), 프레임워크/기술스택, 과제 설명*, PM(AX_ADMIN 은 지정, PM 은 본인 고정), 담당 조직
2. **원 프로젝트 실적 (Replay 기준선)** — 수행 기간, 총 투입 공수(M/M), 단계별 공수(분석/설계/개발/테스트), 산출물 규모(선택: 화면 수, 프로그램 수, LOC), Replay 대상 단계(체크)
3. **지표 평가** — 영역별 카드, 지표 설명 + 선택지 라디오 카드(힌트), 지표별 보충 메모(선택)

하단 고정 바: 실시간 지표 프로필 + 제안 적합도 미리보기, 응답 현황, [임시저장] [제출]. 필수값 누락 시 제출 불가 + 해당 위치로 스크롤.

### 6.6 선정 보드 `/selection`
- 칸반(작성중·제출·검토중·선정·예비·제외; 보완요청은 작성중 열에 배지). 카드: 과제명, 적합도, 지표 프로필 스트립, 개발 성격·언어 칩, 합의 씰.
- AX_ADMIN 은 드래그로 상태 변경(사유 필요한 전환은 모달).
- 우측 **균형 체크 패널**: 선정 기준 적합도별·개발 성격별·언어별·도메인별·시스템 유형별 건수, 목표 대비 부족 경고.

### 6.7 보고서 `/report`
인쇄 최적화: 표지 정보(기준 버전·일시) → 선정 요약 → 균형 매트릭스 → 선정/예비 과제 표(적합도·지표 프로필·판정 근거 요약·합의 상태) → 평가 기준 부록(지표·Major/Minor·선택지·판정 규칙). 브라우저 인쇄 → PDF.

### 6.8 엑셀 내려받기
- `GET /api/export/projects?…필터` → `.xlsx` (시트1 과제 목록: 기본정보·실적·적합도·상태·합의 / 시트2 지표 응답: 과제 × 지표 매트릭스, 셀 색 = 수준 / 시트3 평가 기준).
- 헤더 고정, 열 너비, 적합도 셀 색상 서식. 파일명 `PoC_과제목록_YYYYMMDD.xlsx`.
- 업로드(일괄 등록)는 하지 않는다.

### 6.9 설정 (AX_ADMIN)
- `/admin/criteria` **평가 기준** — 영역/지표/선택지 편집, Major/Minor 토글, 선택지 수준(상/중/하) 지정, 판정 규칙 문장형 입력, 변동 미리보기, 게시, 버전 목록.
- `/admin/codes` **코드·목표** — 언어·도메인·시스템 유형 코드, 선정 목표 건수, 적합도별 목표, 차원별 최소 커버리지.
- `/admin/users` **계정** — 등록(ID, 이름, 소속, 역할, 초기 비밀번호), 수정, 비활성화, 비밀번호 초기화.
- `/admin/history` **변경 이력** — 필터(대상·사용자·기간), 변경 전/후 비교.
- `/admin/ai` *(보조)* — 7절.

### 6.10 공통
내 정보(비밀번호 변경), 403/404/오류 페이지, 세션 만료 모달 → 로그인(돌아올 경로 유지).

## 7. AI 판정 (보조 기능 — 제거 가능, 마지막 단계에 구현)

- `llm.enabled: false`(기본)면 메뉴·탭·API 가 전부 사라진다.
- 코드는 `src/lib/ai/`, `src/features/ai/`, `src/app/(main)/admin/ai/`, `src/app/api/ai/` 에만 둔다. 다른 모듈은 AI 를 import 하지 않는다(과제 상세 AI 탭은 동적 import 슬롯). 폴더 삭제로 제거 가능.
- **프롬프트는 컨설턴트가 `/admin/ai` 에서 직접 작성**한다(AX_ADMIN 계정 사용). 빈 템플릿에 섹션 머리말만 둔다: 판정 기준(상/중/하가 무엇인가) / Major 지표 해석 / 선정 원칙 / 주의사항. 버전으로 저장.
- 요청 구성(`buildAssessPrompt`, 순수): system = 역할 + 컨설턴트 프롬프트 + 출력 JSON 형식(고정) / user = 현재 평가 기준, 과제 기본정보·실적·지표 응답·제안 적합도, 현재 선정 분포 요약.
- 출력: `{ grade: "상"|"중"|"하", summary, strengths[], risks[], indicatorComments[{indicatorId, comment}], replayNotes, balanceNote }` — JSON 파싱 + 검증, 실패 시 과제 단위 오류.
- 과제를 골라 일괄 실행(순차, 진행률). 결과는 과제의 `AI_JSON` 에 저장(모델·프롬프트 버전·시각·실행자 포함), 최종 적합도에 자동 반영하지 않는다. "확정 적합도로 반영" 버튼 = 사유에 AI 요약 자동 기입.
- 연결 테스트 버튼. API 키는 서버에서만 사용, 응답·로그에 남기지 않는다.

## 8. 데이터 모델 (조인 없음, 4 테이블)

모든 조회는 테이블 단독. 화면에 필요한 PM 이름은 과제 행에 비정규화.

### `POC_USER_MAS` 계정
`USER_ID`(PK, VARCHAR2 50) · `USER_NM` · `ORG_CD`(SKAX/SKHYNIX) · `DEPT_NM` · `ROLE_CD`(AX_ADMIN/HX_REVIEWER/PM/VIEWER) · `PWD_HASH` · `PWD_SALT` · `USE_YN` · `LAST_LOGIN_DT` · `REG_DT` · `UPD_DT`

### `POC_PRJ_MAS` 과제
| 컬럼 | 설명 |
|---|---|
| `PRJ_ID` PK VARCHAR2(20) | `PRJ-0001` (앱에서 MAX+1 채번, PK 충돌 시 재시도) |
| `PRJ_NM`, `SYS_NM` | 과제명, 시스템명 |
| `PM_USER_ID`, `PM_USER_NM` | PM (이름 비정규화) |
| `STATUS_CD` | DRAFT/SUBMITTED/REVIEW/SUPPLEMENT/SELECTED/RESERVE/EXCLUDED |
| `DEV_TYPE_CD`, `MAIN_LANG_CD`, `DOMAIN_CD`, `SYS_TYPE_CD` | 필터·균형용 (BASE/EVAL 에서 복제) |
| `ANSWER_CNT`, `INDICATOR_CNT` | 응답 현황 |
| `SUGGEST_FIT`, `FINAL_FIT` | H/M/L/NA — 제안 / 확정 적합도 |
| `AI_FIT` | AI 의견 등급 (AX 외 응답에서 제거) |
| `AX_AGREE_CD`, `HX_AGREE_CD` | AGREE/DISAGREE/HOLD/NONE |
| `CRIT_VER` NUMBER | 판정 기준 버전 |
| `BASE_JSON` CLOB | 기본정보 + 원 프로젝트 실적 |
| `EVAL_JSON` CLOB | `{ answers: {indicatorId: optionId}, notes: {indicatorId: text}, confirm: {fit, reason, by, at} }` |
| `REVIEW_JSON` CLOB | 의견 스레드 `[{side, userId, userNm, agree, text, at}]` |
| `AI_JSON` CLOB | 최근 AI 판정 |
| `REG_USER_ID`, `REG_DT`, `UPD_USER_ID`, `UPD_DT` | 감사 |

### `POC_CFG_MAS` 설정
`CFG_KEY`(PK: `CRITERIA`, `CRITERIA_DRAFT`, `CRITERIA@{n}`, `CODES`, `AI_PROMPT`) · `CFG_JSON` CLOB · `VER_NO` · `UPD_USER_ID` · `UPD_DT`

### `POC_HIST_HIS` 변경 이력
`HIST_ID`(PK, NUMBER IDENTITY) · `TARGET_TYP`(PROJECT/CRITERIA/USER/CODES/AI_PROMPT) · `TARGET_ID` · `ACTION_CD`(CREATE/UPDATE/SUBMIT/STATUS/CONFIRM/REVIEW/AI_ASSESS/PUBLISH/…) · `SUMMARY` VARCHAR2(500) · `DIFF_JSON` CLOB · `USER_ID` · `USER_NM` · `REG_DT`

CLOB 은 `fetchAsString = [CLOB]` 로 문자열 조회.

## 9. 코드 구조

```
src/
  app/
    login/
    (main)/               로그인 후 레이아웃(내비·컨텍스트 바)
      page.tsx            대시보드
      projects/ selection/ report/ admin/{criteria,codes,users,history,ai}/ me/
    api/                  파싱 + 가드 + 응답. 로직은 lib/
  features/<화면>/
  components/ui/          Button, Badge, FitBadge, ProfileStrip, AgreementSeal, Table, Modal, Tabs, Toast, Stepper, EmptyState …
  lib/
    config.ts             config.yml 로더
    store/                Store 인터페이스 + oracle.ts(+schema.ts 자동 DDL) + json.ts + index.ts
    fitness.ts            지표 프로필·제안 적합도(순수)
    balance.ts            균형 분석(순수)
    criteria/defaults.ts  기본 지표·코드·샘플 과제
    auth/                 session.ts, password.ts, permissions.ts(순수), guard.ts
    export/xlsx.ts        엑셀 생성
    ai/                   (보조) prompt.ts, assess.ts
    history.ts · apiClient.ts · types.ts
  styles/tokens.css
  middleware.ts
sql/create_tables.sql
config.example.yml
```

`Store` 인터페이스(users / projects / config / history CRUD)를 Oracle·JSON 이 각각 구현. `getStore()` 가 db 설정 유무로 선택.
DB 설정이 있는데 연결이 실패하면 JSON 으로 조용히 바꾸지 않고 오류 배너(데이터가 엉뚱한 곳에 쌓이는 것 방지).

## 10. 오류 처리

- API 응답: 성공 `{ data }`, 실패 `{ error: { code, message } }` + HTTP 상태.
- 401 → 전역 세션 만료 모달. 403 → 토스트.
- 동시 수정: 과제 수정 시 `UPD_DT` 를 함께 보내고 다르면 409 "다른 사용자가 먼저 수정했습니다".
- SQL 은 모두 바인드 변수. 입력 검증은 서버에서.

## 11. 테스트 · 검증

- vitest: `fitness`(규칙 경계값, 미평가, Minor 무영향), `permissions`(역할×행위, PM 본인/상태 조건), `balance`(목표 대비 경고), `store/json`(CRUD·채번·409), `export/xlsx`(시트·행 수), `ai/prompt`(보조).
- `npx tsc --noEmit`, `npm run build` 통과.
- JSON 모드로 실행해 역할별 주요 흐름을 브라우저로 확인: 로그인 → PM 등록·제출 → AX 검토·확정 → HX 의견·동의 → 선정 → 엑셀·보고서.
- Oracle·LLM 실연동은 사내망에서 사용자가 확인.

## 12. 범위 밖

- SSO, 알림, 엑셀 업로드.
- Replay 실측 측정은 후속 문서에서 다룬다.
