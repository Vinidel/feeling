from __future__ import annotations

import json
from pathlib import Path
import sys
import unittest
from urllib.error import URLError

DEPLOY_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from deploy import DeploymentError  # noqa: E402
from verify import verify_service  # noqa: E402
from support import FakeClock  # noqa: E402


class Response:
    def __init__(self, payload: object, content_type: str = "application/json", status: int = 200):
        self.status = status
        self.headers = {"Content-Type": content_type}
        body = payload if isinstance(payload, str) else json.dumps(payload)
        self._body = body.encode()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, _: int) -> bytes:
        return self._body


class QueueOpen:
    def __init__(self, responses):
        self.responses = list(responses)
        self.urls = []

    def __call__(self, request, **kwargs):
        self.urls.append(request.full_url)
        if not self.responses:
            raise AssertionError("unexpected request")
        value = self.responses.pop(0)
        if isinstance(value, Exception):
            raise value
        return value


def healthy(include_root=False):
    result = []
    for _ in range(2):
        result.extend([Response({"status": "ok"}), Response({"status": "ready"})])
        if include_root:
            result.append(Response("<html></html>", "text/html; charset=utf-8"))
    return result


class VerifyTests(unittest.TestCase):
    def test_two_rounds_are_separated_by_ten_seconds(self):
        opener = QueueOpen(healthy(True))
        clock = FakeClock()
        verify_service("https://candidate.example", include_root=True, open_url=opener, clock=clock)
        self.assertEqual(clock.sleeps, [10])
        self.assertEqual(len(opener.urls), 6)

    def test_tls_or_network_failure_is_sanitized(self):
        opener = QueueOpen([URLError("SECRET_SENTINEL")])
        with self.assertRaises(DeploymentError) as raised:
            verify_service("https://candidate.example", open_url=opener, clock=FakeClock())
        self.assertNotIn("SECRET_SENTINEL", str(raised.exception))

    def test_wrong_health_json_fails(self):
        with self.assertRaisesRegex(DeploymentError, "unexpected status"):
            verify_service("https://candidate.example", open_url=QueueOpen([Response({"status": "bad"})]), clock=FakeClock())

    def test_readiness_503_fails(self):
        opener = QueueOpen([Response({"status": "ok"}), Response({"status": "ready"}, status=503)])
        with self.assertRaisesRegex(DeploymentError, "unexpected response"):
            verify_service("https://candidate.example", open_url=opener, clock=FakeClock())

    def test_non_html_root_fails(self):
        opener = QueueOpen([Response({"status": "ok"}), Response({"status": "ready"}), Response("ok", "text/plain")])
        with self.assertRaisesRegex(DeploymentError, "did not return HTML"):
            verify_service("https://candidate.example", include_root=True, open_url=opener, clock=FakeClock())

    def test_deadline_prevents_requests(self):
        opener = QueueOpen([])
        with self.assertRaisesRegex(DeploymentError, "deadline"):
            verify_service("https://candidate.example", open_url=opener, clock=FakeClock(10), deadline=10)

    def test_transient_failure_retries_within_one_phase_deadline(self):
        opener = QueueOpen([URLError("temporary"), *healthy()])
        clock = FakeClock()
        verify_service("https://candidate.example", open_url=opener, clock=clock, deadline=60)
        self.assertEqual(clock.sleeps, [5, 10])


if __name__ == "__main__":
    unittest.main()
