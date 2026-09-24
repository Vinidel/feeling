from pathlib import Path
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1])); sys.path.insert(0, str(Path(__file__).resolve().parent))
from controller_support import Harness, SHA  # noqa: E402


class EvidenceTests(unittest.TestCase):
    def test_terminal_state_is_traceable_and_sanitized(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"SECRET_SENTINEL")
            state = root / "state.json"
            controller = Harness(archive, state)
            self.assertEqual(controller.run(), 0)
            payload = state.read_text()
            parsed = json.loads(payload)
            self.assertEqual(parsed["source_sha"], SHA)
            self.assertEqual(parsed["candidate_revision"], "steady-preprod--new")
            self.assertEqual(parsed["outcome"], "succeeded")
            self.assertNotIn("SECRET_SENTINEL", payload)

    def test_terminal_summary_contains_only_sanitized_trace_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            summary = root / "summary.md"
            with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary)}):
                controller = Harness(archive, root / "state.json")
                self.assertEqual(controller.run(), 0)
            content = summary.read_text()
            for expected in ("Source SHA", "Registry digest", "Target", "Baseline revision",
                             "Candidate revision", "Outcome", "Recovery", "Cleanup"):
                self.assertIn(expected, content)
            self.assertNotIn("SECRET_SENTINEL", content)


if __name__ == "__main__": unittest.main()
