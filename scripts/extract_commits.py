#!/usr/bin/env python3
"""clone 한 저장소의 git log 를 PoC 포털 업로드용 커밋 CSV 로 바꾼다. Bitbucket API 권한이 필요 없다.

커밋 메시지 규칙: "[WBS-ID] 내용"  (예: [WBS-3.2.1] 설비 이력 조회 화면 추가)

사용 예)
  py extract_commits.py --repo C:\\work\\eqp-hist --since 2026-10-01
  python3 extract_commits.py --repo ~/work/eqp-hist --branch poc/WBS-3.2.1
"""

import argparse
import csv
import io
import subprocess
import sys

FORMAT = "@%h|%ad|%an|%s"
COLUMNS = ["hash", "date", "author", "message", "added", "deleted"]


def parse_git_log(raw):
    rows, cur = [], None
    for line in raw.splitlines():
        if line.startswith("@"):
            if cur:
                rows.append(cur)
            parts = line[1:].split("|")
            # 제목에 '|' 가 들어갈 수 있으므로 앞의 세 칸만 잘라내고 나머지는 제목으로 다시 붙인다.
            cur = {"hash": parts[0], "date": parts[1] if len(parts) > 1 else "", "author": parts[2] if len(parts) > 2 else "", "message": "|".join(parts[3:]), "added": 0, "deleted": 0}
            continue
        cols = line.split("\t")
        if cur and len(cols) >= 3:
            added, deleted = cols[0], cols[1]
            cur["added"] += int(added) if added.isdigit() else 0  # 바이너리 파일은 '-'
            cur["deleted"] += int(deleted) if deleted.isdigit() else 0
    if cur:
        rows.append(cur)
    return rows


def to_csv(rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(COLUMNS)
    for r in rows:
        w.writerow([r[c] for c in COLUMNS])
    return buf.getvalue()


def main(argv=None):
    # 한국어 Windows 콘솔(cp949)에서 출력 때문에 스크립트가 죽지 않게 한다.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except AttributeError:
            pass
    ap = argparse.ArgumentParser(description="git log → 커밋 CSV")
    ap.add_argument("--repo", default=".")
    ap.add_argument("--since", help="YYYY-MM-DD")
    ap.add_argument("--branch", help="대상 브랜치 (기본: 현재 HEAD)")
    ap.add_argument("--out", default="commits.csv")
    a = ap.parse_args(argv)

    cmd = ["git", "-C", a.repo, "log", "--date=short", "--numstat", f"--pretty={FORMAT}"]
    if a.since:
        cmd.append(f"--since={a.since}")
    if a.branch:
        cmd.append(a.branch)
    try:
        raw = subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
    except FileNotFoundError:
        print("git 을 찾을 수 없습니다. Git 이 설치돼 있고 PATH 에 있는지 확인해 주세요.", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as ex:
        print(f"git log 실패: {ex.stderr.strip()}", file=sys.stderr)
        return 1

    rows = parse_git_log(raw)
    with open(a.out, "w", encoding="utf-8", newline="") as f:
        f.write(to_csv(rows))
    missing = sum(1 for r in rows if "[WBS-" not in r["message"])
    print(f"완료: {a.out} - 커밋 {len(rows)}건 (WBS-ID 없는 커밋 {missing}건)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
