#!/usr/bin/env python3
"""Build a deterministic, provenance-gated validation-pilot snapshot."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_STATUSES = {"collection_pending", "empirical", "partially_reviewed", "illustrative"}
STAGES = {"Closed", "Latent", "Opening", "Open", "Closing"}
PILLARS = [
    ("observable_field_capacity", "Observable field capacity", "What research and institutional capacity can be observed in open records?"),
    ("political_receptivity", "Political receptivity", "Are policymakers paying attention and moving from discussion to action?"),
    ("public_momentum", "Public and media momentum", "Is governance-related attention broadening and persisting?"),
    ("policy_readiness", "Policy readiness", "Are credible ideas, champions, coalitions and implementation routes ready?"),
]


def load(path: str) -> Any:
    return json.loads((ROOT / path).read_text())


def canonical(value: Any) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def country_observations(normalized: dict, country: str, indicator_prefix: str | None = None) -> list[dict]:
    items = [item for item in normalized["observations"] if item["country"] == country]
    return [item for item in items if not indicator_prefix or item["indicator"].startswith(indicator_prefix)]


def evidence_from_observation(item: dict) -> dict:
    return {
        "id": item["id"], "label": item.get("label", item["indicator"].replace("_", " ").title()),
        "value": item.get("displayValue", "Data available"), "definition": item.get("definition", item["transformation"]),
        "source": item.get("source", "Open-data observation"), "sourceUrl": item.get("sourceUrl", ""),
        "period": item["period"], "confidence": item.get("confidence", "Pending"),
        "rawValue": item.get("rawValue"), "normalizedValue": item.get("normalizedValue"),
        "transformation": item.get("transformation", "No transformation recorded."),
        "coverageWarning": item.get("coverageWarning"),
        "provenanceReferences": item["inputObservationIds"], "status": item["status"],
    }


def component_rating(items: list[dict]) -> tuple[int | None, int, int]:
    ratings = [item.get("rubricRating") for item in items if item.get("rubricRating") is not None]
    if not ratings:
        return None, 0, 0
    total, maximum = sum(ratings), len(ratings) * 4
    return round(total / maximum * 100), total, maximum


def automated_stage(pillars: list[dict]) -> tuple[str, str]:
    scores = {pillar["id"]: pillar["score"] for pillar in pillars}
    capacity, political, momentum, readiness = scores["observable_field_capacity"], scores["political_receptivity"], scores["public_momentum"], scores["policy_readiness"]
    observed = sum(value is not None for value in scores.values())
    confidence = "Medium" if observed >= 3 else "Low"
    if capacity is not None and capacity >= 60 and political is not None and political >= 75 and readiness is not None and readiness >= 65 and momentum is not None and momentum >= 60:
        return "Open", confidence
    if political is not None and political >= 50 and readiness is not None and readiness >= 45:
        return "Opening", confidence
    if any(value is not None and value >= 40 for value in (political, momentum, readiness)):
        return "Latent", confidence
    return "Closed", "Low"


def build(snapshot: str = "2026-07", publication_mode: bool = False, write: bool = True) -> dict:
    countries = load("config/countries.json")
    normalized = load(f"data/normalized/{snapshot}/observations.json")
    reviews = load(f"data/reviewed/{snapshot}/assessments.json")
    manifest = load(f"data/manifests/{snapshot}.json")
    output = []
    prefix_map = {"observable_field_capacity":"field_", "political_receptivity":"political_", "public_momentum":"media_", "policy_readiness":"readiness_"}

    for country in countries:
        cid = country["id"]
        review = reviews["countries"][cid]
        all_obs = country_observations(normalized, cid)
        statuses = {item["status"] for item in all_obs} | {review["status"]}
        status = "collection_pending" if not all_obs else ("partially_reviewed" if review["stage"] is None else "empirical")
        pillars = []
        for pid, name, question in PILLARS:
            items = country_observations(normalized, cid, prefix_map[pid])
            score, rubric_total, rubric_max = component_rating(items)
            evidence = [evidence_from_observation(item) for item in items]
            missing = not items or any(item["missingData"] for item in items)
            pillars.append({
                "id": pid, "name": name, "question": question, "status": "collection_pending" if not items else status,
                "score": score, "scoreLabel": "Experimental pilot methodology" if score is not None else "Not scored",
                "rubricTotal": rubric_total, "rubricMaximum": rubric_max,
                "confidence": {"dataCoverage": "Pending" if not items else "Partial", "classificationQuality": "First-pass review", "expertAgreement": "Pending"},
                "trend": None, "note": "No observation is replaced with zero. This pillar is published only when its inputs are traceable.",
                "missingData": missing, "evidence": evidence,
            })

        momentum = []
        for item in all_obs:
            if item["indicator"] not in {"media_attention", "political_attention", "wikimedia_attention", "google_trends_context"}:
                continue
            momentum.append({
                "month": item["period"], "seriesType": item["indicator"], "rawMeasure": item["rawValue"],
                "indexedValue": item["normalizedValue"], "coverageWarning": item.get("coverageWarning"),
                "provenanceReferences": item["inputObservationIds"], "status": item["status"],
            })

        reviewed = review["stage"] in STAGES and review["reviewer"] and review["reviewDate"]
        proxy_stage, proxy_confidence = automated_stage(pillars)
        missing_pillars = [pillar["name"] for pillar in pillars if pillar["score"] is None]
        output.append({
            **country, "status": status, "stage": review["stage"] if reviewed else proxy_stage,
            "stageConfidence": "Reviewed" if reviewed else f"{proxy_confidence} · automated proxy",
            "summary": review.get("summary") if reviewed else f"Automated proxy: {proxy_stage.lower()} policy window based on {4-len(missing_pillars)} of four currently measurable pillars. Missing coverage lowers confidence.",
            "signal": review.get("signal") if reviewed else "Watch for changes in political activity and public attention as new monthly evidence is collected.",
            "missingIngredients": review.get("missingIngredients", []) if reviewed else missing_pillars, "lastUpdated": manifest["createdAt"],
            "expertReview": review["reviewer"] if reviewed else "Machine-generated; not expert reviewed",
            "lowDataWarning": "No empirical observations have been approved for this country." if not all_obs else None,
            "pillars": pillars, "momentum": sorted(momentum, key=lambda point: (point["month"], point["seriesType"])),
        })

    result = {
        "version": snapshot, "methodologyVersion": manifest["methodologyVersion"], "publishedAt": manifest["createdAt"][:10],
        "status": "collection_pending" if not normalized["observations"] else normalized["status"],
        "methodologyNote": "Open-data validation pilot. Synthetic observations are prohibited from publication.",
        "manifest": f"data/manifests/{snapshot}.json", "countries": output,
    }
    validate(result, publication_mode)
    if write:
        target = ROOT / "data/published/snapshot.json"
        target.write_text(canonical(result))
    return result


def validate(snapshot: dict, publication_mode: bool = False) -> None:
    assert snapshot["status"] in ALLOWED_STATUSES
    assert len(snapshot["countries"]) == 5
    seen = set()
    for country in snapshot["countries"]:
        assert country["id"] not in seen
        seen.add(country["id"])
        assert country["status"] in ALLOWED_STATUSES
        assert country["stage"] is None or country["stage"] in STAGES
        assert len(country["pillars"]) == 4
        if country["stage"] is not None:
            assert country["expertReview"] != "Not yet reviewed"
        for pillar in country["pillars"]:
            assert pillar["score"] is None or 0 <= pillar["score"] <= 100
            for item in pillar["evidence"]:
                assert item["provenanceReferences"]
                assert item["sourceUrl"].startswith("https://")
                assert item["status"] != "illustrative" if publication_mode else True
        for point in country["momentum"]:
            assert point["seriesType"] in {"media_attention", "political_attention", "wikimedia_attention", "google_trends_context"}
            assert point["provenanceReferences"]
            assert point["indexedValue"] is None or 0 <= point["indexedValue"] <= 100
            assert point["status"] != "illustrative" if publication_mode else True
    if publication_mode:
        assert snapshot["status"] != "illustrative"


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default="2026-07")
    parser.add_argument("--publication-mode", action="store_true")
    args = parser.parse_args()
    built = build(args.snapshot, args.publication_mode)
    print(f"Published {len(built['countries'])} provenance-gated country profiles")
