from __future__ import annotations

import argparse
import json
import os
import urllib.parse
from datetime import date
from pathlib import Path

from .common import ROOT, cache_response, fetch_json, failure, utc_now

COUNTRY_CODES = {"brazil": "BR", "germany": "DE", "india": "IN", "kenya": "KE", "mexico": "MX"}


def parse_works(data: dict) -> list[dict]:
    """Return only records with stable IDs; raw records remain unchanged in cache."""
    return [work for work in data.get("results", []) if work.get("id")]


def build_query(country: str, start: str, end: str, api_key: str) -> str:
    config = json.loads((ROOT / "config/queries/openalex.json").read_text())
    search = " ".join(config["ai_terms"] + [term for terms in config["governance_topics"].values() for term in terms])
    params = {
        "api_key": api_key,
        "search": search,
        "filter": f"institutions.country_code:{COUNTRY_CODES[country]},from_publication_date:{start},to_publication_date:{end}",
        "select": "id,doi,title,publication_date,language,open_access,authorships,primary_topic",
        "per_page": "100",
        "cursor": "*",
    }
    return "https://api.openalex.org/works?" + urllib.parse.urlencode(params)


def collect(country: str, snapshot: str, start: str, end: str, api_key: str | None = None) -> dict:
    key = api_key or os.getenv("OPENALEX_API_KEY")
    if not key:
        return {"requests": [], "files": [], "failures": [failure("openalex", country, "OPENALEX_API_KEY is not configured", False)]}
    url = build_query(country, start, end, key)
    request_log = {"source": "openalex", "country": country, "url": url.replace(key, "[REDACTED]"), "collectedAt": utc_now()}
    try:
        data, payload = fetch_json(url)
        cached = cache_response("openalex", snapshot, country, payload)
        return {"requests": [request_log], "files": [{"source": "openalex", "country": country, **cached}], "failures": [], "response": data, "records": parse_works(data)}
    except Exception as exc:
        return {"requests": [request_log], "files": [], "failures": [failure("openalex", country, str(exc))]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("country", choices=COUNTRY_CODES)
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    args = parser.parse_args()
    print(json.dumps(collect(args.country, args.snapshot, args.start, args.end), indent=2))
