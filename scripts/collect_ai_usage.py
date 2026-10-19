#!/usr/bin/env python3
"""개발자 PC 의 Codex 로컬 로그에서 AI 사용 시간·토큰을 세션 단위로 뽑아 JSON 으로 만든다.

텔레메트리(OTLP)가 연결되지 않은 PC 에서 쓴다. 결과 파일은 포털 '공수 입력 > AI 사용 기록 올리기'로 올린다.
대화 원문은 담지 않는다 — 브랜치명·대화에서 찾은 공수 태그 후보(예: DAE01-REQ0047-DV)만 남긴다.
표준 라이브러리만 쓴다(사내 PC 에 추가 설치 없이 실행).

사용 예)
  Windows : py collect_ai_usage.py --since 2026-11-01
  macOS   : python3 collect_ai_usage.py --since 2026-11-01
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
# 이 간격보다 오래 아무 기록이 없으면 자리를 비운 것으로 보고 시간에 넣지 않는다. 포털 텔레메트리 수신과 같은 값.
IDLE_GAP_SEC = 5 * 60
WORD_RE = re.compile(r"[A-Z0-9_]+(?:-[A-Z0-9_]+)*")
MAX_HINTS = 20
MAX_SEGS = 6
OFF_RE = re.compile(r"\bpoc[\s:_-]*off\b", re.IGNORECASE)
OFF_HINT = "POC-OFF"


def parse_ts(ts):
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST)


def hints_of(text, out):
    """코드처럼 생긴 토큰만 모은다(포털 match.ts extractHints 와 같은 규칙). 포털이 현재 공수 태그와 다시 맞춰 본다.

    태그 형식을 가정하지 않고, 하이픈으로 이어진 토큰의 연속 부분 중 숫자가 든 것을 모두 후보로 낸다.
    """
    # 세션 첫 줄의 `poc off`(업무 외 사용)는 숫자가 없어 아래 규칙에 안 걸리므로 따로 남긴다. 포털 OFF_HINT 와 같은 값.
    if OFF_RE.search(text or "") and OFF_HINT not in out:
        out.append(OFF_HINT)
    words = WORD_RE.findall((text or "").upper())
    joined = [w for w in words if "-" in w] + [w for w in words if "-" not in w and re.search(r"[A-Z]", w) and re.search(r"\d", w) and len(w) >= 4]
    for w in joined:
        segs = w.split("-")[:MAX_SEGS]
        for n in range(len(segs), 0, -1):
            for i in range(0, len(segs) - n + 1):
                h = "-".join(segs[i : i + n])
                if not re.search(r"\d", h) or h in out:
                    continue
                out.append(h)
                if len(out) >= MAX_HINTS:
                    return


class Session:
    def __init__(self, sid):
        self.sid = sid
        self.times = []
        self.branch = ""
        self.texts = []
        # 일자 → 모델 → {input, cached, output}
        self.tokens = {}

    def add(self, dt):
        if dt:
            self.times.append(dt)

    def add_tokens(self, dt, model, use):
        if not dt:
            return
        day = self.tokens.setdefault(dt.strftime("%Y-%m-%d"), {})
        cur = day.setdefault(model or "unknown", {"input": 0, "cached": 0, "output": 0})
        for k in cur:
            cur[k] += use[k]


def split_by_day(sess, since):
    """세션을 KST 일자별로 나눠 활동 시간(분)을 계산한다. 자정을 넘긴 세션은 날마다 따로 센다."""
    days = {}
    for t in sorted(sess.times):
        days.setdefault(t.strftime("%Y-%m-%d"), []).append(t)
    hints = []
    hints_of(sess.branch, hints)
    for text in sess.texts:
        hints_of(text, hints)
    out = []
    for day, ts in sorted(days.items()):
        if since and day < since:
            continue
        active = sum(min((b - a).total_seconds(), IDLE_GAP_SEC) for a, b in zip(ts, ts[1:]))
        minutes = round(active / 60)
        if minutes <= 0:
            continue
        row = {
            "tool": "Codex",
            "sessionId": sess.sid,
            "date": day,
            "start": ts[0].strftime("%H:%M"),
            "end": ts[-1].strftime("%H:%M"),
            "activeMin": minutes,
            "branch": sess.branch,
            "hints": hints,
        }
        if sess.tokens.get(day):
            row["tokens"] = sess.tokens[day]
        out.append(row)
    return out


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


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") in ("text", "input_text"))
    return ""


def usage_of(u):
    u = u if isinstance(u, dict) else {}
    return {"input": int(u.get("input_tokens") or 0), "cached": int(u.get("cached_input_tokens") or 0), "output": int(u.get("output_tokens") or 0)}


def collect_codex(root, warnings):
    out = []
    if not os.path.isdir(root):
        return out
    for base, _, files in os.walk(root):
        for name in sorted(files):
            if not (name.startswith("rollout-") and name.endswith(".jsonl")):
                continue
            s = Session(name[:-6])
            model = ""
            # token_count 이벤트가 같은 값으로 반복될 수 있어 누적값(total)의 증가분만 더한다.
            prev_total = {"input": 0, "cached": 0, "output": 0}
            try:
                for d in iter_jsonl(os.path.join(base, name), warnings):
                    if not isinstance(d, dict):
                        continue
                    p = d.get("payload") if isinstance(d.get("payload"), dict) else {}
                    dt = parse_ts(d.get("timestamp"))
                    s.add(dt)
                    if d.get("type") == "session_meta":
                        s.sid = p.get("id") or s.sid
                        s.branch = (p.get("git") or {}).get("branch") or s.branch
                    elif d.get("type") == "turn_context":
                        model = p.get("model") or model
                    elif p.get("type") == "message" and p.get("role") == "user":
                        s.texts.append(text_of(p.get("content")))
                    elif p.get("type") == "user_message":
                        s.texts.append(str(p.get("message") or ""))
                    elif p.get("type") == "token_count" and isinstance(p.get("info"), dict):
                        total = usage_of(p["info"].get("total_token_usage"))
                        delta = {k: max(0, total[k] - prev_total[k]) for k in total}
                        if any(delta.values()):
                            s.add_tokens(dt, model, delta)
                        prev_total = {k: max(total[k], prev_total[k]) for k in total}
            except OSError as ex:
                warnings.append(f"{name} 읽기 실패: {ex}")
                continue
            out.append(s)
    return out


def build(codex_dir, since):
    warnings = []
    rows = [r for s in collect_codex(codex_dir, warnings) for r in split_by_day(s, since)]
    return {"format": "poc-ai-sessions", "version": 2, "generatedAt": datetime.now(KST).isoformat(timespec="seconds"), "sessions": rows}, warnings


def main(argv=None):
    # 한국어 Windows 콘솔(cp949)에서 출력 때문에 스크립트가 죽지 않게 한다.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except AttributeError:
            pass
    home = os.path.expanduser("~")
    ap = argparse.ArgumentParser(description="Codex 로컬 로그 → AI 사용 세션 JSON")
    ap.add_argument("--codex-dir", default=os.path.join(os.environ.get("CODEX_HOME") or os.path.join(home, ".codex"), "sessions"))
    ap.add_argument("--since", help="YYYY-MM-DD 이후만 (포함)")
    ap.add_argument("--out", help="출력 파일 (기본: ai_sessions_<오늘>.json)")
    a = ap.parse_args(argv)

    data, warnings = build(a.codex_dir, a.since)
    out = a.out or f"ai_sessions_{datetime.now(KST).strftime('%Y%m%d')}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    for msg in warnings[:20]:
        print("경고:", msg, file=sys.stderr)
    if len(warnings) > 20:
        print(f"경고: 외 {len(warnings) - 20}건", file=sys.stderr)
    rows = data["sessions"]
    no_hint = sum(1 for r in rows if not r["hints"])
    print(f"완료: {out} - 세션·일자 {len(rows)}건, {sum(r['activeMin'] for r in rows)}분 (공수 태그 없음 {no_hint}건)")
    print("태그가 없는 시간은 포털 '확인 필요'에서 배정합니다. 주 1회 이상 올려 주세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
