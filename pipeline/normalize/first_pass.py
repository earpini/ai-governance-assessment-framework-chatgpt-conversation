"""Create a partial empirical snapshot from successfully archived official documents."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.adapters.common import ROOT, canonical_json

STAGE_RATING = {"recognition": 1, "agenda_entry": 2, "formulation": 3, "authorization": 4, "implementation": 4}


def build(snapshot: str) -> dict:
    manifest = json.loads((ROOT / f"data/manifests/{snapshot}.json").read_text())
    observations = []
    openalex_by_country = {}
    for record in manifest.get("records", []):
        if record.get("_source") == "openalex":
            openalex_by_country.setdefault(record["_country"], []).append(record)
    for country, records in openalex_by_country.items():
        authors = {
            author.get("author", {}).get("id")
            for record in records for author in record.get("authorships", [])
            if author.get("author", {}).get("id")
        }
        institutions = {
            institution.get("id")
            for record in records for author in record.get("authorships", [])
            for institution in author.get("institutions", [])
            if institution.get("id")
        }
        open_count = sum(1 for record in records if record.get("open_access", {}).get("is_oa"))
        metrics = (
            ("field_publications", "Relevant publications", len(records), "works", (5, 15, 40)),
            ("field_active_authors", "Active research authors", len(authors), "authors", (10, 30, 80)),
            ("field_institutions", "Research institutions", len(institutions), "institutions", (3, 8, 20)),
            ("field_open_access", "Open-access share", round(open_count / len(records) * 100, 1), "%", (25, 50, 75)),
        )
        provenance = [f"openalex:{country}:{record['id'].split('/')[-1]}" for record in records]
        period = max((record.get("publication_date") or "")[:7] for record in records)
        for indicator, label, value, unit, thresholds in metrics:
            rating = 1 + sum(value >= threshold for threshold in thresholds)
            observations.append({
                "id": f"openalex-{country}-{indicator}", "country": country, "indicator": indicator,
                "label": label, "period": period, "rawValue": value, "normalizedValue": rating / 4 * 100,
                "displayValue": f"{value:,}{unit if unit == '%' else ' ' + unit}",
                "transformation": f"Raw OpenAlex measure mapped to the pilot 0–4 rubric using thresholds {thresholds}.",
                "definition": "Observable research capacity retrieved from works with a domestic institutional affiliation.",
                "source": "OpenAlex API", "sourceUrl": "https://openalex.org/",
                "inputObservationIds": provenance, "rubricRating": rating, "missingData": False,
                "confidence": "Empirical API result; relevance depends on the preregistered multilingual query.",
                "coverageWarning": "Does not measure civil servants, advocates, journalists, or unaffiliated practitioners.", "status": "empirical"
            })
    for document in manifest.get("documents", []):
        country = next(item["country"] for item in manifest["files"] if item["path"] == document["cachePath"])
        raw_id = f"official:{country}:{document['id']}:{document['checksum'][:12]}"
        observations.append({
            "id": f"political-{country}-{document['id']}",
            "country": country,
            "indicator": f"political_initiative_{document['id']}",
            "label": document["title"],
            "period": document["publicationDate"][:7],
            "rawValue": 1,
            "normalizedValue": None,
            "displayValue": document["pipelineStage"].replace("_", " ").title(),
            "transformation": "No cross-country normalization; document coded with the pilot 0–4 pipeline-stage rubric.",
            "definition": f"Official {document['documentType'].replace('_', ' ')} coded as {document['pipelineStage'].replace('_', ' ')}.",
            "source": document["source"],
            "sourceUrl": document["url"],
            "inputObservationIds": [raw_id],
            "rubricRating": STAGE_RATING[document["pipelineStage"]],
            "missingData": False,
            "confidence": "Primary source archived; classification requires second review",
            "coverageWarning": "Curated first pass; not a complete census of political activity.",
            "status": "partially_reviewed"
        })
    by_country_documents = {}
    for document in manifest.get("documents", []):
        country = next(item["country"] for item in manifest["files"] if item["path"] == document["cachePath"])
        by_country_documents.setdefault(country, []).append(document)
    for country, documents in by_country_documents.items():
        provenance = [f"official:{country}:{doc['id']}:{doc['checksum'][:12]}" for doc in documents]
        url = documents[0]["url"]
        source = "Automated extraction from archived official records"
        criteria = {
            "concrete_proposal": max(4 if doc["documentType"] in {"bill", "guidelines", "strategy", "implementation_roadmap"} else 2 for doc in documents),
            "credible_champion": 3 if any(doc.get("institution") for doc in documents) else 0,
            "institutional_route": max(STAGE_RATING[doc["pipelineStage"]] for doc in documents),
            "supporting_coalition": max(3 if doc["documentType"] in {"consultation", "strategy", "guidelines"} else 1 for doc in documents),
            "domestic_evidence_base": max(3 if doc["documentType"] in {"guidelines", "implementation_roadmap"} else 1 for doc in documents),
        }
        for criterion, rating in criteria.items():
            observations.append({
                "id": f"readiness-{country}-{criterion}", "country": country, "indicator": f"readiness_{criterion}",
                "label": criterion.replace("_", " ").title(), "period": max(doc["publicationDate"] for doc in documents)[:7],
                "rawValue": rating, "normalizedValue": rating / 4 * 100, "displayValue": f"{rating}/4 automated proxy",
                "transformation": "Deterministic document-feature rubric; maximum supported rating across archived official records.",
                "definition": "Machine-inferred policy-readiness component. It is not an expert judgment.", "source": source, "sourceUrl": url,
                "inputObservationIds": provenance, "rubricRating": rating, "missingData": False,
                "confidence": "Automated proxy; confidence limited by source coverage", "coverageWarning": "Only successfully archived official records contribute.", "status": "empirical"
            })

    by_country_series = {}
    for point in manifest.get("series", []):
        by_country_series.setdefault(point["country"], []).append(point)
    for country, points in by_country_series.items():
        points.sort(key=lambda item: item["timestamp"])
        maximum = max((item["views"] for item in points), default=0)
        for point in points:
            month = f"{point['timestamp'][:4]}-{point['timestamp'][4:6]}"
            observations.append({
                "id": f"wikimedia-{country}-{month}", "country": country, "indicator": "wikimedia_attention", "label": f"Wikipedia views: {point['article']}",
                "period": month, "rawValue": point["views"], "normalizedValue": round(point["views"] / maximum * 100, 2) if maximum else None,
                "displayValue": f"{point['views']:,} monthly views", "transformation": "Indexed to the highest monthly value in the retrieved country series.",
                "definition": "Monthly views of the principal local-language Wikipedia article about artificial intelligence.", "source": "Wikimedia Pageviews API",
                "sourceUrl": f"https://{point['project']}/wiki/{point['article']}", "inputObservationIds": [f"wikimedia:{country}:{point['checksum'][:12]}"],
                "rubricRating": None, "missingData": False, "confidence": "Empirical pageview count; contextual proxy for general public attention",
                "coverageWarning": "General AI attention, not specifically support for AI regulation.", "status": "empirical"
            })
        latest = points[-1]
        latest_index = round(latest["views"] / maximum * 100, 2) if maximum else 0
        rating = 4 if latest_index >= 80 else 3 if latest_index >= 60 else 2 if latest_index >= 40 else 1
        observations.append({
            "id": f"context-{country}-wikimedia-current", "country": country, "indicator": "context_wikimedia_attention_current", "label": "Contextual AI-interest signal",
            "period": f"{latest['timestamp'][:4]}-{latest['timestamp'][4:6]}", "rawValue": latest["views"], "normalizedValue": latest_index,
            "displayValue": f"{latest['views']:,} Wikipedia views", "transformation": "Latest month as a percentage of the country-series peak; mapped to the 0–4 pilot rubric.",
            "definition": "General AI-interest context from the principal local-language AI article. It is not the public-attention score.", "source": "Wikimedia Pageviews API",
            "sourceUrl": f"https://{latest['project']}/wiki/{latest['article']}", "inputObservationIds": [f"wikimedia:{country}:{latest['checksum'][:12]}"],
            "rubricRating": None, "missingData": False, "confidence": "Empirical but indirect context", "coverageWarning": "Not a media-volume, geography-specific, or governance-specific measure; not used for the public-attention score.", "status": "empirical"
        })
    return {"snapshot": snapshot, "methodologyVersion": manifest["methodologyVersion"], "status": "partially_reviewed" if observations else "collection_pending", "observations": observations}


def pending_reviews() -> dict:
    criteria = {name: {"rating": None, "citations": [], "rationale": None} for name in ("concreteProposal", "credibleChampion", "institutionalRoute", "supportingCoalition", "domesticEvidenceBase")}
    return {"status": "collection_pending", "countries": {country: {"status": "collection_pending", "criteria": criteria, "reviewer": None, "reviewDate": None, "stage": None, "summary": None, "signal": None, "missingIngredients": [], "disagreementStatus": "not_reviewed", "adjudication": None} for country in ("brazil", "germany", "india", "kenya", "mexico")}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True)
    args = parser.parse_args()
    output = build(args.snapshot)
    target = ROOT / "data/normalized" / args.snapshot / "observations.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(canonical_json(output))
    review_target = ROOT / "data/reviewed" / args.snapshot / "assessments.json"
    review_target.parent.mkdir(parents=True, exist_ok=True)
    if not review_target.exists():
        review_target.write_bytes(canonical_json(pending_reviews()))
    print(f"Normalized {len(output['observations'])} archived official documents")
