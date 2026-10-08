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
            f.write(line if isinstance(line, str) else json.dumps(line))
            f.write("\n")


def assistant(mid, ts, branch, model, inp, out, cr, cw):
    return {
        "type": "assistant",
        "timestamp": ts,
        "gitBranch": branch,
        "message": {
            "id": mid,
            "model": model,
            "usage": {"input_tokens": inp, "output_tokens": out, "cache_read_input_tokens": cr, "cache_creation_input_tokens": cw},
        },
    }


class ClaudeTest(unittest.TestCase):
    def test_dedupes_message_id_and_groups_by_day_branch_model(self):
        with tempfile.TemporaryDirectory() as d:
            write(
                os.path.join(d, "proj", "s1.jsonl"),
                [
                    {"type": "user", "timestamp": "2026-10-07T01:00:00Z"},
                    assistant("m1", "2026-10-07T01:00:00Z", "poc/WBS-3.2.1", "claude-sonnet-4-5", 10, 20, 30, 40),
                    assistant("m1", "2026-10-07T01:00:01Z", "poc/WBS-3.2.1", "claude-sonnet-4-5", 10, 20, 30, 40),
                    assistant("m2", "2026-10-07T02:00:00Z", "poc/WBS-3.2.1", "claude-sonnet-4-5", 1, 2, 3, 4),
                    "{broken json",
                    assistant("m3", "2026-10-07T16:00:00Z", "main", "claude-sonnet-4-5", 5, 5, 5, 5),
                ],
            )
            write(os.path.join(d, "proj", "sub", "s2.jsonl"), [assistant("m2", "2026-10-07T02:00:00Z", "poc/WBS-3.2.1", "claude-sonnet-4-5", 1, 2, 3, 4)])
            rows, warnings = c.collect_claude(d, since=None, wbs_pattern=c.DEFAULT_WBS)
        key = ("2026-10-07", "WBS-3.2.1", "claude-sonnet-4-5")
        self.assertEqual(rows[key]["requests"], 2)
        self.assertEqual(rows[key]["input_tokens"], 11)
        self.assertEqual(rows[key]["cache_write_tokens"], 44)
        self.assertEqual(rows[("2026-10-08", "", "claude-sonnet-4-5")]["requests"], 1)
        self.assertEqual(len(warnings), 1)

    def test_since_filter(self):
        with tempfile.TemporaryDirectory() as d:
            write(os.path.join(d, "p", "s.jsonl"), [assistant("a", "2026-10-01T01:00:00Z", "WBS-1", "m", 1, 1, 1, 1), assistant("b", "2026-10-05T01:00:00Z", "WBS-1", "m", 1, 1, 1, 1)])
            rows, _ = c.collect_claude(d, since="2026-10-03", wbs_pattern=c.DEFAULT_WBS)
        self.assertEqual(list(rows.keys()), [("2026-10-05", "WBS-1", "m")])


class CodexTest(unittest.TestCase):
    def test_cumulative_delta_and_reset(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "2026", "10", "08", "rollout-1.jsonl")

            def tc(ts, inp, cached, out):
                return {"timestamp": ts, "type": "event_msg", "payload": {"type": "token_count", "info": {"total_token_usage": {"input_tokens": inp, "cached_input_tokens": cached, "output_tokens": out}}}}

            write(
                p,
                [
                    {"timestamp": "2026-10-08T01:00:00Z", "type": "session_meta", "payload": {"git": {"branch": "feat/WBS-4.1.3"}}},
                    {"timestamp": "2026-10-08T01:00:00Z", "type": "turn_context", "payload": {"model": "gpt-5-codex"}},
                    tc("2026-10-08T01:01:00Z", 100, 40, 10),
                    tc("2026-10-08T01:02:00Z", 100, 40, 10),
                    tc("2026-10-08T01:03:00Z", 250, 100, 30),
                    "not json",
                    tc("2026-10-08T01:04:00Z", 50, 0, 5),
                ],
            )
            rows, warnings = c.collect_codex(d, since=None, wbs_pattern=c.DEFAULT_WBS)
        r = rows[("2026-10-08", "WBS-4.1.3", "gpt-5-codex")]
        self.assertEqual(r["requests"], 3)
        self.assertEqual(r["cache_read_tokens"], 40 + 60 + 0)
        self.assertEqual(r["input_tokens"], (100 - 40) + (150 - 60) + 50)
        self.assertEqual(r["output_tokens"], 10 + 20 + 5)
        self.assertEqual(len(warnings), 1)


class OutputTest(unittest.TestCase):
    def test_csv_header_and_rows(self):
        rows = {("2026-10-07", "WBS-1", "m"): {"requests": 1, "input_tokens": 2, "output_tokens": 3, "cache_read_tokens": 4, "cache_write_tokens": 5}}
        text = c.to_csv(rows, "dev01", "claude")
        lines = text.strip().splitlines()
        self.assertEqual(lines[0], "date,user,wbs_id,model,requests,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,source")
        self.assertEqual(lines[1], "2026-10-07,dev01,WBS-1,m,1,2,3,4,5,claude")


if __name__ == "__main__":
    unittest.main()
