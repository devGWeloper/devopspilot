import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import extract_commits as e  # noqa: E402


class ParseTest(unittest.TestCase):
    def test_numstat_binary_and_pipe_in_subject(self):
        raw = "\n".join(
            [
                "@a1b2c3d|2026-10-07|Kim|[WBS-3.2.1] add | screen",
                "10\t2\tsrc/a.ts",
                "-\t-\tassets/logo.png",
                "5\t1\tsrc/b.ts",
                "",
                "@b2c3d4e|2026-10-08|Lee|merge only",
                "",
            ]
        )
        rows = e.parse_git_log(raw)
        self.assertEqual(
            rows,
            [
                {"hash": "a1b2c3d", "date": "2026-10-07", "author": "Kim", "message": "[WBS-3.2.1] add | screen", "added": 15, "deleted": 3},
                {"hash": "b2c3d4e", "date": "2026-10-08", "author": "Lee", "message": "merge only", "added": 0, "deleted": 0},
            ],
        )

    def test_csv_quotes_commas(self):
        text = e.to_csv([{"hash": "a", "date": "2026-10-07", "author": "K", "message": 'x, "y"', "added": 1, "deleted": 0}])
        self.assertEqual(text.splitlines()[1], 'a,2026-10-07,K,"x, ""y""",1,0')


if __name__ == "__main__":
    unittest.main()
