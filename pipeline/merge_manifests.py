"""Merge independently collected source manifests into one deterministic snapshot."""
from __future__ import annotations

import argparse
import json

from pipeline.adapters.common import ROOT, canonical_json, utc_now


def merge(output: str, inputs: list[str]) -> dict:
    manifests = [json.loads((ROOT / "data/manifests" / f"{name}.json").read_text()) for name in inputs]
    result = {
        "snapshot": output, "createdAt": utc_now(), "methodologyVersion": "2026-07-proxy-v1",
        "configurationCommit": manifests[0]["configurationCommit"], "environment": manifests[0]["environment"],
        "adapters": [], "requests": [], "files": [], "documents": [], "series": [], "records": [], "failures": []
    }
    for manifest in manifests:
        for key in ("adapters", "requests", "files", "documents", "series", "records", "failures"):
            result[key].extend(manifest.get(key, []))
    result["adapters"] = list({item["id"]: item for item in result["adapters"]}.values())
    target = ROOT / "data/manifests" / f"{output}.json"
    target.write_bytes(canonical_json(result))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("inputs", nargs="+")
    args = parser.parse_args()
    result = merge(args.output, args.inputs)
    print(f"Merged {len(result['files'])} cached files and {len(result['failures'])} failures")
