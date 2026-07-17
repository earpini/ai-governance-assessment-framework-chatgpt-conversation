#!/usr/bin/env python3
"""Run live source adapters and write a complete source manifest.

This command never publishes. Review, normalization and publication are separate gates.
"""
from __future__ import annotations

import argparse
import json

from pipeline.adapters.common import ROOT, canonical_json, environment, git_commit, utc_now
from pipeline.adapters.gdelt import collect as collect_gdelt
from pipeline.adapters.openalex import collect as collect_openalex
from pipeline.adapters.political import collect_curated
from pipeline.adapters.wikimedia import collect as collect_wikimedia

COUNTRIES = ["brazil", "germany", "india", "kenya", "mexico"]
GDELT_CODES = {"brazil":"BR", "germany":"GM", "india":"IN", "kenya":"KE", "mexico":"MX"}


def gdelt_query(country: str) -> str:
    terms = json.loads((ROOT / "config/queries/country_terms.json").read_text())["countries"][country]
    ai = " OR ".join(f'\"{term}\"' for term in terms["ai"])
    governance = " OR ".join(f'\"{term}\"' for term in terms["governance"] + terms["issues"])
    return f"({ai}) ({governance}) sourcecountry:{GDELT_CODES[country]}"


def run(snapshot: str, start: str, end: str, sources: set[str]) -> dict:
    manifest = {
        "snapshot": snapshot, "createdAt": utc_now(), "methodologyVersion": "2026-07-pilot-v1",
        "configurationCommit": git_commit(), "environment": environment(), "adapters": [],
        "requests": [], "files": [], "documents": [], "series": [], "records": [], "failures": [],
    }
    for source in sorted(sources):
        manifest["adapters"].append({"id":source,"version":"2026-07-pilot-v1","status":"run"})
    for country in COUNTRIES:
        results = []
        if "openalex" in sources:
            results.append(collect_openalex(country, snapshot, start[:10], end[:10]))
        if "gdelt" in sources:
            results.append(collect_gdelt(country, snapshot, gdelt_query(country), start, end))
        if "political" in sources:
            results.append(collect_curated(country, snapshot))
        if "wikimedia" in sources:
            results.append(collect_wikimedia(country, snapshot, start.replace("-", "") + "00", end.replace("-", "") + "00"))
        for result in results:
            manifest["requests"].extend(result["requests"])
            manifest["files"].extend(result["files"])
            manifest["documents"].extend(result.get("documents", []))
            manifest["series"].extend(result.get("series", []))
            source_files = result.get("files", [])
            source_id = source_files[0]["source"] if source_files else None
            checksum = source_files[0].get("checksum") if source_files else None
            manifest["records"].extend({**record, "_country": country, "_source": source_id, "_checksum": checksum} for record in result.get("records", []))
            manifest["failures"].extend(result["failures"])
    target = ROOT / "data/manifests" / f"{snapshot}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(canonical_json(manifest))
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--start", required=True, help="Use YYYY-MM-DD for OpenAlex or YYYYMMDDHHMMSS for GDELT")
    parser.add_argument("--end", required=True)
    parser.add_argument("--sources", default="openalex,gdelt,political")
    args = parser.parse_args()
    selected = set(args.sources.split(","))
    unknown = selected - {"openalex", "gdelt", "political", "wikimedia"}
    if unknown:
        raise SystemExit(f"Unknown sources: {', '.join(sorted(unknown))}")
    result = run(args.snapshot, args.start, args.end, selected)
    print(json.dumps({"requests":len(result["requests"]),"files":len(result["files"]),"failures":len(result["failures"])}, indent=2))
