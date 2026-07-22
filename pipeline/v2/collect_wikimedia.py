"""A3 collector: Wikipedia attention (free, keyless, stable API).

For the pinned English article basket, resolves each language edition's
actual title via English Wikipedia interlanguage links (never guess titles:
a guessed Portuguese title 404'd on an article that exists). For each
resolved article: sums monthly pageviews over the canonical title AND its
redirects (views split across redirect titles otherwise understate levels).
An article MISSING in a language is archived as such - absence is a
frontier-attention finding, not an error.

Usage:  python3 pipeline/v2/collect_wikimedia.py 2026-07 2024-07-01 2026-07-01
"""

import sys
import time
import urllib.parse

from common import archive, config, fetch_json

MAX_REDIRECTS = 10
SLEEP = 0.3  # polite pacing; Wikimedia allows 100 req/s but there is no rush


def langlinks(title: str) -> dict:
    url = (
        "https://en.wikipedia.org/w/api.php?action=query&titles="
        + urllib.parse.quote(title)
        + "&prop=langlinks&lllimit=500&format=json&redirects=1"
    )
    d = fetch_json(url)
    page = next(iter(d["query"]["pages"].values()))
    return url, {ll["lang"]: ll["*"] for ll in page.get("langlinks", [])}


def redirects(wiki: str, title: str) -> list:
    lang = wiki.split(".")[0]
    url = (
        f"https://{lang}.wikipedia.org/w/api.php?action=query&titles="
        + urllib.parse.quote(title)
        + "&prop=redirects&rdlimit=" + str(MAX_REDIRECTS) + "&format=json&redirects=1"
    )
    d = fetch_json(url)
    page = next(iter(d["query"]["pages"].values()))
    return [r["title"] for r in page.get("redirects", [])]


def monthly_views(wiki: str, title: str, start: str, end: str):
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = (
        f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{wiki}"
        f"/all-access/user/{t}/monthly/{start}/{end}"
    )
    try:
        d = fetch_json(url, tries=2)
        return {i["timestamp"][:6]: i["views"] for i in d.get("items", [])}
    except Exception:
        return {}  # article may exist but have no pageview rows in range


def main(snapshot: str, start_date: str, end_date: str) -> None:
    cfg = config()
    start = start_date.replace("-", "") + "00"
    end = end_date.replace("-", "") + "00"

    wikis = sorted({l["wiki"] for c in cfg["countries"] for l in c["languages"]})
    out = {"basket": {}, "wikis": wikis, "range": [start_date, end_date]}

    for en_title in cfg["wikipedia_articles_en"]:
        print(f"  resolving interlanguage links: {en_title}")
        ll_url, links = langlinks(en_title)
        time.sleep(SLEEP)
        entry = {"langlinks_url": ll_url, "languages": {}}
        for wiki in wikis:
            lang = wiki.split(".")[0]
            local = en_title if lang == "en" else links.get(lang)
            if local is None:
                entry["languages"][wiki] = {"exists": False}
                continue
            titles = [local]
            try:
                titles += redirects(wiki, local)
            except Exception as e:  # redirects are an enhancement, not a gate
                print(f"    redirects lookup failed for {wiki}/{local}: {e}")
            time.sleep(SLEEP)
            merged = {}
            for t in titles[: MAX_REDIRECTS + 1]:
                for month, views in monthly_views(wiki, t, start, end).items():
                    merged[month] = merged.get(month, 0) + views
                time.sleep(SLEEP)
            entry["languages"][wiki] = {
                "exists": True,
                "local_title": local,
                "titles_summed": len(titles[: MAX_REDIRECTS + 1]),
                "monthly_views": dict(sorted(merged.items())),
            }
            print(f"    {wiki}: {local} ({len(titles)} titles summed)")
        out["basket"][en_title] = entry

    ref = archive(snapshot, "wikimedia_a3", "multiple (see per-entry urls)", out)
    print(f"  archived {ref}")
    print("wikimedia: done")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
