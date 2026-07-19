#!/usr/bin/env python3
"""Build and validate the static monthly policy-window snapshot.

The checked-in raw file is an illustrative cache fixture. Production adapters can
replace it without changing the published schema or web application.
"""
from __future__ import annotations
import json, math
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load(path: str):
    return json.loads((ROOT / path).read_text())

def months(count: int = 36):
    year, month = 2023, 8
    result = []
    for _ in range(count):
        result.append(f"{year}-{month:02d}")
        month += 1
        if month == 13: year, month = year + 1, 1
    return result

def momentum(seed: int, base: int, direction: str):
    result = []
    for i, month in enumerate(months()):
        drift = i * (0.8 if direction == "up" else 0.18)
        wave = math.sin((i + seed) / 3.2) * 7
        event = 14 if i in (22 + seed % 4, 31 + seed % 3) else 0
        search = max(8, min(100, round(base - 20 + drift + wave + event)))
        media = max(8, min(100, round(base - 25 + drift * .85 - wave * .45 + event * .7)))
        result.append({"month": month, "search": search, "media": media})
    return result

def evidence(label, value, definition, source, url, period, confidence="Medium"):
    return {"label":label,"value":value,"definition":definition,"source":source,"sourceUrl":url,"period":period,"confidence":confidence}

def build():
    countries = load("config/countries.json")
    raw = load("data/raw/observations.json")
    expert_file = load("data/expert/assessments.json")
    output = []
    for country in countries:
        cid = country["id"]
        obs, expert = raw["countries"][cid], expert_file["countries"][cid]
        field, political, public = obs["scores"]
        conf = "Low" if cid == "kenya" else ("Medium" if cid in ("india","mexico") else "High")
        pillars = [
          {"id":"field_capacity","name":"Field capacity","question":"Are capable and connected people present?","score":field,"confidence":conf,"trend":"up" if field>60 else "flat","note":"Research activity is combined with institutional diversity and recent growth; headcount alone does not determine capacity.","evidence":[evidence("Active research community",obs["metrics"]["authors"],"Unique authors with recent AI-governance-related work and a domestic affiliation.","OpenAlex","https://openalex.org/","2025–2026",conf),evidence("Institutional diversity",f"{max(4,round(field/7))} institutions","Organizations represented among the active research and practitioner sample.","OpenAlex + desk review","https://openalex.org/","2025–2026",conf)]},
          {"id":"political_receptivity","name":"Political receptivity","question":"Are policymakers aware and engaged?","score":political,"confidence":conf,"trend":obs["trend"],"note":"Initiatives are weighted by their movement from recognition toward authorization and implementation.","evidence":[evidence("Policy activity",obs["metrics"]["policy"],"Strategies, laws, consultations, institutions, and implementation actions tracked in the snapshot.","OECD.AI Policy Navigator","https://oecd.ai/en/dashboards/overview","2024–2026",conf),evidence("Institutional commitment",f"{round(political/20)} of 5 signals","Presence of a mandate, responsible institution, budget, timeline, and implementation evidence.","Official sources + review","https://oecd.ai/","2025–2026",conf)]},
          {"id":"public_momentum","name":"Public momentum","question":"Is attention rising and becoming durable?","score":public,"confidence":conf,"trend":obs["trend"],"note":"Search and media signals are indexed within country, emphasizing acceleration and persistence rather than raw volume.","evidence":[evidence("Search acceleration",obs["metrics"]["search"],"Change in governance-relevant search interest against the prior twelve-month baseline.","Google Trends","https://trends.google.com/trends/","Jul 2025–Jun 2026",conf),evidence("Media breadth",f"{max(6,round(public/5))} outlets","Distinct outlets in the illustrative governance-related media sample.","GDELT","https://www.gdeltproject.org/","Jul 2025–Jun 2026",conf)]},
          {"id":"policy_readiness","name":"Policy readiness","question":"Are credible ideas and routes ready to use?","score":expert["readiness"],"confidence":expert["confidence"],"trend":"up" if expert["readiness"]>=60 else "flat","note":"Structured review checks for a proposal, champion, institutional route, supporting coalition, and domestic evidence base.","evidence":[evidence("Readiness criteria",obs["metrics"]["readiness"],"Number of five structured readiness criteria supported by current evidence.","Structured expert review","https://oecd.ai/en/ai-principles","Reviewed 12 Jul 2026",expert["confidence"]),evidence("Stage review","Approved","A reviewer must approve any published change to the headline policy-window stage.","MVP review protocol","https://oecd.ai/en/ai-principles","12 Jul 2026",expert["confidence"])]}
        ]
        output.append({**country,"stage":expert["stage"],"stageConfidence":expert["confidence"],"summary":expert["summary"],"signal":expert["signal"],"missingIngredients":expert["missing"],"lastUpdated":"2026-07-12","expertReview":expert_file["reviewer"],"lowDataWarning":"Sparse local-language media and practitioner data; confidence is reduced." if cid=="kenya" else None,"pillars":pillars,"momentum":momentum(obs["seed"],public,obs["trend"])})
    snapshot = {"version":"2026.07","publishedAt":"12 Jul 2026","methodologyNote":"Illustrative pilot data generated from cached fixtures and structured review.","countries":output}
    validate(snapshot)
    target = ROOT / "data/published/snapshot.json"
    target.write_text(json.dumps(snapshot, indent=2) + "\n")
    print(f"Published {len(output)} validated country profiles to {target.relative_to(ROOT)}")

def validate(snapshot):
    assert snapshot["countries"], "At least one country is required"
    ids = set()
    for country in snapshot["countries"]:
        assert country["id"] not in ids, "Duplicate country id"
        ids.add(country["id"])
        assert country["stage"] in {"Closed","Latent","Opening","Open","Closing"}
        assert len(country["pillars"]) == 4
        assert len(country["momentum"]) == 36
        for pillar in country["pillars"]:
            assert 0 <= pillar["score"] <= 100
            assert pillar["evidence"]
            for item in pillar["evidence"]:
                assert item["sourceUrl"].startswith("https://")

if __name__ == "__main__": build()
