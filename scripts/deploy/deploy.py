#!/usr/bin/env python3
"""Safe deployment controller for Feeling's single Azure production app.

The module keeps subprocess and persistence boundaries small so rollout behaviour can be
exercised with strict fakes.  It intentionally records only the allowlisted DeploymentState.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from typing import Any, Callable, Mapping, Protocol, Sequence


SHA_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
SUFFIX_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$")


class DeploymentError(RuntimeError):
    """A sanitized, operator-facing deployment failure."""


@dataclass(frozen=True)
class CommandResult:
    stdout: str = ""
    returncode: int = 0


class Runner(Protocol):
    def run(self, argv: list[str], *, timeout: float | None = None) -> CommandResult: ...


class Clock(Protocol):
    def monotonic(self) -> float: ...
    def sleep(self, seconds: float) -> None: ...


class SystemClock:
    monotonic = staticmethod(time.monotonic)
    sleep = staticmethod(time.sleep)


class SubprocessRunner:
    """Run argument arrays while withholding tool output when a command fails."""

    def run(self, argv: list[str], *, timeout: float | None = None) -> CommandResult:
        if not argv or not all(isinstance(item, str) for item in argv):
            raise DeploymentError("invalid command arguments")
        try:
            completed = subprocess.run(
                argv,
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise DeploymentError(f"command timed out: {argv[0]}") from exc
        except OSError as exc:
            raise DeploymentError(f"could not execute command: {argv[0]}") from exc
        if completed.returncode:
            raise DeploymentError(f"command failed ({completed.returncode}): {argv[0]}")
        return CommandResult(stdout=completed.stdout, returncode=completed.returncode)


@dataclass(frozen=True)
class Config:
    subscription_id: str
    resource_group: str
    container_app: str
    container_name: str
    registry: str
    image_repository: str
    production_url: str
    github_ref: str

    EXPECTED = {
        "AZURE_RESOURCE_GROUP": "rg-steady-preprod-aue",
        "AZURE_CONTAINER_APP": "steady-preprod",
        "AZURE_CONTAINER_NAME": "steady-preprod",
        "AZURE_REGISTRY": "steadypreprodaue001",
        "AZURE_IMAGE_REPOSITORY": "steady",
        "PRODUCTION_URL": "https://www.delasc.io",
        "GITHUB_REF": "refs/heads/master",
    }

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "Config":
        values: dict[str, str] = {}
        for name in ("AZURE_SUBSCRIPTION_ID", *cls.EXPECTED):
            value = env.get(name, "").strip()
            if not value:
                raise DeploymentError(f"missing required configuration: {name}")
            if name in cls.EXPECTED and value != cls.EXPECTED[name]:
                raise DeploymentError(f"unexpected production target: {name}")
            values[name] = value
        if not re.fullmatch(r"[0-9a-fA-F-]{36}", values["AZURE_SUBSCRIPTION_ID"]):
            raise DeploymentError("invalid AZURE_SUBSCRIPTION_ID")
        return cls(
            subscription_id=values["AZURE_SUBSCRIPTION_ID"],
            resource_group=values["AZURE_RESOURCE_GROUP"],
            container_app=values["AZURE_CONTAINER_APP"],
            container_name=values["AZURE_CONTAINER_NAME"],
            registry=values["AZURE_REGISTRY"],
            image_repository=values["AZURE_IMAGE_REPOSITORY"],
            production_url=values["PRODUCTION_URL"],
            github_ref=values["GITHUB_REF"],
        )


@dataclass(frozen=True)
class Release:
    source_sha: str
    run_id: int
    run_attempt: int
    artifact_name: str
    archive_path: Path
    archive_sha256: str
    image_id: str
    source_label: str

    @classmethod
    def from_mapping(cls, raw: Mapping[str, object], *, base_dir: Path | None = None) -> "Release":
        try:
            source_sha = str(raw["source_sha"])
            run_id = int(raw["run_id"])
            run_attempt = int(raw["run_attempt"])
            artifact_name = str(raw["artifact_name"])
            archive_path = Path(str(raw["archive_path"]))
            if not archive_path.is_absolute() and base_dir is not None:
                archive_path = base_dir / archive_path
            archive_path = archive_path.resolve(strict=True)
            archive_sha256 = str(raw["archive_sha256"])
            image_id = str(raw["image_id"])
            source_label = str(raw["source_label"])
        except (KeyError, TypeError, ValueError, OSError) as exc:
            raise DeploymentError("invalid release manifest") from exc
        if not SHA_RE.fullmatch(source_sha):
            raise DeploymentError("invalid source_sha")
        if run_id <= 0 or run_attempt <= 0:
            raise DeploymentError("run_id and run_attempt must be positive")
        expected_artifact = f"steady-image-{run_id}-{run_attempt}"
        if artifact_name != expected_artifact:
            raise DeploymentError("artifact_name does not match this run")
        if not re.fullmatch(r"[0-9a-f]{64}", archive_sha256):
            raise DeploymentError("invalid archive_sha256")
        digest = hashlib.sha256()
        with archive_path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        actual = digest.hexdigest()
        if actual != archive_sha256:
            raise DeploymentError("archive checksum mismatch")
        if not DIGEST_RE.fullmatch(image_id):
            raise DeploymentError("invalid image_id")
        if source_label != source_sha:
            raise DeploymentError("source_label does not match source_sha")
        return cls(source_sha, run_id, run_attempt, artifact_name, archive_path,
                   archive_sha256, image_id, source_label)

    @property
    def revision_suffix(self) -> str:
        suffix = f"{self.source_sha[:10]}-{self.run_id}-{self.run_attempt}"
        if not SUFFIX_RE.fullmatch(suffix):
            raise DeploymentError("unsafe revision suffix")
        return suffix


@dataclass
class DeploymentState:
    source_sha: str
    run_id: int
    run_attempt: int
    phase: str = "queued"
    outcome: str = "pending"
    baseline_revision: str | None = None
    candidate_revision: str | None = None
    registry_digest: str | None = None
    failure_stage: str | None = None
    recovery_outcome: str = "not_needed"
    cleanup_outcome: str = "not_needed"
    target: str | None = None


@dataclass(frozen=True)
class TargetSnapshot:
    baseline_revision: str
    baseline_digest: str
    baseline_fqdn: str


@dataclass(frozen=True)
class PhaseDeadline:
    clock: Clock
    ends_at: float

    @classmethod
    def after(cls, clock: Clock, seconds: float) -> "PhaseDeadline":
        return cls(clock, clock.monotonic() + seconds)

    def command_timeout(self, maximum: float = 120.0) -> float:
        remaining = self.ends_at - self.clock.monotonic()
        if remaining <= 0:
            raise DeploymentError("phase deadline exceeded")
        return min(maximum, remaining)


def bounded_deadline(clock: Clock, seconds: float, outer: PhaseDeadline) -> PhaseDeadline:
    """Allocate a phase budget without extending the enclosing rollout deadline."""
    outer.command_timeout()
    return PhaseDeadline(clock, min(clock.monotonic() + seconds, outer.ends_at))


def _json_object(value: str, context: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise DeploymentError(f"invalid projected {context} response") from exc
    if not isinstance(parsed, dict):
        raise DeploymentError(f"invalid projected {context} response")
    return parsed


class DeploymentController:
    """Explicit rollout state machine with injectable external boundaries."""

    def __init__(
        self,
        config: Config,
        release: Release,
        state_path: Path,
        *,
        runner: Runner | None = None,
        clock: Clock | None = None,
        verifier: Callable[..., None] | None = None,
    ) -> None:
        self.config = config
        self.release = release
        self.state_path = state_path
        self.runner = runner or SubprocessRunner()
        self.clock = clock or SystemClock()
        if verifier is None:
            from verify import verify_service
            verifier = verify_service
        self.verifier = verifier
        self.state = DeploymentState(release.source_sha, release.run_id, release.run_attempt,
                                     target=config.production_url)
        self.baseline: TargetSnapshot | None = None
        self.candidate_created = False
        self.promotion_attempted = False

    def transition(self, phase: str, **changes: object) -> None:
        self.state.phase = phase
        for name, value in changes.items():
            if not hasattr(self.state, name):
                raise DeploymentError(f"invalid state field: {name}")
            setattr(self.state, name, value)
        atomic_write_state(self.state_path, self.state)
        shown = [f"phase={phase}"]
        for field in ("baseline_revision", "candidate_revision", "registry_digest", "outcome"):
            value = getattr(self.state, field)
            if value:
                shown.append(f"{field}={value}")
        print("deployment " + " ".join(shown), flush=True)
        if phase in {"complete", "failed", "superseded"}:
            self.write_summary()

    def write_summary(self) -> None:
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if not summary_path:
            return
        values = {
            "Source SHA": self.state.source_sha,
            "Registry digest": self.state.registry_digest or "not published",
            "Target": self.state.target or "unknown",
            "Baseline revision": self.state.baseline_revision or "not captured",
            "Candidate revision": self.state.candidate_revision or "not created",
            "Outcome": self.state.outcome,
            "Failure stage": self.state.failure_stage or "none",
            "Recovery": self.state.recovery_outcome,
            "Cleanup": self.state.cleanup_outcome,
        }
        try:
            with Path(summary_path).open("a", encoding="utf-8") as handle:
                handle.write("## Production deployment\n\n| Field | Value |\n|---|---|\n")
                for name, value in values.items():
                    safe = str(value).replace("|", "\\|").replace("\n", " ")
                    handle.write(f"| {name} | `{safe}` |\n")
        except OSError:
            # State and streamed identifiers remain the evidence fallback.
            pass

    def command(self, argv: list[str], deadline: PhaseDeadline) -> str:
        return self.runner.run(argv, timeout=deadline.command_timeout()).stdout.strip()

    def ensure_fresh(self, deadline: PhaseDeadline) -> bool:
        output = self.command(["git", "ls-remote", "origin", "refs/heads/master"], deadline)
        parts = output.split()
        if len(parts) != 2 or not SHA_RE.fullmatch(parts[0]) or parts[1] != "refs/heads/master":
            raise DeploymentError("could not determine current master SHA")
        return parts[0] == self.release.source_sha

    def verify_subscription(self, deadline: PhaseDeadline) -> None:
        actual = self.command(["az", "account", "show", "--query", "id", "-o", "tsv"], deadline)
        if actual.lower() != self.config.subscription_id.lower():
            raise DeploymentError("Azure subscription identity mismatch")

    def publish(self, deadline: PhaseDeadline) -> str:
        self.command(["docker", "load", "--input", str(self.release.archive_path)], deadline)
        local = f"steady-build:{self.release.source_sha}"
        inspected = _json_object(
            self.command(
                ["docker", "image", "inspect", local, "--format", "{{json .}}"], deadline
            ),
            "Docker image",
        )
        labels = inspected.get("Config", {}).get("Labels", {}) if isinstance(inspected.get("Config"), dict) else {}
        if inspected.get("Id") != self.release.image_id:
            raise DeploymentError("loaded image ID does not match manifest")
        if not isinstance(labels, dict) or labels.get("org.opencontainers.image.revision") != self.release.source_sha:
            raise DeploymentError("loaded image source label does not match manifest")
        tag = f"run-{self.release.run_id}-{self.release.run_attempt}-{self.release.source_sha[:12]}"
        registry_host = f"{self.config.registry}.azurecr.io"
        tagged = f"{registry_host}/{self.config.image_repository}:{tag}"
        self.command(["az", "acr", "login", "--name", self.config.registry, "--output", "none"], deadline)
        self.command(["docker", "tag", local, tagged], deadline)
        self.command(["docker", "push", tagged], deadline)
        digest = self.command(
            ["az", "acr", "repository", "show", "--name", self.config.registry,
             "--image", f"{self.config.image_repository}:{tag}", "--query", "digest", "-o", "tsv"],
            deadline,
        )
        if not DIGEST_RE.fullmatch(digest):
            raise DeploymentError("registry returned an invalid image digest")
        self.transition("published", registry_digest=digest)
        return f"{registry_host}/{self.config.image_repository}@{digest}"

    def inspect_revision(self, name: str, deadline: PhaseDeadline) -> dict[str, Any]:
        query = ("{name:name,active:properties.active,healthState:properties.healthState,"
                 "provisioningState:properties.provisioningState,fqdn:properties.fqdn,"
                 f"image:properties.template.containers[?name=='{self.config.container_name}']|[0].image}}")
        return _json_object(
            self.command(["az", "containerapp", "revision", "show", "--name", self.config.container_app,
                          "--resource-group", self.config.resource_group, "--revision", name,
                          "--query", query, "-o", "json"], deadline),
            "revision",
        )

    def capture_baseline(self, deadline: PhaseDeadline) -> TargetSnapshot:
        target = self.inspect_target(deadline)
        traffic = target.get("traffic")
        if target.get("revisionMode") != "Multiple" or not isinstance(traffic, list) or len(traffic) != 1:
            raise DeploymentError("production must have one named traffic target in Multiple mode")
        entry = traffic[0]
        if not isinstance(entry, dict) or entry.get("weight") != 100 or entry.get("latestRevision") is True:
            raise DeploymentError("production traffic must be named and weighted 100 percent")
        name = entry.get("revisionName")
        if not isinstance(name, str) or not name:
            raise DeploymentError("production baseline revision is missing")
        revision = self.inspect_revision(name, deadline)
        image = revision.get("image")
        digest = image.rsplit("@", 1)[-1] if isinstance(image, str) and "@" in image else ""
        if (revision.get("active") is not True or revision.get("healthState") != "Healthy"
                or revision.get("provisioningState") != "Provisioned" or not DIGEST_RE.fullmatch(digest)):
            raise DeploymentError("production baseline is not healthy and recoverable")
        fqdn = revision.get("fqdn")
        if not isinstance(fqdn, str) or not fqdn:
            raise DeploymentError("production baseline FQDN is missing")
        snapshot = TargetSnapshot(name, digest, fqdn)
        self.baseline = snapshot
        self.transition("baseline_verified", baseline_revision=name)
        return snapshot

    def inspect_target(self, deadline: PhaseDeadline) -> dict[str, Any]:
        query = "{revisionMode:properties.configuration.activeRevisionsMode,traffic:properties.configuration.ingress.traffic}"
        return _json_object(
            self.command(["az", "containerapp", "show", "--name", self.config.container_app,
                          "--resource-group", self.config.resource_group, "--query", query, "-o", "json"], deadline),
            "target",
        )

    def require_named_traffic(self, revision: str, deadline: PhaseDeadline) -> None:
        target = self.inspect_target(deadline)
        traffic = target.get("traffic")
        if target.get("revisionMode") != "Multiple" or not isinstance(traffic, list) or len(traffic) != 1:
            raise DeploymentError("production traffic changed outside this deployment")
        entry = traffic[0]
        if (not isinstance(entry, dict) or entry.get("revisionName") != revision
                or entry.get("weight") != 100 or entry.get("latestRevision") is True):
            raise DeploymentError("production traffic changed outside this deployment")

    def require_not_serving(self, revision: str, deadline: PhaseDeadline) -> None:
        """Fail closed unless production has one different, named 100% traffic target."""
        target = self.inspect_target(deadline)
        traffic = target.get("traffic")
        if target.get("revisionMode") != "Multiple" or not isinstance(traffic, list) or len(traffic) != 1:
            raise DeploymentError("production traffic state is unsafe for cleanup")
        entry = traffic[0]
        if (not isinstance(entry, dict) or not isinstance(entry.get("revisionName"), str)
                or not entry.get("revisionName") or entry.get("weight") != 100
                or entry.get("latestRevision") is True):
            raise DeploymentError("production traffic state is unsafe for cleanup")
        if entry["revisionName"] == revision:
            raise DeploymentError("refusing to deactivate the serving revision")

    def create_candidate(self, image_reference: str, deadline: PhaseDeadline) -> dict[str, Any]:
        assert self.baseline is not None
        expected_name = f"{self.config.container_app}--{self.release.revision_suffix}"
        self.transition("candidate_creation_started", candidate_revision=expected_name)
        copy_error: DeploymentError | None = None
        try:
            self.command(
                ["az", "containerapp", "revision", "copy", "--name", self.config.container_app,
                 "--resource-group", self.config.resource_group, "--from-revision", self.baseline.baseline_revision,
                 "--image", image_reference, "--revision-suffix", self.release.revision_suffix, "--output", "none"],
                deadline,
            )
        except DeploymentError as exc:
            # The server may have applied a mutation whose CLI response timed out.
            copy_error = exc
        candidate = self.inspect_revision(expected_name, deadline)
        name = candidate.get("name")
        if name != expected_name:
            raise DeploymentError("candidate revision identity mismatch")
        image = candidate.get("image")
        if not isinstance(image, str) or image != image_reference:
            raise DeploymentError("candidate revision image digest mismatch")
        self.candidate_created = True
        while candidate.get("provisioningState") != "Provisioned" or candidate.get("healthState") != "Healthy":
            if candidate.get("provisioningState") == "Failed" or candidate.get("healthState") == "Unhealthy":
                raise DeploymentError("candidate revision is not healthy")
            self.clock.sleep(deadline.command_timeout(10))
            candidate = self.inspect_revision(expected_name, deadline)
            if candidate.get("name") != expected_name or candidate.get("image") != image_reference:
                raise DeploymentError("candidate revision identity changed while provisioning")
        fqdn = candidate.get("fqdn")
        if not isinstance(fqdn, str) or not fqdn:
            raise DeploymentError("candidate revision FQDN is missing")
        self.transition("candidate_created", candidate_revision=name)
        if copy_error is not None:
            raise copy_error
        return candidate

    def set_traffic(self, revision: str, deadline: PhaseDeadline) -> None:
        self.promotion_attempted = True
        self.command(["az", "containerapp", "ingress", "traffic", "set", "--name", self.config.container_app,
                      "--resource-group", self.config.resource_group, "--revision-weight", f"{revision}=100",
                      "--output", "none"], deadline)

    def deactivate(self, revision: str, deadline: PhaseDeadline) -> None:
        self.require_not_serving(revision, deadline)
        command_error: DeploymentError | None = None
        try:
            self.command(["az", "containerapp", "revision", "deactivate", "--name", self.config.container_app,
                          "--resource-group", self.config.resource_group, "--revision", revision,
                          "--output", "none"], deadline)
        except DeploymentError as exc:
            # A timed-out or disconnected command may still have been applied by Azure.
            command_error = exc
        current = self.inspect_revision(revision, deadline)
        if current.get("active") is not False:
            if command_error is not None:
                raise command_error
            raise DeploymentError("deactivated revision is still active")

    def activate(self, revision: str, deadline: PhaseDeadline) -> None:
        command_error: DeploymentError | None = None
        try:
            self.command(["az", "containerapp", "revision", "activate", "--name", self.config.container_app,
                          "--resource-group", self.config.resource_group, "--revision", revision,
                          "--output", "none"], deadline)
        except DeploymentError as exc:
            # Reconcile an ambiguous command result before any traffic mutation.
            command_error = exc
        current = self.inspect_revision(revision, deadline)
        if current.get("active") is not True:
            if command_error is not None:
                raise command_error
            raise DeploymentError("activated revision is not active")

    def recover(self) -> None:
        if self.baseline is None:
            return
        deadline = PhaseDeadline.after(self.clock, 600)
        self.transition("recovery_started")
        try:
            target = self.inspect_target(deadline)
            traffic = target.get("traffic")
            if not isinstance(traffic, list) or len(traffic) != 1 or not isinstance(traffic[0], dict):
                raise DeploymentError("unknown traffic state; automatic recovery stopped")
            serving = traffic[0].get("revisionName")
            known = {self.baseline.baseline_revision, self.state.candidate_revision}
            if serving not in known or traffic[0].get("weight") != 100 or traffic[0].get("latestRevision") is True:
                raise DeploymentError("outside traffic change; automatic recovery stopped")
            if serving != self.baseline.baseline_revision:
                baseline = self.inspect_revision(self.baseline.baseline_revision, deadline)
                if baseline.get("active") is not True:
                    self.activate(self.baseline.baseline_revision, deadline)
                self.set_traffic(self.baseline.baseline_revision, deadline)
                self.require_named_traffic(self.baseline.baseline_revision, deadline)
            self.verifier(self.config.production_url, include_root=True, clock=self.clock,
                          deadline=deadline.ends_at)
            self.transition("recovery_verified", recovery_outcome="restored")
        except Exception as exc:
            self.transition("recovery_failed", recovery_outcome="failed")
            if isinstance(exc, DeploymentError):
                return

    def cleanup_candidate(self) -> None:
        if not self.state.candidate_revision:
            return
        try:
            self.deactivate(self.state.candidate_revision, PhaseDeadline.after(self.clock, 300))
            self.state.cleanup_outcome = "complete"
        except DeploymentError:
            self.state.cleanup_outcome = "failed"
        atomic_write_state(self.state_path, self.state)

    def run(self) -> int:
        atomic_write_state(self.state_path, self.state)
        try:
            preflight = PhaseDeadline.after(self.clock, 600)
            self.transition("freshness_check")
            if not self.ensure_fresh(preflight):
                self.transition("superseded", outcome="superseded")
                return 0
            self.verify_subscription(preflight)
            image_reference = self.publish(preflight)
            baseline = self.capture_baseline(preflight)
            self.verifier(self.config.production_url, clock=self.clock, deadline=preflight.ends_at)
            if baseline.baseline_digest == self.state.registry_digest:
                self.verifier(self.config.production_url, include_root=True, clock=self.clock,
                              deadline=preflight.ends_at)
                self.transition("already_deployed", outcome="already_deployed")
                return 0
            # This is the final freshness guard and therefore the mutation boundary.
            self.transition("final_freshness_check")
            if not self.ensure_fresh(preflight):
                self.transition("superseded", outcome="superseded")
                return 0
            forward = PhaseDeadline.after(self.clock, 1200)
            provisioning = bounded_deadline(self.clock, 600, forward)
            candidate = self.create_candidate(image_reference, provisioning)
            candidate_health = bounded_deadline(self.clock, 300, forward)
            self.verifier(f"https://{candidate['fqdn']}", clock=self.clock,
                          deadline=candidate_health.ends_at)
            self.transition("candidate_verified")
            promotion = bounded_deadline(self.clock, 300, forward)
            self.require_named_traffic(baseline.baseline_revision, promotion)
            self.set_traffic(str(candidate["name"]), promotion)
            self.transition("promotion_attempted")
            self.require_named_traffic(str(candidate["name"]), promotion)
            self.verifier(self.config.production_url, include_root=True, clock=self.clock,
                          deadline=promotion.ends_at)
            current = self.inspect_revision(str(candidate["name"]), promotion)
            if current.get("image") != image_reference:
                raise DeploymentError("public serving revision identity changed")
            self.transition("public_verified")
            assert self.baseline is not None
            try:
                self.deactivate(self.baseline.baseline_revision, PhaseDeadline.after(self.clock, 300))
            except DeploymentError as exc:
                self.state.failure_stage = "cleanup"
                self.transition("failed", outcome="failed", cleanup_outcome="failed")
                print(f"deployment cleanup failed: {exc}", file=sys.stderr)
                return 1
            self.transition("complete", outcome="succeeded", cleanup_outcome="complete")
            return 0
        except DeploymentError as exc:
            self.state.failure_stage = self.state.phase
            if self.promotion_attempted:
                self.recover()
            elif self.baseline is not None:
                try:
                    baseline_deadline = PhaseDeadline.after(self.clock, 300)
                    self.require_named_traffic(self.baseline.baseline_revision, baseline_deadline)
                    self.verifier(self.config.production_url, include_root=True, clock=self.clock,
                                  deadline=baseline_deadline.ends_at)
                except DeploymentError:
                    self.state.recovery_outcome = "failed"
            if self.candidate_created:
                self.cleanup_candidate()
            self.transition("failed", outcome="failed")
            print(f"deployment failed: {exc}", file=sys.stderr)
            return 1


def atomic_write_state(destination: Path, state: DeploymentState) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(asdict(state), sort_keys=True, indent=2) + "\n"
    fd, temporary = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    temporary_path = Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, destination)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def load_release(path: Path) -> Release:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DeploymentError("could not read release manifest") from exc
    if not isinstance(value, dict):
        raise DeploymentError("release manifest must be an object")
    return Release.from_mapping(value, base_dir=path.resolve().parent)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        config = Config.from_env(os.environ)
        release = load_release(args.manifest)
        return DeploymentController(config, release, args.state).run()
    except DeploymentError as exc:
        print(f"deployment failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
