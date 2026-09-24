from __future__ import annotations

import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

DEPLOY_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY_DIR))

from deploy import (  # noqa: E402
    Config,
    DeploymentError,
    DeploymentState,
    Release,
    SubprocessRunner,
    atomic_write_state,
)


VALID_SHA = "a" * 40
VALID_DIGEST = "sha256:" + "b" * 64


def valid_manifest(archive: Path) -> dict[str, object]:
    return {
        "source_sha": VALID_SHA,
        "run_id": 123,
        "run_attempt": 2,
        "artifact_name": "steady-image-123-2",
        "archive_path": str(archive),
        "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "image_id": "sha256:" + "c" * 64,
        "source_label": VALID_SHA,
    }


def valid_env() -> dict[str, str]:
    return {
        "AZURE_SUBSCRIPTION_ID": "00000000-0000-0000-0000-000000000000",
        "AZURE_RESOURCE_GROUP": "rg-steady-preprod-aue",
        "AZURE_CONTAINER_APP": "steady-preprod",
        "AZURE_CONTAINER_NAME": "steady-preprod",
        "AZURE_REGISTRY": "steadypreprodaue001",
        "AZURE_IMAGE_REPOSITORY": "steady",
        "PRODUCTION_URL": "https://www.delasc.io",
        "GITHUB_REF": "refs/heads/master",
    }


class FoundationTests(unittest.TestCase):
    def test_release_rejects_bad_sha_before_commands(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp, "image.tar")
            archive.write_bytes(b"image")
            manifest = valid_manifest(archive)
            manifest["source_sha"] = "main"
            with self.assertRaisesRegex(DeploymentError, "source_sha"):
                Release.from_mapping(manifest)

    def test_release_rejects_wrong_archive_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp, "image.tar")
            archive.write_bytes(b"image")
            manifest = valid_manifest(archive)
            manifest["archive_sha256"] = "0" * 64
            with self.assertRaisesRegex(DeploymentError, "archive checksum"):
                Release.from_mapping(manifest)

    def test_config_rejects_wrong_target(self) -> None:
        env = valid_env()
        env["AZURE_CONTAINER_APP"] = "other-app"
        with self.assertRaisesRegex(DeploymentError, "AZURE_CONTAINER_APP"):
            Config.from_env(env)

    def test_atomic_state_contains_only_allowlisted_fields(self) -> None:
        state = DeploymentState(
            source_sha=VALID_SHA,
            run_id=123,
            run_attempt=2,
            phase="baseline_verified",
            outcome="failed",
            baseline_revision="steady--old",
            candidate_revision="steady--new",
            registry_digest=VALID_DIGEST,
            failure_stage="candidate_health",
            recovery_outcome="restored",
            cleanup_outcome="complete",
        )
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp, "state.json")
            atomic_write_state(destination, state)
            parsed = json.loads(destination.read_text())
            self.assertEqual(parsed["phase"], "baseline_verified")
            self.assertNotIn("token", parsed)
            self.assertFalse(Path(str(destination) + ".tmp").exists())

    def test_runner_redacts_secret_output(self) -> None:
        secret = "SECRET_SENTINEL"
        runner = SubprocessRunner()
        stream = io.StringIO()
        with contextlib.redirect_stderr(stream):
            with self.assertRaises(DeploymentError) as raised:
                runner.run(
                    [sys.executable, "-c", f"import sys;sys.stderr.write('{secret}');sys.exit(2)"],
                    timeout=5,
                )
        self.assertNotIn(secret, str(raised.exception))
        self.assertNotIn(secret, stream.getvalue())

    def test_interrupted_atomic_replace_preserves_previous_state(self) -> None:
        state = DeploymentState(VALID_SHA, 123, 2, outcome="failed")
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp, "state.json")
            destination.write_text('{"outcome":"previous"}\n')
            with mock.patch("deploy.os.replace", side_effect=OSError("interrupted")):
                with self.assertRaises(OSError):
                    atomic_write_state(destination, state)
            self.assertEqual(json.loads(destination.read_text())["outcome"], "previous")
            self.assertEqual(list(Path(tmp).glob(".state.json.*")), [])


if __name__ == "__main__":
    unittest.main()
