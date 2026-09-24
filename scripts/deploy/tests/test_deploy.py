from pathlib import Path
import json
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from controller_support import Harness, config, release  # noqa: E402
from controller_support import DIGEST  # noqa: E402
from deploy import DeploymentController, DeploymentError, PhaseDeadline, TargetSnapshot  # noqa: E402
from support import FakeClock, FakeRunner  # noqa: E402


class DeployTests(unittest.TestCase):
    def baseline_controller(self, root, target, revision=None):
        archive = root / "image.tar"; archive.write_bytes(b"x")
        runner = FakeRunner()
        query = "{revisionMode:properties.configuration.activeRevisionsMode,traffic:properties.configuration.ingress.traffic}"
        runner.expect(["az", "containerapp", "show", "--name", "steady-preprod", "--resource-group",
                       "rg-steady-preprod-aue", "--query", query, "-o", "json"], stdout=json.dumps(target))
        if revision is not None:
            revision_query = ("{name:name,active:properties.active,healthState:properties.healthState,"
                              "provisioningState:properties.provisioningState,fqdn:properties.fqdn,"
                              "image:properties.template.containers[?name=='steady-preprod']|[0].image}")
            runner.expect(["az", "containerapp", "revision", "show", "--name", "steady-preprod",
                           "--resource-group", "rg-steady-preprod-aue", "--revision", "steady--old",
                           "--query", revision_query, "-o", "json"], stdout=json.dumps(revision))
        controller = DeploymentController(config(), release(archive), root / "state.json",
                                          runner=runner, clock=FakeClock(), verifier=lambda *_a, **_k: None)
        return controller, runner

    def test_baseline_rejects_multiple_traffic_targets_without_mutation(self):
        target = {"revisionMode": "Multiple", "traffic": [
            {"revisionName": "steady--old", "weight": 50},
            {"revisionName": "steady--other", "weight": 50},
        ]}
        with tempfile.TemporaryDirectory() as tmp:
            controller, runner = self.baseline_controller(Path(tmp), target)
            with self.assertRaisesRegex(DeploymentError, "one named"):
                controller.capture_baseline(PhaseDeadline.after(controller.clock, 30))
            runner.assert_done()

    def test_baseline_rejects_latest_revision_wildcard(self):
        target = {"revisionMode": "Multiple", "traffic": [
            {"revisionName": "steady--old", "weight": 100, "latestRevision": True},
        ]}
        with tempfile.TemporaryDirectory() as tmp:
            controller, runner = self.baseline_controller(Path(tmp), target)
            with self.assertRaisesRegex(DeploymentError, "named"):
                controller.capture_baseline(PhaseDeadline.after(controller.clock, 30))
            runner.assert_done()

    def test_baseline_rejects_image_without_digest(self):
        target = {"revisionMode": "Multiple", "traffic": [
            {"revisionName": "steady--old", "weight": 100, "latestRevision": False},
        ]}
        revision = {"name": "steady--old", "active": True, "healthState": "Healthy",
                    "provisioningState": "Provisioned", "fqdn": "old.example",
                    "image": "steadypreprodaue001.azurecr.io/steady:latest"}
        with tempfile.TemporaryDirectory() as tmp:
            controller, runner = self.baseline_controller(Path(tmp), target, revision)
            with self.assertRaisesRegex(DeploymentError, "not healthy"):
                controller.capture_baseline(PhaseDeadline.after(controller.clock, 30))
            runner.assert_done()
    def test_success_verifies_candidate_before_named_traffic_and_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "state.json")
            self.assertEqual(controller.run(), 0)
            self.assertLess(controller.events.index("candidate"), controller.events.index("traffic:steady-preprod--new"))
            self.assertLess(controller.events.index("traffic:steady-preprod--new"), controller.events.index("deactivate:steady-preprod--old"))
            self.assertEqual(json.loads((root / "state.json").read_text())["outcome"], "succeeded")

    def test_baseline_failure_prevents_candidate_and_traffic(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "state.json", fail_at="baseline")
            self.assertEqual(controller.run(), 1)
            self.assertNotIn("candidate", controller.events)
            self.assertFalse(any(item.startswith("traffic:") for item in controller.events))

    def test_cleanup_failure_does_not_rollback_healthy_candidate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "state.json", fail_at="deactivate:steady-preprod--old")
            self.assertEqual(controller.run(), 1)
            self.assertNotIn("recover", controller.events)
            self.assertEqual(controller.state.cleanup_outcome, "failed")
            self.assertEqual(controller.state.failure_stage, "cleanup")

    def test_exact_healthy_digest_is_reported_already_deployed(self):
        class AlreadyDeployed(Harness):
            def capture_baseline(self, deadline):
                self._event("baseline")
                self.baseline = TargetSnapshot("steady-preprod--current", DIGEST, "current.example")
                self.transition("baseline_verified", baseline_revision=self.baseline.baseline_revision)
                return self.baseline
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            controller = AlreadyDeployed(archive, root / "state.json")
            self.assertEqual(controller.run(), 0)
            self.assertEqual(controller.state.outcome, "already_deployed")
            self.assertNotIn("candidate", controller.events)


if __name__ == "__main__": unittest.main()
