from __future__ import annotations

import json
import urllib.parse

from .common import ROOT, cache_response, fetch_json, failure, utc_now


def collect(country: str, snapshot: str, start: str, end: str) -> dict:
    spec = json.loads((ROOT / "config/queries/wikimedia.json").read_text())["countries"][country]
    article = urllib.parse.quote(spec["article"], safe="")
    url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{spec['project']}/all-access/user/{article}/monthly/{start}/{end}"
    request = {"source": "wikimedia_pageviews", "country": country, "url": url, "collectedAt": utc_now()}
    try:
        data, payload = fetch_json(url, timeout=30)
        cached = cache_response("wikimedia", snapshot, country, payload)
        series = [{"country": country, "timestamp": item["timestamp"], "views": item["views"], "article": spec["article"], "project": spec["project"], "cachePath": cached["path"], "checksum": cached["checksum"]} for item in data.get("items", [])]
        return {"requests": [request], "files": [{"source": "wikimedia_pageviews", "country": country, **cached}], "series": series, "failures": []}
    except Exception as exc:
        return {"requests": [request], "files": [], "series": [], "failures": [failure("wikimedia_pageviews", country, str(exc))]}
