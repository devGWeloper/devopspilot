# AI 활용 생산성 향상 PoC 포털

SK hynix × SK AX — Replay 테스트 대상 과제를 **과제 선정 양식 항목으로 받아 상·중·하로 판정해 고르게 선정**하고, 선정된 과제의 **생산성(공수·비용·품질)을 측정**하는 포털입니다.

## 바로 실행

### 외부망 / 로컬 시연 (DB 없이)

```bash
npm install
npm run dev          # http://localhost:3000
```

`config.yml` 이 없으면 `data/` 폴더의 JSON 파일에 저장하고, 샘플 과제 12건·측정 데이터·데모 계정이 자동으로 들어갑니다.
로그인 화면 아래 데모 계정을 누르면 입력됩니다.

| ID | 역할 | 비밀번호 |
|---|---|---|
| admin | AX 관리자 | admin123! |
| hx01 | HX 검토자 (SK hynix) | demo1234! |
| pm01, pm02 | 과제 PM | demo1234! |
| dev01, dev02 | 개발자 | demo1234! |
| qa01 | 테스트 수행자 | demo1234! |
| view01 | 열람자 | demo1234! |

데모 데이터를 처음 상태로 되돌리려면 서버를 끄고 `data/` 폴더를 지운 뒤 다시 실행합니다.

### 사내망 (Oracle)

```bash
cp config.example.yml config.yml   # db 3개 값 입력
npm install
npm run dev                        # 또는 npm run build && npm start
```

- 접속 계정에 `POC_` 테이블이 없으면 **처음 연결할 때 자동으로 생성**합니다. DBA 가 직접 만들어야 하면 `sql/create_tables.sql` 을 실행하세요.
- 계정 테이블이 비어 있으면 `admin` / `admin123!` (AX 관리자) 1건을 만듭니다. 데모 계정·샘플 과제는 Oracle 에는 들어가지 않습니다.
- 운영에서는 `config.yml` 의 `auth.secret`(또는 환경변수 `AUTH_SECRET`)을 꼭 넣으세요. HTTPS 면 `AUTH_COOKIE_SECURE=true`.
- `config.yml` 은 git 에 올라가지 않습니다.

### AI 적합도 의견 (보조 기능)

`config.yml` 의 `llm.enabled: true` 와 사내 OpenAI 호환 엔드포인트(`baseUrl`, `apiKey`, `model`)를 넣으면 **관리 > AI 판정** 메뉴가 나타납니다.
컨설턴트가 그 화면에서 판정 기준 프롬프트를 작성하고, 과제별 의견을 받아 참고합니다(자동 확정 없음). `false` 면 메뉴·API 가 모두 숨겨집니다.

## 화면

| 경로 | 화면 | 주 사용자 |
|---|---|---|
| `/` | 대시보드 — **후보 과제 × 지표 값 매트릭스**, 분류 축별 후보 대비 선정 분포, 선정 과제 구성표, 균형 점검 | 전원 |
| `/entry` | **과제 기입** — 기입할 과제(작성중·보완요청)와 제출한 과제, 단계별 남은 필수 항목 | PM, AX |
| `/entry/new`, `/entry/[id]` | 과제 기입 폼 — 과제 선정 양식(엑셀)과 같은 항목·ID: ① 과제 → 원 프로젝트 실적 → ③ AI 적용 계획 → ④ AI 적합도 → ⑤ 참여 인력. 양식의 ② 요구사항은 과제 기준 선정이라 받지 않음 | PM, AX |
| `/projects` | 과제 포트폴리오 (필터·엑셀) | 전원 |
| `/projects/[id]` | 과제 상세 (판정 근거·검토 합의·측정·이력) | 전원 |
| `/selection` | 선정 보드 (칸반 + 균형 체크) | AX, 열람 |
| `/report` | 선정 보고서 (인쇄·PDF) | 전원 |
| `/measure` | 생산성 측정 대시보드 (지표 9개) | 전원 |
| `/today` | 오늘 공수 입력 | 개발자 |
| `/defects` | 결함 관리 (수기·Jira CSV) | 테스트 수행자 |
| `/collect` | 데이터 수집 (AI 사용량·커밋 업로드, 스크립트) | PM, 개발자, AX |
| `/check` | 데이터 점검 (교차 검증·미입력·규칙 위반) | PM, AX |
| `/admin/criteria` | 평가 기준 — Major/Minor 분류, 판정 규칙, 게시·재판정 | AX |
| `/admin/codes` | 코드·선정 목표 | AX |
| `/admin/measure` | 측정 설정 (단가·판정 기간·유형) | AX |
| `/admin/users`, `/admin/history` | 계정, 변경 이력 | AX |
| `/admin/ai` | AI 적합도 의견 (보조) | AX |

## 측정 데이터 수집 스크립트

`scripts/README.md` 참고. 포털 **데이터 수집 > 스크립트·사용법** 탭에서도 내려받을 수 있습니다.

## 개발

```bash
npm test                                   # vitest
python -m unittest discover -s scripts/tests
npm run typecheck
npm run build
```

설계: `docs/superpowers/specs/` · 구현 계획: `docs/superpowers/plans/`

## 과제 선정 양식과의 대응

- 항목 정의는 `src/lib/projects/fields.ts`(과제 항목), `src/lib/criteria/defaults.ts`(지표·코드값)에 양식 ID(PRJ-·AIS-·FIT-·REF-)와 함께 있다.
- 양식에는 Major/Minor 구분이 없어 포털에서 정했다.
  - **Major**: FIT-01 명세 명확성 · FIT-02 맥락 주입 가능성 · FIT-03 생성 패턴. 가장 낮은 항목이 참고 등급(FIT-05)을 정한다.
  - **Minor** (보완 신호, 등급 불변): PRJ-09 기존 WBS 실적 · PRJ-10 버전관리 도구 · PRJ-11 작업관리 도구 · REF-02 AI 활용 개발 경험 · REF-03 AI 인증 등급.
  - **분류 코드**: 담당 · 시스템 등급 · 배포 형식 · 과제 영역 · LLM 구분 · AI 도구 · 요금제 · 예상 토큰량 (관리 > 코드·목표).
- 적합도는 과제마다 하나: 참고 등급(자동) → PM 예상 기대효과(FIT-06) → AX 확정.
- 포털 추가 항목: 주 개발 언어, 기술 스택, 과제 설명, 원 프로젝트 실적(Replay 기준선).
- 양식 도입 전에 저장된 데이터: 코드 설정은 선정 목표만 유지하고 양식 코드로 바뀐다. 게시된 평가 기준은 자동으로 바꾸지 않으므로, 기존 DB 는 평가 기준 화면에서 새 기준을 게시하거나 로컬 `data/` 를 지우고 다시 시드한다.

