from __future__ import annotations

import argparse
import json
import urllib.parse

from .common import cache_response, fetch_json, failure, utc_now


def parse_articles(data: dict) -> list[dict]:
    """Deduplicate article results by URL while retaining the first archived record."""
    unique = {}
    for article in data.get("articles", []):
        stable_id = article.get("url") or article.get("url_mobile")
        if stable_id and stable_id not in unique:
            unique[stable_id] = article
    return list(unique.values())


def build_query(query: str, start: str, end: str, max_records: int = 250) -> str:
    params = {"query": query, "mode": "artlist", "format": "json", "maxrecords": str(max_records), "startdatetime": start, "enddatetime": end, "sort": "datedesc"}
    return "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(params)


def collect(country: str, snapshot: str, query: str, start: str, end: str) -> dict:
    url = build_query(query, start, end)
    request_log = {"source": "gdelt", "country": country, "url": url, "collectedAt": utc_now()}
    try:
        data, payload = fetch_json(url)
        cached = cache_response("gdelt", snapshot, country, payload)
        records = parse_articles(data)
        failures = []
        if len(data.get("articles", [])) >= 250:
            failures.append(failure("gdelt", country, "Result cap reached; split the collection interval before treating coverage as complete", False))
        return {"requests": [request_log], "files": [{"source": "gdelt", "country": country, **cached}], "failures": failures, "response": data, "records": records}
    except Exception as exc:
        return {"requests": [request_log], "files": [], "failures": [failure("gdelt", country, str(exc))]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("country")
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args()
    print(json.dumps(collect(args.country, args.snapshot, args.query, args.start, args.end), indent=2))
