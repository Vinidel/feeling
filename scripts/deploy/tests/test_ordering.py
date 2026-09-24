from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1])); sys.path.insert(0, str(Path(__file__).resolve().parent))
from controller_support import Harness  # noqa: E402
from controller_support import config, release  # noqa: E402
from deploy import DeploymentController, DeploymentError, PhaseDeadline  # noqa: E402
from support import FakeClock, FakeRunner  # noqa: E402


class OrderingTests(unittest.TestCase):
    def test_new_push_cannot_cancel_active_recovery(self):
        workflow = Path(__file__).resolve().parents[3] / ".github/workflows/deploy-production.yml"
        text = workflow.read_text()
        self.assertIn("group: feeling-production", text)
        self.assertIn("cancel-in-progress: false", text)
        self.assertIn("queue: max", text)

    def test_stale_before_login_skips_all_publication(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s", fresh=(False,))
            self.assertEqual(controller.run(), 0)
            self.assertEqual(controller.state.outcome, "superseded")
            self.assertEqual(controller.events, ["freshness"])

    def test_stale_at_final_guard_never_mutates_app(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s", fresh=(True, False))
            self.assertEqual(controller.run(), 0)
            self.assertIn("publish", controller.events)
            self.assertNotIn("candidate", controller.events)
            self.assertFalse(any(event.startswith("traffic:") for event in controller.events))

    def test_current_head_lookup_failure_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            runner = FakeRunner()
            runner.expect(["git", "ls-remote", "origin", "refs/heads/master"], stdout="not-a-sha\n")
            controller = DeploymentController(config(), release(archive), root / "s",
                                              runner=runner, clock=FakeClock(), verifier=lambda *_a, **_k: None)
            with self.assertRaisesRegex(DeploymentError, "current master"):
                controller.ensure_fresh(PhaseDeadline.after(controller.clock, 30))
            runner.assert_done()

    def test_failed_newest_release_does_not_fall_back_to_an_older_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s", fail_at="baseline")
            self.assertEqual(controller.run(), 1)
            self.assertEqual(controller.events.count("freshness"), 1)
            self.assertNotIn("candidate", controller.events)


if __name__ == "__main__": unittest.main()
