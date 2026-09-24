from __future__ import annotations

from pathlib import Path

from deploy import Config, DeploymentController, DeploymentError, Release, TargetSnapshot


SHA = "a" * 40
DIGEST = "sha256:" + "b" * 64
BASE_DIGEST = "sha256:" + "c" * 64


def config() -> Config:
    return Config(
        subscription_id="00000000-0000-0000-0000-000000000000",
        resource_group="rg-steady-preprod-aue",
        container_app="steady-preprod",
        container_name="steady-preprod",
        registry="steadypreprodaue001",
        image_repository="steady",
        production_url="https://www.delasc.io",
        github_ref="refs/heads/master",
    )


def release(archive: Path) -> Release:
    return Release(SHA, 123, 2, "steady-image-123-2", archive, "0" * 64,
                   "sha256:" + "d" * 64, SHA)


class Harness(DeploymentController):
    def __init__(self, archive: Path, state: Path, *, fresh=(True, True), fail_at=None, verifier=None, clock=None):
        self.events = []
        actual_verifier = verifier or (lambda *_a, **_k: None)
        def tracked_verifier(url, *_args, **kwargs):
            self.events.append("verify:" + url)
            return actual_verifier(url, *_args, **kwargs)
        super().__init__(config(), release(archive), state, verifier=tracked_verifier, clock=clock)
        self.fresh = list(fresh)
        self.fail_at = fail_at

    def _event(self, name):
        self.events.append(name)
        if self.fail_at == name:
            raise DeploymentError(f"injected {name} failure")

    def ensure_fresh(self, deadline):
        self._event("freshness")
        return self.fresh.pop(0)

    def verify_subscription(self, deadline):
        self._event("subscription")

    def publish(self, deadline):
        self._event("publish")
        self.transition("published", registry_digest=DIGEST)
        return f"steadypreprodaue001.azurecr.io/steady@{DIGEST}"

    def capture_baseline(self, deadline):
        self._event("baseline")
        self.baseline = TargetSnapshot("steady-preprod--old", BASE_DIGEST, "old.example")
        self.transition("baseline_verified", baseline_revision=self.baseline.baseline_revision)
        return self.baseline

    def create_candidate(self, image_reference, deadline):
        self._event("candidate")
        self.candidate_created = True
        name = "steady-preprod--new"
        self.transition("candidate_created", candidate_revision=name)
        return {"name": name, "fqdn": "new.example", "image": image_reference}

    def set_traffic(self, revision, deadline):
        self._event("traffic:" + revision)
        self.promotion_attempted = True

    def require_named_traffic(self, revision, deadline):
        self._event("traffic-verified:" + revision)

    def inspect_revision(self, name, deadline):
        self._event("inspect:" + name)
        return {"name": name, "image": f"steadypreprodaue001.azurecr.io/steady@{DIGEST}"}

    def deactivate(self, revision, deadline):
        self._event("deactivate:" + revision)

    def recover(self):
        self._event("recover")
        self.state.recovery_outcome = "restored"

    def cleanup_candidate(self):
        self._event("cleanup-candidate")
        self.state.cleanup_outcome = "complete"
