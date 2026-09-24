from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1])); sys.path.insert(0, str(Path(__file__).resolve().parent))
from controller_support import Harness, DIGEST  # noqa: E402
from deploy import DeploymentController, DeploymentError, PhaseDeadline, TargetSnapshot  # noqa: E402


class RollbackTests(unittest.TestCase):
    def test_failure_after_promotion_recovers_and_keeps_failed_outcome(self):
        calls = {"count": 0}
        def verifier(*_a, **_k):
            calls["count"] += 1
            if calls["count"] == 3:
                from deploy import DeploymentError
                raise DeploymentError("public failed")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s", verifier=verifier)
            self.assertEqual(controller.run(), 1)
            self.assertIn("recover", controller.events)
            self.assertIn("cleanup-candidate", controller.events)
            self.assertEqual(controller.state.recovery_outcome, "restored")
            self.assertEqual(controller.state.outcome, "failed")

    def test_candidate_failure_does_not_restore_traffic(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s", fail_at="candidate")
            self.assertEqual(controller.run(), 1)
            self.assertNotIn("recover", controller.events)

    def test_recovery_stops_on_unknown_external_traffic(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s")
            controller.baseline = TargetSnapshot("steady--old", DIGEST, "old.example")
            controller.state.candidate_revision = "steady--new"
            controller.inspect_target = lambda _deadline: {
                "revisionMode": "Multiple", "traffic": [{"revisionName": "outside", "weight": 100}]
            }
            DeploymentController.recover(controller)
            self.assertEqual(controller.state.recovery_outcome, "failed")
            self.assertFalse(any(event.startswith("traffic:") for event in controller.events))

    def test_recovery_verification_failure_is_distinct(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s")
            controller.baseline = TargetSnapshot("steady--old", DIGEST, "old.example")
            controller.state.candidate_revision = "steady--new"
            controller.inspect_target = lambda _deadline: {
                "revisionMode": "Multiple", "traffic": [
                    {"revisionName": "steady--old", "weight": 100, "latestRevision": False}
                ]
            }
            controller.verifier = lambda *_a, **_k: (_ for _ in ()).throw(DeploymentError("unhealthy"))
            DeploymentController.recover(controller)
            self.assertEqual(controller.state.recovery_outcome, "failed")

    def test_copy_timeout_discovers_applied_candidate_before_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s")
            controller.baseline = TargetSnapshot("steady--old", DIGEST, "old.example")
            image = f"steadypreprodaue001.azurecr.io/steady@{DIGEST}"
            expected = f"steady-preprod--{controller.release.revision_suffix}"
            calls = []
            def command(_argv, _deadline):
                calls.append("copy")
                raise DeploymentError("command timed out: az")
            controller.command = command
            controller.inspect_revision = lambda name, _deadline: {
                "name": name, "image": image, "provisioningState": "Provisioned",
                "healthState": "Healthy", "fqdn": "new.example",
            }
            with self.assertRaisesRegex(DeploymentError, "timed out"):
                DeploymentController.create_candidate(controller, image, PhaseDeadline.after(controller.clock, 30))
            self.assertEqual(controller.state.candidate_revision, expected)
            self.assertTrue(controller.candidate_created)
            self.assertEqual(calls, ["copy"])

    def test_deactivation_reads_back_inactive_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s")
            calls = []
            controller.command = lambda _argv, _deadline: calls.append("deactivate") or ""
            controller.inspect_revision = lambda _name, _deadline: {"active": False}
            DeploymentController.deactivate(
                controller, "steady--old", PhaseDeadline.after(controller.clock, 30)
            )
            self.assertEqual(calls, ["deactivate"])

    def test_deactivation_rejects_successful_noop_when_revision_remains_active(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s")
            controller.command = lambda _argv, _deadline: ""
            controller.inspect_revision = lambda _name, _deadline: {"active": True}
            with self.assertRaisesRegex(DeploymentError, "still active"):
                DeploymentController.deactivate(
                    controller, "steady--old", PhaseDeadline.after(controller.clock, 30)
                )

    def test_deactivation_reconciles_timeout_when_revision_is_inactive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "i"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "s")
            controller.command = lambda _argv, _deadline: (_ for _ in ()).throw(
                DeploymentError("command timed out: az")
            )
            controller.inspect_revision = lambda _name, _deadline: {"active": False}
            DeploymentController.deactivate(
                controller, "steady--old", PhaseDeadline.after(controller.clock, 30)
            )


if __name__ == "__main__": unittest.main()
