#!/usr/bin/env python3
"""Source health check for the Plures AI Ecosystem Explorer.

Exercises every automated data source in the methodology with real queries,
using only the Python standard library and no credentials. Run it locally:

    python3 verify_sources.py

Exit code 0 = all sources healthy. Also intended as the CI smoke test.
"""

import json
import sys
import time
import urllib.parse
import urllib.request

MAILTO = "ettore.arpini@gmail.com"  # OpenAlex polite pool
UA = f"plures-explorer-source-check (mailto:{MAILTO})"

# ISO alpha-2 codes as used by OpenAlex authorships.countries
G20_SAMPLE = ["BR", "ID", "DE", "MX", "TR", "ZA", "IN", "SA", "AR", "US"]

# GDELT sourcecountry accepts FIPS codes / names — NOT the same as ISO!
# (e.g. Germany is GM in FIPS). Names are less error-prone for a first check.
GDELT_SAMPLE = [
    ("brazil", '"inteligência artificial"'),
    ("indonesia", '"kecerdasan buatan"'),
    ("germany", '"künstliche Intelligenz"'),
]

WIKI_SAMPLE = [
    ("pt.wikipedia", "Inteligência_artificial"),
    ("id.wikipedia", "Kecerdasan_buatan"),
]

# Principal languages of the 19 covered countries (see config/countries.json)
G20_LANGS = ["es", "en", "pt", "fr", "zh", "de", "hi", "id", "it", "ja", "ru", "ar", "ko", "tr", "zu"]

results = []


def fetch_json(url: str, timeout: int = 30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def fetch_json_retry(url: str, tries: int = 4, base_wait: int = 15):
    """GDELT throttles aggressively per-IP (HTTP 429); back off and retry."""
    for attempt in range(tries):
        try:
            return fetch_json(url)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < tries - 1:
                wait = base_wait * (2 ** attempt)
                print(f"        (429 rate-limited, waiting {wait}s, attempt {attempt + 2}/{tries})")
                time.sleep(wait)
            else:
                raise


def check(name: str, fn):
    try:
        detail = fn()
        results.append((name, True, detail))
        print(f"  PASS  {name}: {detail}")
    except Exception as e:  # noqa: BLE001 - report every failure mode
        results.append((name, False, str(e)))
        print(f"  FAIL  {name}: {e}")


def openalex_t1():
    """T1: AI works (subfield 1702) since 2023, grouped by authorship country."""
    url = (
        "https://api.openalex.org/works"
        "?filter=primary_topic.subfield.id:subfields/1702,from_publication_date:2023-01-01"
        f"&group_by=authorships.countries&mailto={MAILTO}"
    )
    d = fetch_json(url)
    counts = {g["key"].rsplit("/", 1)[-1]: g["count"] for g in d["group_by"]}
    sample = {c: counts.get(c, 0) for c in G20_SAMPLE}
    assert sample["US"] > 1000, f"US count suspiciously low: {sample['US']}"
    return f"AI works by country {sample}"


def openalex_t2():
    """T2: frontier-track works since 2022, grouped by country."""
    terms = '"AI safety" OR "AI alignment" OR "existential risk from artificial intelligence"'
    url = (
        "https://api.openalex.org/works"
        f"?filter=title_and_abstract.search:{urllib.parse.quote(terms)},"
        "from_publication_date:2022-01-01"
        f"&group_by=authorships.countries&mailto={MAILTO}"
    )
    d = fetch_json(url)
    counts = {g["key"].rsplit("/", 1)[-1]: g["count"] for g in d["group_by"]}
    sample = {c: counts.get(c, 0) for c in G20_SAMPLE}
    return f"frontier works by country {sample}"


def gdelt(country: str, query: str):
    q = urllib.parse.quote(f"{query} sourcecountry:{country}")
    url = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
        f"?query={q}&mode=timelinevol&timespan=12months&format=json"
    )
    d = fetch_json_retry(url)
    series = d["timeline"][0]["data"]
    assert len(series) > 0, "empty timeline — check query/sourcecountry syntax"
    last = series[-1]
    return f"{len(series)} points, latest {last['date']}: {last['value']}% of monitored coverage"


def alignment_article_coverage():
    """Which language editions have an 'AI alignment' article at all?

    Resolved via English Wikipedia's interlanguage links, so absence is
    verified data (a frontier-track finding), not a guessed-title 404.
    """
    url = (
        "https://en.wikipedia.org/w/api.php?action=query&titles=AI%20alignment"
        "&prop=langlinks&lllimit=500&format=json&redirects=1"
    )
    d = fetch_json(url)
    page = next(iter(d["query"]["pages"].values()))
    links = {ll["lang"]: ll["*"] for ll in page.get("langlinks", [])}
    have = {l: links[l] for l in G20_LANGS if l in links}
    missing = [l for l in G20_LANGS if l not in links and l != "en"]
    return f"exists in {sorted(have)}; MISSING in {missing} (absence = frontier-attention finding)"


def wikimedia(project: str, article: str):
    url = (
        f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{project}"
        f"/all-access/user/{urllib.parse.quote(article)}/monthly/2025010100/2026070100"
    )
    d = fetch_json(url)
    items = d["items"]
    assert len(items) >= 6, f"only {len(items)} months returned"
    last = items[-1]
    return f"{len(items)} months, latest {last['timestamp'][:6]}: {last['views']} views"


def main():
    print("== OpenAlex (Talent: T1, T2) ==")
    check("OpenAlex T1 AI-works country group_by", openalex_t1)
    time.sleep(1)
    check("OpenAlex T2 frontier-search country group_by", openalex_t2)

    print("== GDELT DOC 2.0 (Attention: A1) ==")
    for country, query in GDELT_SAMPLE:
        time.sleep(10)  # GDELT throttles hard; retries with backoff handle 429s
        check(f"GDELT timelinevol {country}", lambda c=country, q=query: gdelt(c, q))

    print("== Wikimedia Pageviews (Attention: A3) ==")
    for project, article in WIKI_SAMPLE:
        time.sleep(1)
        check(f"Wikimedia {project}/{article}", lambda p=project, a=article: wikimedia(p, a))
    check("AI-alignment article coverage across G20 languages", alignment_article_coverage)

    failed = [name for name, ok, _ in results if not ok]
    print()
    print(f"{len(results) - len(failed)}/{len(results)} checks passed.")
    if failed:
        print("Failed:", ", ".join(failed))
        # Note: a missing frontier-track Wikipedia article is itself a finding,
        # not necessarily an infrastructure failure — read the error before panicking.
        sys.exit(1)


if __name__ == "__main__":
    main()
