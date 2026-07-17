from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def precision(sample: list[dict]) -> float | None:
    reviewed = [item for item in sample if item.get("humanRelevant") is not None]
    predicted = [item for item in reviewed if item.get("predictedRelevant")]
    if not predicted:
        return None
    return sum(bool(item["humanRelevant"]) for item in predicted) / len(predicted)


def validation_report(snapshot: str) -> dict:
    published = json.loads((ROOT / "data/published/snapshot.json").read_text())
    manifest = json.loads((ROOT / f"data/manifests/{snapshot}.json").read_text())
    countries = []
    for country in published["countries"]:
        evidence = [item for pillar in country["pillars"] for item in pillar["evidence"]]
        countries.append({
            "country": country["id"], "status": country["status"], "stagePublished": country["stage"] is not None,
            "evidenceCount": len(evidence), "traceableEvidenceCount": sum(bool(item["provenanceReferences"]) for item in evidence),
            "momentumPointCount": len(country["momentum"]), "reviewed": country["expertReview"] != "Not yet reviewed",
        })
    return {
        "snapshot": snapshot, "methodologyVersion": published["methodologyVersion"],
        "reproducibility": {"manifestPresent": True, "configurationCommit": manifest["configurationCommit"]},
        "countries": countries, "failures": manifest["failures"],
        "gates": {"syntheticDataAbsent": published["status"] != "illustrative", "allClaimsTraceable": all(c["evidenceCount"] == c["traceableEvidenceCount"] for c in countries)},
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default="2026-07")
    parser.add_argument("--output")
    args = parser.parse_args()
    rendered = json.dumps(validation_report(args.snapshot), indent=2, sort_keys=True) + "\n"
    if args.output:
        Path(args.output).write_text(rendered)
    else:
        print(rendered, end="")
