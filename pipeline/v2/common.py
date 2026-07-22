"""Shared helpers for the v2 collectors.

Design rules (see methodology/METHODOLOGY.md):
- Every API response is archived raw, as fetched, before any transformation.
- Collectors are credential-free; a mailto identifies us to OpenAlex's polite pool.
- Failures are loud: a collector that cannot fetch writes nothing and exits
  non-zero, so the previous published snapshot stands.
"""

import json
import os
import time
import urllib.error
import urllib.request

MAILTO = "ettore.arpini@gmail.com"
UA = f"plures-explorer-collector (mailto:{MAILTO}; +https://github.com/ettorearpini)"

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))


def config():
    with open(os.path.join(ROOT, "config", "v2", "countries.json"), encoding="utf-8") as f:
        return json.load(f)


def raw_dir(snapshot: str) -> str:
    d = os.path.join(ROOT, "data", "raw", snapshot)
    os.makedirs(d, exist_ok=True)
    return d


def fetch_json(url: str, timeout: int = 60, tries: int = 4, base_wait: int = 15):
    """GET a JSON URL with exponential backoff on 429/5xx."""
    last_err = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 500, 502, 503) and attempt < tries - 1:
                wait = base_wait * (2 ** attempt)
                print(f"    HTTP {e.code}, waiting {wait}s (attempt {attempt + 2}/{tries})")
                time.sleep(wait)
            else:
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = e
            if attempt < tries - 1:
                time.sleep(base_wait)
            else:
                raise
    raise last_err  # pragma: no cover


def archive(snapshot: str, name: str, url: str, payload) -> str:
    """Write a raw observation file and return its relative reference."""
    rec = {"fetched_url": url, "source_name": name, "payload": payload}
    rel = os.path.join("data", "raw", snapshot, f"{name}.json")
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rec, f, ensure_ascii=False, indent=1, sort_keys=True)
    return rel
