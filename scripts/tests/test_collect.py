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


def claude(typ, ts, sid="s1", branch="feature/REQ-0047", text=None):
    d = {"type": typ, "timestamp": ts, "sessionId": sid, "gitBranch": branch}
    if typ == "user":
        d["message"] = {"role": "user", "content": text or ""}
    return d


class ClaudeTest(unittest.TestCase):
    def test_active_minutes_skip_idle_and_collect_hints_without_text(self):
        with tempfile.TemporaryDirectory() as d:
            write(
                os.path.join(d, "claude", "proj", "s1.jsonl"),
                [
                    claude("user", "2026-11-10T01:00:00Z", text="REQ-0047-DV 수신 로직 고쳐줘 비밀"),
                    claude("assistant", "2026-11-10T01:04:00Z"),
                    claude("user", "2026-11-10T01:06:00Z", text=[{"type": "text", "text": "계속"}]),
                    # 1시간 공백 — 자리 비움이라 5분만 센다
                    claude("assistant", "2026-11-10T02:06:00Z"),
                    "{broken",
                ],
            )
            data, warnings = c.build(os.path.join(d, "claude"), os.path.join(d, "none"), None)
            self.assertEqual(len(warnings), 1)
            self.assertEqual(data["format"], "poc-ai-sessions")
            [r] = data["sessions"]
            self.assertEqual(r["activeMin"], 4 + 2 + 5)
            self.assertEqual((r["date"], r["start"], r["end"]), ("2026-11-10", "10:00", "11:06"))
            self.assertEqual(r["hints"], ["REQ-0047", "REQ-0047-DV"])
            self.assertNotIn("비밀", json.dumps(data, ensure_ascii=False))

    def test_splits_by_kst_day_and_since(self):
        with tempfile.TemporaryDirectory() as d:
            write(
                os.path.join(d, "claude", "p", "s.jsonl"),
                [
                    claude("user", "2026-11-09T14:50:00Z"),  # 23:50 KST
                    claude("assistant", "2026-11-09T14:55:00Z"),
                    claude("user", "2026-11-09T15:00:00Z"),  # 00:00 KST 다음날
                    claude("assistant", "2026-11-09T15:03:00Z"),
                ],
            )
            data, _ = c.build(os.path.join(d, "claude"), "", None)
            self.assertEqual([(r["date"], r["activeMin"]) for r in data["sessions"]], [("2026-11-09", 5), ("2026-11-10", 3)])
            data, _ = c.build(os.path.join(d, "claude"), "", "2026-11-10")
            self.assertEqual([r["date"] for r in data["sessions"]], ["2026-11-10"])


class CodexTest(unittest.TestCase):
    def test_session_meta_branch_and_user_message(self):
        with tempfile.TemporaryDirectory() as d:
            write(
                os.path.join(d, "codex", "2026", "11", "10", "rollout-abc.jsonl"),
                [
                    {"type": "session_meta", "timestamp": "2026-11-10T00:00:00Z", "payload": {"id": "cx-1", "git": {"branch": "main"}}},
                    {"type": "response_item", "timestamp": "2026-11-10T00:01:00Z", "payload": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "MES-12 작업"}]}},
                    {"type": "event_msg", "timestamp": "2026-11-10T00:03:00Z", "payload": {"type": "user_message", "message": "REQ-0051-DS 도"}},
                ],
            )
            data, _ = c.build("", os.path.join(d, "codex"), None)
            [r] = data["sessions"]
            self.assertEqual((r["tool"], r["sessionId"], r["branch"], r["activeMin"]), ("Codex", "cx-1", "main", 3))
            self.assertEqual(r["hints"], ["MES-12", "REQ-0051-DS", "REQ-0051"])


class MainTest(unittest.TestCase):
    def test_writes_file(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "o.json")
            self.assertEqual(c.main(["--claude-dir", d, "--codex-dir", d, "--out", out]), 0)
            with open(out, encoding="utf-8") as f:
                self.assertEqual(json.load(f)["sessions"], [])


if __name__ == "__main__":
    unittest.main()
