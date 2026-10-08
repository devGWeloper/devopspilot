# 측정 데이터 수집 스크립트

Python 3.8 이상, 표준 라이브러리만 사용합니다(추가 설치 없음). 결과 CSV 는 포털 **데이터 수집** 화면에서 올립니다.

## AI 사용량 — `collect_ai_usage.py`

개발자 PC 의 Claude Code(`~/.claude/projects/**/*.jsonl`)와 Codex(`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`) 로그를 읽어
**일자 × 개발자 × WBS-ID × 모델** 단위 CSV 를 만듭니다.

```bash
# Windows
py collect_ai_usage.py --since 2026-10-01 --user <포털 ID>
# macOS / Linux
python3 collect_ai_usage.py --since 2026-10-01 --user <포털 ID>
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--since` | 전체 | 이 날짜(포함) 이후만 |
| `--user` | OS 사용자명 | 포털 로그인 ID 로 지정하세요 |
| `--wbs-pattern` | `WBS-[0-9]+(?:\.[0-9]+)*` | 브랜치명에서 WBS-ID 를 찾는 정규식 |
| `--claude-dir`, `--codex-dir` | 홈 폴더 기본 위치 | 로그 위치가 다를 때 |
| `--out` | `ai_usage_<user>_<날짜>.csv` | 출력 파일 |

- WBS-ID 는 **작업 브랜치명**에서 뽑습니다(예: `poc/WBS-3.2.1`). 브랜치에 WBS-ID 가 없으면 'WBS 미상'으로 집계됩니다.
- Claude Code 는 같은 응답이 여러 줄로 기록되므로 `message.id` 기준으로 한 번만 셉니다.
- Codex 의 `token_count` 는 누적값이라 직전 값과의 차이로 계산합니다.
- 해석할 수 없는 줄은 건너뛰고 경고만 출력합니다.
- **로컬 로그는 기본 30일 후 삭제됩니다. 주 1회 이상 올려 주세요.**
- 같은 일자·개발자·WBS-ID·모델을 다시 올리면 덮어씁니다(중복 집계되지 않음).

## 커밋 — `extract_commits.py`

clone 한 저장소에서 `git log --date=short --numstat --pretty="@%h|%ad|%an|%s"` 를 실행해 CSV 로 바꿉니다. Bitbucket API 권한이 필요 없습니다.

```bash
py extract_commits.py --repo C:\work\eqp-hist --since 2026-10-01
python3 extract_commits.py --repo ~/work/eqp-hist --branch poc/WBS-3.2.1 --out commits.csv
```

- 커밋 메시지 규칙: `[WBS-ID] 내용` (예: `[WBS-3.2.1] 설비 이력 조회 화면 추가`)
- WBS-ID 가 없는 커밋은 포털에서 '규칙 위반'으로 따로 집계됩니다.
- 스크립트 없이 위 `git log` 원문을 텍스트 파일로 저장해 올려도 됩니다.

## 테스트

```bash
python -m unittest discover -s scripts/tests
```
