from pathlib import Path
import json
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from controller_support import Harness, config, release  # noqa: E402
from controller_support import BASE_DIGEST, DIGEST  # noqa: E402
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

    def test_candidate_waits_for_azure_readiness_and_is_cleanup_eligible(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            clock = FakeClock()
            image = f"steadypreprodaue001.azurecr.io/steady@{DIGEST}"

            class ProvisioningController(DeploymentController):
                def __init__(self):
                    super().__init__(config(), release(archive), root / "state.json",
                                     clock=clock, verifier=lambda *_a, **_k: None)
                    self.snapshots = [
                        {"provisioningState": "Provisioning", "healthState": "None"},
                        {"provisioningState": "Provisioned", "healthState": "None"},
                        {"provisioningState": "Provisioned", "healthState": "Healthy"},
                    ]

                def command(self, argv, deadline):
                    return ""

                def inspect_revision(self, name, deadline):
                    return {"name": name, "image": image, "fqdn": "candidate.example",
                            **self.snapshots.pop(0)}

            controller = ProvisioningController()
            controller.baseline = TargetSnapshot("steady-preprod--old", BASE_DIGEST, "old.example")
            candidate = controller.create_candidate(image, PhaseDeadline.after(clock, 60))
            self.assertEqual(candidate["healthState"], "Healthy")
            self.assertTrue(controller.candidate_created)
            self.assertEqual(clock.sleeps, [10, 10])

    def test_unhealthy_candidate_is_tracked_for_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            image = f"steadypreprodaue001.azurecr.io/steady@{DIGEST}"

            class UnhealthyController(DeploymentController):
                def command(self, argv, deadline):
                    return ""

                def inspect_revision(self, name, deadline):
                    return {"name": name, "image": image, "fqdn": "candidate.example",
                            "provisioningState": "Provisioned", "healthState": "Unhealthy"}

            controller = UnhealthyController(config(), release(archive), root / "state.json",
                                               clock=FakeClock(), verifier=lambda *_a, **_k: None)
            controller.baseline = TargetSnapshot("steady-preprod--old", BASE_DIGEST, "old.example")
            with self.assertRaisesRegex(DeploymentError, "not healthy"):
                controller.create_candidate(image, PhaseDeadline.after(controller.clock, 60))
            self.assertTrue(controller.candidate_created)

    def test_success_verifies_candidate_before_named_traffic_and_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "state.json")
            self.assertEqual(controller.run(), 0)
            self.assertLess(controller.events.index("verify:https://www.delasc.io"),
                            controller.events.index("candidate"))
            self.assertLess(controller.events.index("candidate"), controller.events.index("traffic:steady-preprod--new"))
            baseline_recheck = controller.events.index("traffic-verified:steady-preprod--old")
            self.assertLess(controller.events.index("verify:https://new.example"), baseline_recheck)
            self.assertLess(baseline_recheck, controller.events.index("traffic:steady-preprod--new"))
            self.assertLess(controller.events.index("traffic:steady-preprod--new"), controller.events.index("deactivate:steady-preprod--old"))
            self.assertEqual(json.loads((root / "state.json").read_text())["outcome"], "succeeded")

    def test_public_baseline_health_failure_prevents_candidate_creation(self):
        def verifier(url, *_args, **_kwargs):
            if url == "https://www.delasc.io":
                raise DeploymentError("baseline unhealthy")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            controller = Harness(archive, root / "state.json", verifier=verifier)
            self.assertEqual(controller.run(), 1)
            self.assertNotIn("candidate", controller.events)
            self.assertFalse(any(item.startswith("traffic:") for item in controller.events))

    def test_outside_traffic_change_before_promotion_stops_without_overwrite(self):
        class ChangedTraffic(Harness):
            def require_named_traffic(self, revision, deadline):
                self._event("traffic-verified:" + revision)
                if revision.endswith("--old"):
                    raise DeploymentError("production traffic changed outside this deployment")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); archive = root / "image.tar"; archive.write_bytes(b"x")
            controller = ChangedTraffic(archive, root / "state.json")
            self.assertEqual(controller.run(), 1)
            self.assertNotIn("traffic:steady-preprod--new", controller.events)
            self.assertNotIn("recover", controller.events)
            self.assertIn("cleanup-candidate", controller.events)

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
