"""A1 collector: media attention via GDELT DOC 2.0 (free, keyless, GRUMPY).

GDELT rate-limits aggressively per IP (429s even on first requests from
residential IPs, July 2026). This collector is therefore designed for
GitHub Actions only, with 30s spacing and exponential backoff. timelinevol
returns coverage as a PERCENTAGE of all monitored articles from that
country - normalization GDELT does for us, which is why within-country
comparison over time is sound (and cross-country comparison is not).

Two query sets per country-language: mainstream (AI + governance terms) and
frontier (safety/risk phrases). Daily points; the builder aggregates monthly.

Usage:  python3 pipeline/v2/collect_gdelt.py 2026-07 24
"""

import sys
import time
import urllib.parse

from common import archive, config, fetch_json

SLEEP = 30  # seconds between requests - do not lower; GDELT will 429
MAX_RUNTIME_S = 40 * 60  # hard budget: archive whatever we have and exit


def build_query(lang_cfg: dict, fips: str, track: str) -> str:
    if track == "mainstream":
        gov = " OR ".join(lang_cfg["governance_terms"])
        q = f'"{lang_cfg["ai_term"]}" ({gov})'
    else:
        phrases = " OR ".join(f'"{p}"' for p in lang_cfg["frontier_terms"])
        q = f"({phrases})"
    return f"{q} sourcecountry:{fips}"


def fetch_timeline(query: str, months: int):
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc?query="
        + urllib.parse.quote(query)
        + f"&mode=timelinevol&timespan={months}months&format=json"
    )
    d = fetch_json(url, tries=3, base_wait=20)
    series = d.get("timeline", [{}])
    data = series[0].get("data", []) if series else []
    return url, data


def main(snapshot: str, months: int = 24) -> None:
    cfg = config()
    out = {"months": months, "countries": {}, "budget_exhausted": False}
    failures = []
    started = time.monotonic()

    for c in cfg["countries"]:
        iso, fips = c["iso2"], c["gdelt_fips"]
        out["countries"][iso] = {}
        for lang_cfg in c["languages"]:
            lang = lang_cfg["code"]
            for track in ("mainstream", "frontier"):
                if track == "frontier" and not lang_cfg["frontier_terms"]:
                    continue
                if time.monotonic() - started > MAX_RUNTIME_S:
                    out["budget_exhausted"] = True
                    failures.append(f"{iso}/{lang}/{track}: skipped, time budget exhausted")
                    continue
                query = build_query(lang_cfg, fips, track)
                print(f"  {iso}/{lang}/{track}: {query}")
                try:
                    url, data = fetch_timeline(query, months)
                    out["countries"][iso][f"{lang}_{track}"] = {
                        "query": query, "url": url, "points": len(data), "data": data,
                    }
                    print(f"    {len(data)} points")
                except Exception as e:
                    failures.append(f"{iso}/{lang}/{track}: {e}")
                    print(f"    FAILED: {e}")
                time.sleep(SLEEP)
        # archive incrementally so a killed step still leaves partial data
        archive(snapshot, "gdelt_a1", "multiple (see per-entry urls)", out)

    ref = archive(snapshot, "gdelt_a1", "multiple (see per-entry urls)", out)
    print(f"  archived {ref}")
    if failures:
        print(f"gdelt: {len(failures)} of the query set failed:")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)  # loud failure: reviewer decides whether partial data ships
    print("gdelt: done")


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 24)
