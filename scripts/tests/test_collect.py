import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import collect_ai_usage as c  # noqa: E402


def write(path, lines):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for line in lines:
            f.write(line if isinstance(line, str) else json.dumps(line, ensure_ascii=False))
            f.write("\n")


def ev(ts, payload, typ="event_msg"):
    return {"type": typ, "timestamp": ts, "payload": payload}


def tokens(ts, inp, cached, out):
    return ev(ts, {"type": "token_count", "info": {"total_token_usage": {"input_tokens": inp, "cached_input_tokens": cached, "output_tokens": out}}})


class HintTest(unittest.TestCase):
    def test_same_rule_as_portal(self):
        out = []
        c.hints_of("feature/dae01-req0047-dv 작업", out)
        self.assertEqual(out, ["DAE01-REQ0047-DV", "DAE01-REQ0047", "REQ0047-DV", "DAE01", "REQ0047"])
        out = []
        c.hints_of("please fix the bug", out)
        self.assertEqual(out, [])

    def test_poc_off(self):
        out = []
        c.hints_of("POC off 개인 공부", out)
        self.assertEqual(out, ["POC-OFF"])


class CodexTest(unittest.TestCase):
    def test_active_minutes_tokens_branch_and_no_text(self):
        with tempfile.TemporaryDirectory() as d:
            write(
                os.path.join(d, "2026", "11", "10", "rollout-abc.jsonl"),
                [
                    ev("2026-11-10T00:00:00Z", {"id": "cx-1", "git": {"branch": "feature/DAE01-REQ0047-DV"}}, "session_meta"),
                    ev("2026-11-10T00:00:30Z", {"model": "gpt-5-codex"}, "turn_context"),
                    ev("2026-11-10T00:01:00Z", {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "OAR03-REQ0001 비밀 작업"}]}, "response_item"),
                    tokens("2026-11-10T00:02:00Z", 1000, 200, 100),
                    # 같은 누적값 반복 — 두 번 더하지 않는다
                    tokens("2026-11-10T00:02:30Z", 1000, 200, 100),
                    tokens("2026-11-10T00:03:00Z", 1500, 300, 150),
                    # 1시간 공백 — 자리 비움이라 5분만 센다
                    ev("2026-11-10T01:03:00Z", {"type": "user_message", "message": "계속"}),
                    "{broken",
                ],
            )
            data, warnings = c.build(d, None)
            self.assertEqual(len(warnings), 1)
            self.assertEqual(data["format"], "poc-ai-sessions")
            [r] = data["sessions"]
            self.assertEqual((r["tool"], r["sessionId"], r["activeMin"]), ("Codex", "cx-1", 3 + 5))
            self.assertEqual((r["date"], r["start"], r["end"]), ("2026-11-10", "09:00", "10:03"))
            self.assertEqual(r["tokens"], {"gpt-5-codex": {"input": 1500, "cached": 300, "output": 150}})
            self.assertIn("DAE01-REQ0047-DV", r["hints"])
            self.assertIn("OAR03-REQ0001", r["hints"])
            self.assertNotIn("비밀", json.dumps(data, ensure_ascii=False))

    def test_splits_by_kst_day_and_since(self):
        with tempfile.TemporaryDirectory() as d:
            write(
                os.path.join(d, "rollout-s.jsonl"),
                [
                    ev("2026-11-09T14:50:00Z", {"type": "user_message", "message": ""}),  # 23:50 KST
                    ev("2026-11-09T14:55:00Z", {"type": "agent_message"}),
                    ev("2026-11-09T15:00:00Z", {"type": "user_message", "message": ""}),  # 00:00 KST 다음날
                    ev("2026-11-09T15:03:00Z", {"type": "agent_message"}),
                ],
            )
            data, _ = c.build(d, None)
            self.assertEqual([(r["date"], r["activeMin"]) for r in data["sessions"]], [("2026-11-09", 5), ("2026-11-10", 3)])
            data, _ = c.build(d, "2026-11-10")
            self.assertEqual([r["date"] for r in data["sessions"]], ["2026-11-10"])


class MainTest(unittest.TestCase):
    def test_writes_file(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "o.json")
            self.assertEqual(c.main(["--codex-dir", d, "--out", out]), 0)
            with open(out, encoding="utf-8") as f:
                self.assertEqual(json.load(f)["sessions"], [])


if __name__ == "__main__":
    unittest.main()
