# AI 활용 생산성 향상 PoC 포털

SK hynix × SK AX — 선정된 과제의 요구사항을 **SDLC 단계별 기준 공수**와 **실제 투입 공수**(AI 도구 내 + AI 도구 외)로 비교하는 포털입니다.
과제 선정은 포털 밖에서 끝나고, 관리자가 선정 결과(엑셀 양식)를 올립니다.

## 바로 실행

### 외부망 / 로컬 시연 (DB 없이)

```bash
npm install
npm run local        # 빌드 후 실행 — http://localhost:5176 (사내 공유: http://<내 IP>:5176)
```

- **사내 PC 시연은 `npm run local` 을 쓰세요.** (dev 서버와 동시에 빌드하면 `.next` 를 서로 덮어씁니다. 함께 띄워야 하면 `NEXT_DIST_DIR=.next-local npm run local`) `npm run dev` 는 화면을 처음 열 때마다 컴파일해서 백신이 도는 PC 에서 수 초~수십 초씩 걸립니다. 코드를 고칠 때만 `npm run dev`.
- `config.yml` 이 없으면 `data/` 폴더의 JSON 파일에 저장하고, 샘플 과제 6건·요구사항 21건·최근 10일 공수·데모 계정이 들어갑니다. 로그인 화면 아래 데모 계정을 누르면 입력됩니다.

| ID | 역할 | 비밀번호 |
|---|---|---|
| admin | 관리자 | admin123! |
| dev01 ~ dev06 | 개발자 (김개발·박개발·최개발·이개발·정개발·한개발) | demo1234! |
| view01 | 열람자 (SK hynix) | demo1234! |

데모 데이터를 처음 상태로 되돌리려면 서버를 끄고 `data/` 폴더를 지운 뒤 다시 실행합니다.

### 사내망 (Oracle)

```bash
cp config.example.yml config.yml   # db 3개 값 입력
npm install
npm run local
```

- 접속 계정에 `POC_` 테이블이 없으면 **처음 연결할 때 자동으로 생성**합니다. DBA 가 직접 만들어야 하면 `sql/create_tables.sql` 을 실행하세요.
- 2026-10-15 개편으로 `POC_PRJ_MAS`·`POC_MEAS_DAT` 구조가 바뀌었습니다. 이전 버전 테이블이 있으면 지우고 다시 만드세요(파일 끝 ROLLBACK 주석).
- 계정 테이블이 비어 있으면 `admin` / `admin123!` 1건을 만듭니다. 데모 계정·샘플 과제는 Oracle 에는 들어가지 않습니다.
- 운영에서는 `config.yml` 의 `auth.secret`(또는 환경변수 `AUTH_SECRET`)을 꼭 넣으세요. HTTPS 면 `AUTH_COOKIE_SECURE=true`.

## 화면

| 경로 | 화면 | 사용 |
|---|---|---|
| `/selection` | **과제 선정 현황** — 선정 과제·요구사항이 성격(기대효과·난이도·등급·배포 형식·과제 영역 등)별로 어떻게 퍼졌는지, 쏠림·공백 균형 점검, 기대효과 × 성격 매트릭스, 과제별 분포, 요구사항 × 지표 표 | 전원 |
| `/` | **과제 현황** — 건수 요약 + 과제별 요구사항 표(난이도·등급, 단계·담당, 투입/기준 M/D, 상태). 요구사항을 누르면 상세(관리자는 단계·담당 편집). 관리자: 엑셀 올리기·양식 내려받기 | 전원 (개발자는 내 담당만) |
| `/effort` | **공수 입력** — 날짜를 고르면 그날 내 담당 단계를 과제별로. 자동 수집된 AI 사용 시간 확인(줄이기만 가능) + AI 없이 한 일(작업 유형 8개) 입력 → **이 날 확정**. 아래에 내 담당 과제·요구사항 진척 | 개발자 입력, 관리자·열람자는 개발자를 골라 조회 |
| `/dashboard` | **측정 결과** — 절감률·순절감률·AI 활용률 + 과제별(펼치면 요구사항)/단계별/요구사항별 표 + **과제 성격별 결과**(성격에 따라 절감률이 갈린 축) | 전원 |
| `/dashboard/basis` | **산출 근거** — 계산식에 실제 숫자 대입, 적용 설정값, 집계에서 빠진 값, 단계 × 일자 원장(AI 세션 출처·배정 근거까지), CSV | 전원 |
| `/monitor` | **공수 모니터링** — 같은 시간 반복·몰아서 확정·하루 과다·AI 시간 크게 줄임 등 자동 감지 + 확인 기록(누구에게 어떻게 확인했는지, 고칠 수 없는 증적) + 감독 일지 | 관리자 |
| `/guide` | **작성 가이드** — 하루 입력 순서, 작성 팁, 수집 설정, 계산 방법, FAQ | 전원 |
| `/admin` | **시스템 관리** — 확정 현황 · 수집 현황 · 계정 · 코드·단가 · 변경 이력 | 관리자 |

## 엑셀 양식 → 포털

`templates/project_template.xlsx` (화면의 '양식 내려받기')의 **과제·요구사항** 시트를 읽습니다.

- 한 행 = 요구사항 1건. 같은 과제명(PRJ-01)은 같은 과제로 묶습니다.
- **REQ-03 대표 업무 유형**(예: `개발 · UI 개발`)이 첫 SDLC 단계, **REQ-06**이 그 단계의 기준 M/D, **REF-01** 첫 사람이 담당이 됩니다. 담당 이름은 계정 이름과 같아야 연결됩니다.
- 단계 추가·나누기(설계·테스트 등)는 과제 현황의 요구사항 **편집**에서 합니다. 다시 올려도 화면에서 나눈 단계는 유지됩니다.
- 오류 행이 하나라도 있으면 아무것도 저장하지 않고 행 번호와 이유를 보여 줍니다.

## AI 사용 시간 수집

AI 도구 내 시간은 두 경로로 들어오고, 세션의 **브랜치명·대화에 단계 코드**(예: `REQ-0047-DV`, 투입 공수 화면에서 복사)가 있으면 자동으로 그 단계에 붙습니다. 하나로 정하지 못한 시간은 '확인 필요'에서 개발자가 배정합니다. 대화 원문은 저장하지 않습니다.

### 1) 텔레메트리 (권장)

`config.yml` 에 `collect.token` 을 넣고, 개발자 PC 의 Claude Code 환경변수를 설정합니다.

```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_ENDPOINT=http://<포털 주소>:5176/api/otel
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <collect.token>
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta   # 누적값이면 중복 합산됨
OTEL_RESOURCE_ATTRIBUTES=poc.user=<포털 로그인 ID>
OTEL_LOG_USER_PROMPTS=1   # 프롬프트에서 단계 코드를 찾기 위해. 포털은 코드만 남기고 원문은 버림
```

`claude_code.active_time` 을 세션·일자별로 더합니다. 수신 상태는 시스템 관리 > 수집 현황.

### 2) 로컬 로그 업로드

텔레메트리를 못 쓰는 PC 는 `scripts/collect_ai_usage.py`(투입 공수 > AI 사용 기록 올리기에서 내려받기)로 Claude Code·Codex 로컬 로그에서 세션 시간을 뽑아 JSON 으로 올립니다. 같은 파일을 다시 올려도 중복되지 않고, 이미 배정한 결과는 유지됩니다. 자세한 옵션은 `scripts/README.md`.

## 지표 (모두 확정된 날만)

- AI 도구 내 = 수집 − 감소 · 투입 = AI 도구 내 + AI 도구 외 · M/D = 투입 h ÷ 1 M/D 시간(기본 8)
- 투입 공수 절감률 = (기준 − 투입) ÷ 기준 M/D
- 순절감률 = (기준 인건비 − 측정 인건비 − AI 비용) ÷ 기준 인건비 · 인건비 = M/D × 등급 단가 · AI 비용 = 수집 시간 × 도구별 시간당 비용
- AI 활용률 = AI 도구 내 ÷ 투입
- 확정 뒤 수집값이 늦게 들어와 값이 달라지면 '재확정 필요'가 되고 다시 확정할 때까지 집계에서 빠집니다.

## 개발

```bash
npm test                                   # vitest
python -m unittest discover -s scripts/tests
npm run typecheck
npm run build
```

설계: `docs/superpowers/specs/2026-10-15-effort-portal-revamp-design.md`
