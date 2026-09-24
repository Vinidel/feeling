#!/usr/bin/env python3
"""TLS HTTP checks used by the production deployment controller."""

from __future__ import annotations

import json
import ssl
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from deploy import Clock, DeploymentError, SystemClock


HttpOpen = Callable[..., Any]


def _read(
    open_url: HttpOpen,
    url: str,
    *,
    connect_timeout: float,
    request_timeout: float,
) -> tuple[int, str, str]:
    request = Request(url, headers={"User-Agent": "feeling-deployment-verifier/1"})
    context = ssl.create_default_context()
    try:
        with open_url(request, timeout=connect_timeout, context=context) as response:
            # urllib uses one timeout while connecting. Tighten the established socket to
            # the request/read contract when its standard response wrapper exposes it.
            socket = getattr(getattr(getattr(response, "fp", None), "raw", None), "_sock", None)
            if socket is not None:
                socket.settimeout(request_timeout)
            status = int(response.status)
            content_type = response.headers.get("Content-Type", "")
            body = response.read(64 * 1024).decode("utf-8", errors="replace")
            return status, content_type, body
    except (HTTPError, URLError, TimeoutError, OSError, ssl.SSLError) as exc:
        raise DeploymentError(f"HTTPS verification failed for {request.full_url}") from exc


def verify_json_endpoint(
    base_url: str,
    path: str,
    expected_status: str,
    *,
    open_url: HttpOpen = urlopen,
    connect_timeout: float = 5.0,
    request_timeout: float = 10.0,
) -> None:
    status, content_type, body = _read(
        open_url,
        base_url.rstrip("/") + path,
        connect_timeout=connect_timeout,
        request_timeout=request_timeout,
    )
    if status != 200 or "application/json" not in content_type.lower():
        raise DeploymentError(f"unexpected response from {path}")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise DeploymentError(f"invalid JSON from {path}") from exc
    if not isinstance(payload, dict) or payload.get("status") != expected_status:
        raise DeploymentError(f"unexpected status from {path}")


def verify_root(
    base_url: str,
    *,
    open_url: HttpOpen = urlopen,
    connect_timeout: float = 5.0,
    request_timeout: float = 10.0,
) -> None:
    status, content_type, _ = _read(
        open_url,
        base_url.rstrip("/") + "/",
        connect_timeout=connect_timeout,
        request_timeout=request_timeout,
    )
    if status != 200 or "text/html" not in content_type.lower():
        raise DeploymentError("public root did not return HTML")


def verify_service(
    base_url: str,
    *,
    include_root: bool = False,
    open_url: HttpOpen = urlopen,
    clock: Clock | None = None,
    deadline: float | None = None,
) -> None:
    if not base_url.startswith("https://"):
        raise DeploymentError("verification requires HTTPS")
    timer = clock or SystemClock()
    successful_rounds = 0
    while successful_rounds < 2:
        if deadline is not None and timer.monotonic() >= deadline:
            raise DeploymentError("health verification deadline exceeded")
        try:
            verify_json_endpoint(base_url, "/healthz", "ok", open_url=open_url)
            verify_json_endpoint(base_url, "/readyz", "ready", open_url=open_url)
            if include_root:
                verify_root(base_url, open_url=open_url)
            successful_rounds += 1
        except DeploymentError:
            successful_rounds = 0
            if deadline is None:
                raise
            remaining = deadline - timer.monotonic()
            if remaining <= 0:
                raise DeploymentError("health verification deadline exceeded")
            timer.sleep(min(5, remaining))
            continue
        if successful_rounds < 2:
            if deadline is not None and timer.monotonic() + 10 > deadline:
                raise DeploymentError("health verification deadline exceeded")
            timer.sleep(10)
