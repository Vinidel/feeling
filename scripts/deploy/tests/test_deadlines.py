from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1])); sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy import DeploymentError, PhaseDeadline, SubprocessRunner, bounded_deadline  # noqa: E402
from controller_support import Harness  # noqa: E402
from support import FakeClock  # noqa: E402


class DeadlineTests(unittest.TestCase):
    def test_command_timeout_is_bounded_to_120_seconds(self):
        deadline = PhaseDeadline.after(FakeClock(), 600)
        self.assertEqual(deadline.command_timeout(), 120)

    def test_remaining_phase_budget_wins(self):
        clock = FakeClock(); deadline = PhaseDeadline.after(clock, 30); clock.sleep(25)
        self.assertEqual(deadline.command_timeout(), 5)
        clock.sleep(5)
        with self.assertRaisesRegex(DeploymentError, "deadline"):
            deadline.command_timeout()

    def test_real_command_timeout_is_reported_without_output(self):
        runner = SubprocessRunner()
        with self.assertRaisesRegex(DeploymentError, "timed out"):
            runner.run([sys.executable, "-c", "import time; time.sleep(.2)"], timeout=.01)

    def test_bounded_deadline_cannot_outlive_total_forward_budget(self):
        clock = FakeClock()
        total = PhaseDeadline.after(clock, 20)
        clock.sleep(15)
        child = bounded_deadline(clock, 10, total)
        self.assertEqual(child.ends_at, 20)

    def test_controller_allocates_separate_rollout_sub_budgets(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            clock = FakeClock()
            controller = Harness(archive, root / "s", clock=clock)
            seen = {}
            original_fresh = controller.ensure_fresh
            original_candidate = controller.create_candidate
            original_traffic = controller.set_traffic
            original_deactivate = controller.deactivate
            def freshness(deadline):
                seen.setdefault("preflight", deadline.ends_at)
                return original_fresh(deadline)
            def candidate(image, deadline):
                seen["provisioning"] = deadline.ends_at
                return original_candidate(image, deadline)
            def verifier(url, *_args, **kwargs):
                if "new.example" in url:
                    seen["candidate_health"] = kwargs["deadline"]
                elif controller.candidate_created:
                    seen["promotion"] = kwargs["deadline"]
            def traffic(revision, deadline):
                seen["promotion_traffic"] = deadline.ends_at
                return original_traffic(revision, deadline)
            def deactivate(revision, deadline):
                seen["cleanup"] = deadline.ends_at
                return original_deactivate(revision, deadline)
            controller.ensure_fresh = freshness
            controller.create_candidate = candidate
            controller.verifier = verifier
            controller.set_traffic = traffic
            controller.deactivate = deactivate
            self.assertEqual(controller.run(), 0)
            self.assertEqual(seen, {
                "preflight": 600,
                "provisioning": 600,
                "candidate_health": 300,
                "promotion": 300,
                "promotion_traffic": 300,
                "cleanup": 300,
            })


if __name__ == "__main__": unittest.main()
