from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.casefold()).strip()


def classify(country: str, text: str) -> dict:
    config = json.loads((ROOT / "config/queries/country_terms.json").read_text())
    terms = config["countries"][country]
    haystack = normalize(text)
    matches = {basket: [term for term in terms[basket] if normalize(term) in haystack] for basket in ("ai", "governance", "issues")}
    relevant = bool(matches["ai"] and (matches["governance"] or matches["issues"]))
    return {"relevant": relevant, "matches": matches, "queryVersion": config["version"], "queryStatus": config["status"]}
