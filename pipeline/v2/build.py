"""Deterministic snapshot builder.

Pure function from archived inputs to data/published/snapshot_v2.json:
same inputs -> byte-identical output (sorted keys, fixed indent, no
timestamps beyond the snapshot id passed on the command line).

Inputs:  data/raw/<snapshot>/openalex_*.json, wikimedia_a3.json, gdelt_a1.json
         data/curated/{frontier_checklist,field_building,policy_activity}.json
         config/v2/{countries,scoring}.json
Rules:   missing data is surfaced as insufficient_data, never scored as zero;
         every dimension block carries provenance references.

Usage:   python3 pipeline/v2/build.py 2026-07
"""

import json
import os
import statistics
import sys

from common import ROOT, config

TIERS = ["Nascent", "Emerging", "Established"]

# English article whose per-language existence gates frontier attention
ALIGNMENT_ARTICLE = "AI alignment"
DIMENSIONS = ["talent", "attention", "policy"]


def load(rel):
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def country_counts(raw):
    """OpenAlex group_by -> {ISO2: count}. Keys may be bare or URL-prefixed."""
    return {
        g["key"].rsplit("/", 1)[-1].upper(): g["count"]
        for g in raw["payload"].get("group_by", [])
    }


def monthly_means(daily_points):
    """GDELT daily timelinevol points -> {YYYYMM: mean %}."""
    buckets = {}
    for p in daily_points:
        month = p["date"][:6]
        buckets.setdefault(month, []).append(p["value"])
    return {m: sum(v) / len(v) for m, v in sorted(buckets.items())}


def trend_ratio(monthly):
    """Mean of last 12 months over mean of the 12 before; None if <18 months."""
    months = sorted(monthly)
    if len(months) < 18:
        return None
    recent = [monthly[m] for m in months[-12:]]
    prior = [monthly[m] for m in months[-24:-12]] or [monthly[m] for m in months[:-12]]
    prior_mean = sum(prior) / len(prior)
    if prior_mean == 0:
        return None
    return round((sum(recent) / len(recent)) / prior_mean, 3)


def tier_talent_mainstream(share, median_share, rules):
    if share is None or median_share is None:
        return None
    if share >= rules["established_min_share_of_median"] * median_share:
        return "Established"
    if share < rules["nascent_max_share_of_median"] * median_share:
        return "Nascent"
    return "Emerging"


def tier_talent_frontier(t2, t3_total, rules):
    if t2 is None or t3_total is None:
        return None
    if t2 >= rules["established"]["t2_min"] and t3_total >= rules["established"]["t3_min"]:
        return "Established"
    if t2 <= rules["nascent"]["t2_max"] and t3_total <= rules["nascent"]["t3_max"]:
        return "Nascent"
    return "Emerging"


def tier_attention(ratio, rules, negligible=False, article_missing=False):
    if ratio is None:
        return None
    if negligible or article_missing:
        return "Nascent"
    if ratio >= rules["established_min_ratio"]:
        return "Established"
    if ratio <= rules.get("nascent_max_ratio", 0):
        return "Nascent"
    return "Emerging"


def binding_constraint(tiers_by_dimension):
    """Lowest-tier dimension; None if any dimension lacks a tier."""
    ranked = {}
    for dim, tier in tiers_by_dimension.items():
        if tier is None:
            return None
        ranked[dim] = TIERS.index(tier)
    low = min(ranked.values())
    # deterministic order on ties
    return sorted(d for d, r in ranked.items() if r == low)[0]


def main(snapshot):
    cfg = config()
    scoring = load("config/v2/scoring.json")
    curated = {
        "p2": load("data/curated/frontier_checklist.json"),
        "t3": load("data/curated/field_building.json"),
        "p1": load("data/curated/policy_activity.json"),
    }
    rawdir = f"data/raw/{snapshot}"
    raw = {
        "ai": load(f"{rawdir}/openalex_t1_ai_works.json"),
        "total": load(f"{rawdir}/openalex_t1_total_works.json"),
        "t2": load(f"{rawdir}/openalex_t2_frontier_works.json"),
        "wiki": load(f"{rawdir}/wikimedia_a3.json"),
        "gdelt": load(f"{rawdir}/gdelt_a1.json"),
    }

    ai = country_counts(raw["ai"]) if raw["ai"] else None
    total = country_counts(raw["total"]) if raw["total"] else None
    t2 = country_counts(raw["t2"]) if raw["t2"] else None

    # T1 shares and the in-snapshot G20 median share
    shares = {}
    if ai and total:
        for c in cfg["countries"]:
            iso = c["iso2"]
            if total.get(iso):
                shares[iso] = round(ai.get(iso, 0) / total[iso], 5)
    median_share = round(statistics.median(shares.values()), 5) if shares else None

    countries = {}
    for c in cfg["countries"]:
        iso = c["iso2"]
        prov = {"curated": [
            "data/curated/frontier_checklist.json",
            "data/curated/field_building.json",
            "data/curated/policy_activity.json",
        ], "raw": sorted(
            f"{rawdir}/{n}.json" for n, r in {
                "openalex_t1_ai_works": raw["ai"], "openalex_t1_total_works": raw["total"],
                "openalex_t2_frontier_works": raw["t2"], "wikimedia_a3": raw["wiki"],
                "gdelt_a1": raw["gdelt"],
            }.items() if r
        )}

        # ---- Talent
        t3rec = curated["t3"]["countries"][iso]
        t3_total = t3rec["count_orgs"] + t3rec["count_university_groups"]
        talent = {
            "mainstream": {
                "t1_ai_works": ai.get(iso) if ai else None,
                "t1_total_works": total.get(iso) if total else None,
                "t1_ai_share": shares.get(iso),
                "g20_median_share": median_share,
                "tier": tier_talent_mainstream(
                    shares.get(iso), median_share, scoring["talent"]["mainstream"]),
                "insufficient_data": shares.get(iso) is None,
            },
            "frontier": {
                "t2_works": t2.get(iso, 0) if t2 else None,
                "t3_orgs": t3rec["count_orgs"],
                "t3_university_groups": t3rec["count_university_groups"],
                "t3_capped": t3rec["capped"],
                "tier": tier_talent_frontier(
                    t2.get(iso, 0) if t2 else None, t3_total, scoring["talent"]["frontier"]),
                "insufficient_data": t2 is None,
            },
        }

        # ---- Attention
        attention = {}
        principal_wiki = c["languages"][0]["wiki"]
        article_missing = None
        if raw["wiki"]:
            basket = raw["wiki"]["payload"]["basket"]
            article_missing = not basket.get(ALIGNMENT_ARTICLE, {}) \
                .get("languages", {}).get(principal_wiki, {}).get("exists", False)
        for track in ("mainstream", "frontier"):
            rules = scoring["attention"][track]
            entry = {"tier": None, "insufficient_data": True}
            if raw["gdelt"]:
                key = f"{c['languages'][0]['code']}_{track}"
                series = raw["gdelt"]["payload"]["countries"].get(iso, {}).get(key)
                if series and series["data"]:
                    monthly = monthly_means(series["data"])
                    ratio = trend_ratio(monthly)
                    latest = monthly[sorted(monthly)[-1]] if monthly else None
                    negligible = (
                        track == "frontier" and latest is not None
                        and latest < rules["nascent_if_negligible_coverage_below_pct"]
                    )
                    entry = {
                        "a1_latest_month_pct": latest,
                        "a1_trend_ratio": ratio,
                        "tier": tier_attention(
                            ratio, rules, negligible=negligible,
                            article_missing=(
                                track == "frontier"
                                and rules.get("alignment_article_required_for_established")
                                and bool(article_missing)
                            ),
                        ),
                        "insufficient_data": ratio is None,
                    }
            if track == "frontier":
                entry["alignment_article_exists_in_principal_language"] = (
                    None if article_missing is None else not article_missing)
            attention[track] = entry

        # ---- Policy
        p1rec = curated["p1"]["countries"][iso]
        p2rec = curated["p2"]["countries"][iso]
        pf = scoring["policy"]["frontier"]
        p2_tier = ("Nascent" if p2rec["score"] <= pf["nascent_max"]
                   else "Emerging" if p2rec["score"] <= pf["emerging_max"]
                   else "Established")
        policy = {
            "mainstream": {
                "p1_oecd_initiative_count": p1rec["oecd_initiative_count"],
                "p1_activity_level": p1rec["activity_level"],
                "p1_latest_initiative": p1rec["latest_initiative"],
                "tier": scoring["policy"]["mainstream"]["map"][p1rec["activity_level"]],
                "insufficient_data": False,
            },
            "frontier": {
                "p2_score": p2rec["score"],
                "p2_items": {k: v["value"] for k, v in sorted(p2rec["items"].items())},
                "tier": p2_tier,
                "insufficient_data": False,
            },
        }

        blocks = {"talent": talent, "attention": attention, "policy": policy}
        countries[iso] = {
            "name": c["name"],
            **blocks,
            "binding_constraint": {
                track: binding_constraint({d: blocks[d][track]["tier"] for d in DIMENSIONS})
                for track in ("mainstream", "frontier")
            },
            "provenance": prov,
        }

    out = {
        "snapshot": snapshot,
        "schema_version": 2,
        "provisional_thresholds": not scoring["calibrated"],
        "tier_order": TIERS,
        "countries": countries,
    }
    rel = "data/published/snapshot_v2.json"
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print(f"built {rel} ({len(countries)} countries)")


if __name__ == "__main__":
    main(sys.argv[1])
