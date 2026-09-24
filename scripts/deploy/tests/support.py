from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class CommandResult:
    stdout: str = ""
    returncode: int = 0


class FakeRunner:
    """Strict fake: every command must be explicitly queued."""

    def __init__(self) -> None:
        self.expected: list[tuple[list[str], CommandResult | Exception]] = []
        self.calls: list[list[str]] = []

    def expect(
        self,
        argv: list[str],
        *,
        stdout: str = "",
        returncode: int = 0,
        error: Exception | None = None,
    ) -> None:
        self.expected.append((argv, error or CommandResult(stdout, returncode)))

    def run(self, argv: list[str], *, timeout: float | None = None) -> CommandResult:
        self.calls.append(list(argv))
        if not self.expected:
            raise AssertionError(f"unexpected external command: {argv!r}")
        expected, result = self.expected.pop(0)
        if list(argv) != expected:
            raise AssertionError(f"expected {expected!r}, got {argv!r}")
        if isinstance(result, Exception):
            raise result
        return result

    def assert_done(self) -> None:
        if self.expected:
            raise AssertionError(f"unconsumed commands: {self.expected!r}")


class FakeClock:
    def __init__(self, start: float = 0.0) -> None:
        self.now = start
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class FakeHttp:
    def __init__(self) -> None:
        self.expected: list[tuple[str, Any | Exception]] = []
        self.calls: list[str] = []

    def expect(self, url: str, response: Any | None = None, error: Exception | None = None) -> None:
        self.expected.append((url, error or response))

    def __call__(self, url: str, **_: Any) -> Any:
        self.calls.append(url)
        if not self.expected:
            raise AssertionError(f"unexpected HTTP request: {url}")
        expected, result = self.expected.pop(0)
        if url != expected:
            raise AssertionError(f"expected {expected!r}, got {url!r}")
        if isinstance(result, Exception):
            raise result
        return result

    def assert_done(self) -> None:
        if self.expected:
            raise AssertionError(f"unconsumed HTTP requests: {self.expected!r}")


def fixture(value: Any) -> Callable[[], Any]:
    return lambda: value
