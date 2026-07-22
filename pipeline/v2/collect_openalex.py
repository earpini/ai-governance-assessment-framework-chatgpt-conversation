"""T1 + T2 collector: research volume via OpenAlex (free, keyless).

T1 (mainstream): works in the AI subfield per authorship country, rolling
window, PLUS total works per country in the same window -> the builder
computes AI share of national output (shares, never raw counts: raw counts
mostly measure country size and local-journal volume).

T2 (frontier): works matching the pinned safety search per country. Small
numbers ARE the finding.

Three API calls total. Usage:  python3 pipeline/v2/collect_openalex.py 2026-07
"""

import sys
import urllib.parse

from common import archive, config, fetch_json, MAILTO


def group_by_country(filter_expr: str) -> str:
    return (
        "https://api.openalex.org/works?filter=" + filter_expr
        + "&group_by=authorships.countries&mailto=" + MAILTO
    )


def main(snapshot: str) -> None:
    cfg = config()
    oa = cfg["openalex"]

    calls = {
        "openalex_t1_ai_works": group_by_country(
            f"primary_topic.subfield.id:{oa['ai_subfield']},from_publication_date:{oa['t1_from']}"
        ),
        "openalex_t1_total_works": group_by_country(
            f"from_publication_date:{oa['t1_from']}"
        ),
        "openalex_t2_frontier_works": group_by_country(
            "title_and_abstract.search:"
            + urllib.parse.quote(oa["t2_search"])
            + f",from_publication_date:{oa['t2_from']}"
        ),
    }

    for name, url in calls.items():
        print(f"  fetching {name} ...")
        payload = fetch_json(url)
        ref = archive(snapshot, name, url, payload)
        n = len(payload.get("group_by", []))
        print(f"    archived {ref} ({n} country groups)")

    print("openalex: done")


if __name__ == "__main__":
    main(sys.argv[1])
