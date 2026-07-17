from __future__ import annotations

import hashlib
import json
import os
import platform
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def sha256(payload: bytes) -> str:
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def cache_response(source: str, snapshot: str, name: str, payload: bytes) -> dict[str, str]:
    folder = ROOT / "data" / "raw" / source / snapshot
    folder.mkdir(parents=True, exist_ok=True)
    digest = sha256(payload)
    target = folder / f"{name}-{digest.removeprefix('sha256:')[:12]}.json"
    if target.exists() and target.read_bytes() != payload:
        raise RuntimeError(f"Immutable cache collision at {target}")
    if not target.exists():
        target.write_bytes(payload)
    return {"path": str(target.relative_to(ROOT)), "checksum": digest}


def fetch_json(url: str, headers: dict[str, str] | None = None, timeout: int = 60) -> tuple[Any, bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": "ai-governance-validation-pilot/0.1", **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = response.read()
    return json.loads(payload), payload


def fetch_bytes(url: str, headers: dict[str, str] | None = None, timeout: int = 60) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "ai-governance-validation-pilot/0.1", **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return "unknown"


def environment() -> dict[str, str]:
    return {"python": platform.python_version(), "platform": platform.platform()}


def failure(source: str, country: str | None, reason: str, retryable: bool = True) -> dict[str, Any]:
    return {"source": source, "country": country, "reason": reason, "retryable": retryable, "recordedAt": utc_now()}
