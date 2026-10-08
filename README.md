# AI 활용 생산성 향상 PoC 포털

SK hynix × SK AX — Replay 테스트 대상 과제를 **Major/Minor 지표로 상·중·하 판정해 고르게 선정**하고, 선정된 과제의 **생산성(공수·비용·품질)을 측정**하는 포털입니다.

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
| `/` | 대시보드 — **후보 과제 × Major/Minor 지표 매트릭스**, 선정 현황, 균형 점검 | 전원 |
| `/projects` | 과제 포트폴리오 (필터·엑셀) | 전원 |
| `/projects/new`, `/projects/[id]/edit` | 과제 등록·편집 (기본정보 → 원 실적 → 지표) | PM, AX |
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
