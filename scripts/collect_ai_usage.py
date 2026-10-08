#!/usr/bin/env python3
"""개발자 PC 의 Claude Code / Codex 로컬 로그에서 AI 사용량을 모아 CSV 로 만든다.

출력은 일자 x 개발자 x WBS-ID x 모델 단위이며, PoC 포털 '데이터 수집 > AI 사용량'에 그대로 올린다.
표준 라이브러리만 쓴다(사내 PC 에 추가 설치 없이 실행).

사용 예)
  Windows : py collect_ai_usage.py --since 2026-10-01
  macOS   : python3 collect_ai_usage.py --since 2026-10-01 --user 사번
"""

import argparse
import csv
import getpass
import io
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

DEFAULT_WBS = r"WBS-[0-9]+(?:\.[0-9]+)*"
KST = timezone(timedelta(hours=9))
FIELDS = ["requests", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"]


def kst_date(ts):
    """ISO 타임스탬프를 KST 날짜로. 포털과 같은 일자 경계를 쓰기 위해 KST 로 고정한다."""
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).strftime("%Y-%m-%d")


def wbs_of(text, pattern):
    if not text:
        return ""
    m = re.search(pattern, text)
    return m.group(0) if m else ""


def bucket(rows, key):
    if key not in rows:
        rows[key] = {f: 0 for f in FIELDS}
    return rows[key]


def iter_jsonl(path, warnings):
    with open(path, encoding="utf-8", errors="replace") as f:
        for no, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                warnings.append(f"{path}:{no} JSON 해석 실패 — 건너뜀")


def parse_claude_line(d):
    """assistant 행이면 (message_id, timestamp, branch, model, usage) 를, 아니면 None."""
    if not isinstance(d, dict) or d.get("type") != "assistant":
        return None
    msg = d.get("message") or {}
    usage = msg.get("usage")
    if not isinstance(usage, dict):
        return None
    return msg.get("id"), d.get("timestamp"), d.get("gitBranch") or "", msg.get("model") or "unknown", usage


def collect_claude(root, since, wbs_pattern):
    rows, warnings, seen = {}, [], set()
    if not os.path.isdir(root):
        return rows, warnings
    for base, _, files in os.walk(root):
        for name in sorted(files):
            if not name.endswith(".jsonl"):
                continue
            for d in iter_jsonl(os.path.join(base, name), warnings):
                parsed = parse_claude_line(d)
                if not parsed:
                    continue
                mid, ts, branch, model, u = parsed
                # 스트리밍 중 같은 응답이 여러 줄로 기록되고, 서브에이전트 로그에도 복제되므로 message.id 로 한 번만 센다.
                if mid:
                    if mid in seen:
                        continue
                    seen.add(mid)
                day = kst_date(ts)
                if not day or (since and day < since):
                    continue
                r = bucket(rows, (day, wbs_of(branch, wbs_pattern), model))
                r["requests"] += 1
                r["input_tokens"] += int(u.get("input_tokens") or 0)
                r["output_tokens"] += int(u.get("output_tokens") or 0)
                r["cache_read_tokens"] += int(u.get("cache_read_input_tokens") or 0)
                r["cache_write_tokens"] += int(u.get("cache_creation_input_tokens") or 0)
    return rows, warnings


def _codex_totals(d):
    """token_count 이벤트의 누적값을 꺼낸다. 버전에 따라 위치가 달라 두 형태를 본다."""
    p = d.get("payload") if isinstance(d.get("payload"), dict) else d
    if p.get("type") != "token_count":
        return None
    info = p.get("info") or {}
    t = info.get("total_token_usage") or p.get("total_token_usage")
    if not isinstance(t, dict):
        return None
    return int(t.get("input_tokens") or 0), int(t.get("cached_input_tokens") or 0), int(t.get("output_tokens") or 0)


def parse_codex_file(path, since, wbs_pattern, rows, warnings):
    branch, model, prev = "", "unknown", (0, 0, 0)
    for d in iter_jsonl(path, warnings):
        if not isinstance(d, dict):
            continue
        typ = d.get("type")
        payload = d.get("payload") if isinstance(d.get("payload"), dict) else {}
        if typ == "session_meta":
            branch = ((payload.get("git") or {}).get("branch")) or branch
            continue
        if typ == "turn_context":
            model = payload.get("model") or model
            continue
        try:
            totals = _codex_totals(d)
        except (TypeError, ValueError):
            warnings.append(f"{path} token_count 형식 오류 — 건너뜀")
            continue
        if not totals:
            continue
        inp, cached, out = totals
        if inp < prev[0] or out < prev[2]:
            prev = (0, 0, 0)  # 누적값이 줄면 새 세션으로 초기화된 것
        d_in, d_cached, d_out = inp - prev[0], cached - prev[1], out - prev[2]
        prev = (inp, cached, out)
        if d_in == 0 and d_out == 0:
            continue
        day = kst_date(d.get("timestamp"))
        if not day or (since and day < since):
            continue
        r = bucket(rows, (day, wbs_of(branch, wbs_pattern), model))
        r["requests"] += 1
        r["input_tokens"] += max(d_in - d_cached, 0)
        r["cache_read_tokens"] += max(d_cached, 0)
        r["output_tokens"] += d_out


def collect_codex(root, since, wbs_pattern):
    rows, warnings = {}, []
    if not os.path.isdir(root):
        return rows, warnings
    for base, _, files in os.walk(root):
        for name in sorted(files):
            if name.startswith("rollout-") and name.endswith(".jsonl"):
                try:
                    parse_codex_file(os.path.join(base, name), since, wbs_pattern, rows, warnings)
                except OSError as ex:
                    warnings.append(f"{name} 읽기 실패: {ex}")
    return rows, warnings


def to_csv(rows, user, source):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["date", "user", "wbs_id", "model"] + FIELDS + ["source"])
    for (day, wbs, model) in sorted(rows):
        r = rows[(day, wbs, model)]
        w.writerow([day, user, wbs, model] + [r[f] for f in FIELDS] + [source])
    return buf.getvalue()


def main(argv=None):
    # 한국어 Windows 콘솔(cp949)에서 출력 때문에 스크립트가 죽지 않게 한다.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except AttributeError:
            pass
    home = os.path.expanduser("~")
    ap = argparse.ArgumentParser(description="Claude Code / Codex 로컬 로그 → AI 사용량 CSV")
    ap.add_argument("--claude-dir", default=os.path.join(home, ".claude", "projects"))
    ap.add_argument("--codex-dir", default=os.path.join(home, ".codex", "sessions"))
    ap.add_argument("--since", help="YYYY-MM-DD 이후만 (포함)")
    ap.add_argument("--user", default=getpass.getuser(), help="포털 로그인 ID(사번). 기본값은 OS 사용자명")
    ap.add_argument("--wbs-pattern", default=DEFAULT_WBS)
    ap.add_argument("--out", help="출력 파일 (기본: ai_usage_<user>_<오늘>.csv)")
    a = ap.parse_args(argv)

    claude, w1 = collect_claude(a.claude_dir, a.since, a.wbs_pattern)
    codex, w2 = collect_codex(a.codex_dir, a.since, a.wbs_pattern)
    text = to_csv(claude, a.user, "claude") + to_csv(codex, a.user, "codex").split("\n", 1)[1]
    out = a.out or f"ai_usage_{a.user}_{datetime.now(KST).strftime('%Y%m%d')}.csv"
    with open(out, "w", encoding="utf-8", newline="") as f:
        f.write(text)

    for msg in (w1 + w2)[:20]:
        print("경고:", msg, file=sys.stderr)
    if len(w1 + w2) > 20:
        print(f"경고: 외 {len(w1 + w2) - 20}건", file=sys.stderr)
    no_wbs = sum(1 for k in list(claude) + list(codex) if not k[1])
    print(f"완료: {out} - Claude {len(claude)}행, Codex {len(codex)}행 (WBS 미상 {no_wbs}행)")
    print("로컬 로그는 기본 30일 후 삭제됩니다. 주 1회 이상 포털에 올려 주세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
