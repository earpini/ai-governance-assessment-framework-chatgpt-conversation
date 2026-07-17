from __future__ import annotations

import argparse
import json
from pathlib import Path

from .common import ROOT, cache_response, fetch_bytes, failure, utc_now


def collect_curated(country: str, snapshot: str, input_path: str = "data/inputs/political_documents.json") -> dict:
    source_file = ROOT / input_path
    if not source_file.exists():
        return {"requests": [], "files": [], "failures": [failure("official_political_sources", country, f"Missing curated input {input_path}", False)], "documents": []}
    records = json.loads(source_file.read_text()).get("countries", {}).get(country, [])
    requests, files, failures, documents = [], [], [], []
    for record in records:
        url = record["url"]
        requests.append({"source": record["source"], "country": country, "url": url, "collectedAt": utc_now()})
        try:
            payload = fetch_bytes(url, timeout=record.get("retrievalTimeout", 15))
            cached = cache_response("political", snapshot, f"{country}-{record['id']}", payload)
            files.append({"source": record["source"], "country": country, **cached})
            documents.append({**record, "cachePath": cached["path"], "checksum": cached["checksum"]})
        except Exception as exc:
            failures.append(failure(record["source"], country, str(exc)))
    return {"requests": requests, "files": files, "failures": failures, "documents": documents}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("country")
    parser.add_argument("--snapshot", required=True)
    args = parser.parse_args()
    print(json.dumps(collect_curated(args.country, args.snapshot), indent=2))
