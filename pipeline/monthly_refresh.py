"""Credential-light monthly refresh used locally and by GitHub Actions."""
from __future__ import annotations

import argparse
import os
from datetime import date

from pipeline.adapters.common import ROOT
from pipeline.build_snapshot import build as publish
from pipeline.merge_manifests import merge
from pipeline.normalize.first_pass import build as normalize, pending_reviews
from pipeline.run_collection import run


def month_shift(year: int, month: int, delta: int) -> tuple[int, int]:
    value = year * 12 + month - 1 + delta
    return value // 12, value % 12 + 1


def refresh(snapshot: str | None = None) -> str:
    today = date.today()
    label = snapshot or f"{today.year:04d}-{today.month:02d}-proxy"
    end_year, end_month = month_shift(today.year, today.month, -1)
    start_year, start_month = month_shift(end_year, end_month, -11)
    start, end = f"{start_year:04d}-{start_month:02d}-01", f"{end_year:04d}-{end_month:02d}-28"
    manifests = []
    for source in ("wikimedia", "political"):
        source_label = f"{label}-{source}"
        run(source_label, start, end, {source})
        manifests.append(source_label)
    if os.getenv("OPENALEX_API_KEY"):
        source_label = f"{label}-openalex"
        run(source_label, start, end, {"openalex"})
        manifests.append(source_label)
    merge(label, manifests)
    normalized = normalize(label)
    normalized_target = ROOT / "data/normalized" / label / "observations.json"
    normalized_target.parent.mkdir(parents=True, exist_ok=True)
    from pipeline.adapters.common import canonical_json
    normalized_target.write_bytes(canonical_json(normalized))
    review_target = ROOT / "data/reviewed" / label / "assessments.json"
    review_target.parent.mkdir(parents=True, exist_ok=True)
    if not review_target.exists():
        review_target.write_bytes(canonical_json(pending_reviews()))
    publish(label, publication_mode=True)
    return label


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot")
    args = parser.parse_args()
    print(f"Published automated proxy snapshot {refresh(args.snapshot)}")
