# Methodology: the Plures AI Ecosystem Explorer

*Draft v0.2 — for review. Replaces the previous five-country pilot method.*

## What this tool measures, and why

Plures works on a hypothesis: in most countries whose main language is not English, AI governance is not yet a real topic. The talent pipeline is thin, the media hasn't caught up, and policymakers are not yet aware of — or worried about — what AI means for their country. Field-building in those places is cheap now and valuable later, because when a policy window opens (an election, a scandal, an international commitment), only countries with people, attention, and prepared policy ideas can use it.

That hypothesis borrows directly from Kingdon's policy-windows model: change happens when the problem stream, the policy stream, and the politics stream converge, and someone is standing there ready to couple them. The explorer maps the preconditions for that coupling across three observable dimensions:

1. **Talent** — is anyone in the country's universities and research institutions working on AI, and specifically on AI safety and governance?
2. **Attention** — has the topic reached the public conversation, in the local language?
3. **Policy** — is the government aware, and has it done any preparation?

The reading is simple. A country strong on all three is *window-ready*: when the moment comes, it can act — or Plures can help accelerate the moment. A country weak on one dimension has a **binding constraint**, and that constraint is the intervention target. A country weak on all three is greenfield: the highest-leverage place for early field-building, and exactly where this explorer should be pointing.

One thing this tool deliberately does not do: produce a single composite "readiness index." Composite indices are where credibility goes to die — they hide the judgment calls inside a weighted average and invite rankings the underlying data can't support. Each dimension is scored separately, on published rules, and the profile of the three together is the finding.

## Coverage

The G20: Argentina, Australia, Brazil, Canada, China, France, Germany, India, Indonesia, Italy, Japan, Mexico, Russia, Saudi Arabia, South Africa, South Korea, Türkiye, the United Kingdom, and the United States, plus the two member blocs (European Union, African Union) shown as contextual roll-ups rather than scored units. Nineteen countries is small enough to allow hand-curated indicators where automation fails, and large enough to make the cross-country contrasts meaningful. The set includes the natural control group (US, UK) that lets a reader verify the method finds high maturity where everyone knows it exists.

Each country is assigned a principal media language (or two: Canada en/fr, India en/hi, South Africa en/zu) used consistently across the attention indicators. The assignment table lives in `config/countries.json` and is frozen per snapshot.

## The two tracks

Every dimension is measured twice, on two deliberately separate tracks:

- **Mainstream track** — AI as a general topic: adoption, regulation, national strategies. Rich data, low noise. This tells you whether AI is on the country's radar at all.
- **Frontier track** — AI safety specifically: alignment, catastrophic risk, frontier-model governance. Sparse data — and the sparseness *is* the finding. A country with a thriving mainstream track and an empty frontier track is precisely the Plures opportunity profile.

The two tracks are never merged. A country page shows both, side by side.

## Dimension 1: Talent

*Question answered: is there a pipeline of people who could staff an AI governance ecosystem?*

| ID | Indicator | Track | Source | Cadence |
|----|-----------|-------|--------|---------|
| T1 | AI share of national research output | Mainstream | OpenAlex API | Monthly, automated |
| T2 | AI-safety research presence (works + distinct institutions) | Frontier | OpenAlex API | Monthly, automated |
| T3 | Field-building infrastructure (active university groups and orgs) | Frontier | Curated (EA Forum groups directory, AI safety landscape maps) | Quarterly, hand-verified |

**T1** counts works whose primary topic falls in OpenAlex's Artificial Intelligence subfield (`subfields/1702`), rolling three years, grouped by authorship country — then divides by the country's *total* works in the same window. The share, not the raw count, is the indicator: raw counts just measure country size and academic capacity. A country where 4% of all research output is AI has a different pipeline than one at 1%, regardless of absolute size.

**T2** runs a fixed, versioned query (`title_and_abstract.search` over a pinned term list: "AI safety", "AI alignment", "existential risk from artificial intelligence", "frontier model", "catastrophic risk" + AI, and translations where OpenAlex indexes them) grouped by country, reporting both works and distinct institutions. These numbers will be tiny outside the US/UK/China — single digits in most G20 countries. That is not a data problem. That is the map of where the field doesn't exist yet.

**T3** is honestly hand-curated: a quarterly count of active AI-safety university groups, EA groups with AI safety programming, and local orgs, from public directories, each entry archived with its source URL and access date. For nineteen countries this is an afternoon of work per quarter, and it captures the thing T1/T2 can't — whether anyone is *organizing* the pipeline, not just publishing in it.

OpenAlex is free, keyless, and rate-limited generously (100k calls/day in the polite pool with a `mailto` parameter). No scraping, no credentials, no terms-of-service gray zones.

## Dimension 2: Attention

*Question answered: has AI governance reached the public conversation, in the language people actually speak?*

| ID | Indicator | Track | Source | Cadence |
|----|-----------|-------|--------|---------|
| A1 | Media coverage intensity and 12-month acceleration | Both | GDELT DOC 2.0 API | Monthly, automated |
| A2 | Public search interest | Both | Google Trends | Monthly; manual export at MVP, API when alpha access granted |
| A3 | Wikipedia attention (language-community proxy) | Both | Wikimedia Pageviews API | Monthly, automated |

**A1** queries GDELT's DOC 2.0 API in each country's principal language, filtered by `sourcecountry`, in `timelinevol` mode — which returns coverage as a *percentage of all monitored articles from that country*, a normalization GDELT does for us and the reason cross-time comparison within a country is sound. Two query sets per country: local-language "artificial intelligence" + regulation/governance terms (mainstream), and local-language safety/risk terms (frontier). Scored on current level and 12-month acceleration. GDELT is free and keyless; the pipeline throttles to one request per ~5 seconds to stay inside its limits.

**A2** is Google Trends, and here the method is honest about a constraint: Trends has no free stable public API today. The official Trends API is in alpha (application open at developers.google.com/search/apis/trends — apply now; it offers 5 years of consistently-scaled data, exactly what this needs). Until access is granted, the MVP procedure is a documented manual export: a fixed set of queries (local-language equivalents of "AI risks" primary, "AI regulation" companion, pinned in `config/queries/`), exported as CSV from the Trends UI on a documented day each month, committed to the repo with the export date. Manual, but fully reproducible in the sense that matters: anyone can re-run the export and diff. Trends values are only ever interpreted *within* a country over time (level and acceleration), never compared across countries — Google's normalization makes cross-country level comparison meaningless.

**A3** is the fully-automated companion: monthly pageviews for a pinned basket of articles — *Artificial intelligence*, *AI safety*, *Existential risk from artificial general intelligence*, *AI alignment*, *Regulation of artificial intelligence*, and their interwiki equivalents — in each country's principal-language Wikipedia. The caveat is structural and stated on every chart: language communities are not countries (pt.wikipedia is Brazil *and* Portugal; es.wikipedia spans a continent), so A3 is labeled *language-community attention* and is corroborating evidence, never the headline. Its virtue is being the one attention source with a free, stable, unauthenticated API — the existence of a frontier-track article in a language at all (does *AI alignment* have an Indonesian article? how old? how big?) is itself a signal.

## Dimension 3: Policy

*Question answered: is the government aware, and has anyone prepared?*

| ID | Indicator | Track | Source | Cadence |
|----|-----------|-------|--------|---------|
| P1 | AI governance policy activity (count + recency of initiatives) | Mainstream | OECD.AI Policy Navigator, curated | Quarterly, hand-verified |
| P2 | Frontier-safety commitments checklist (0–5) | Frontier | Primary documents, hand-coded | Quarterly, hand-verified |
| P3 | Government AI readiness backdrop | Mainstream | Oxford Insights Government AI Readiness Index | Annual, ingested |

**P1** draws on the OECD.AI Policy Navigator — the best live repository of national AI policies, covering 80+ jurisdictions — which has no export API, so the pipeline treats it as a discovery source: a quarterly hand-curated snapshot per country (initiative count, most recent initiative date, initiative types), each entry carrying its OECD.AI URL and access date. Curation with provenance beats automation without it.

**P2** is a five-item binary checklist, hand-coded from primary documents only: *(1)* a national AI strategy exists; *(2)* official documents mention frontier, catastrophic, or existential AI risk; *(3)* the country signed the Bletchley Declaration or a successor; *(4)* it hosts an AI safety institute or belongs to the AISI network; *(5)* binding AI legislation is in force or in advanced passage. Each yes requires a linked primary source. This is the single most insightful policy indicator for the Plures question, and it costs nothing but attention.

**P3** ingests the annual Oxford Insights Government AI Readiness Index score as displayed context — the general-capacity backdrop against which the frontier signals are read. It is shown, attributed, and never re-scored or blended into our own tiers.

## Scoring: tiers, not numbers

Each dimension resolves to one of three published tiers — **Nascent**, **Emerging**, **Established** — via rules committed to `config/scoring/` and applied mechanically by the pipeline. Example shape (thresholds to be calibrated on the first real data pull, then frozen): T-dimension Established requires T1 above the G20 median *and* T2 ≥ 20 works *and* T3 ≥ 3 active groups; Nascent is falling below the floor on two of three. The rules will be wrong in interesting ways at first; they get one calibration pass on real data, a written justification per threshold, and then they freeze until a versioned methodology revision.

The country profile is the triple, on each track — e.g. Brazil: Talent *Emerging* / Attention *Emerging* / Policy *Established* on the mainstream track; *Nascent* across the board on the frontier track. The explorer surfaces the binding constraint (the lowest tier) as the suggested intervention entry point, and flags the archetypes the Plures hypothesis predicts: **mainstream-mature, frontier-empty** is the core opportunity profile.

Missing data is displayed as missing, never scored as zero. Every displayed number links to its archived raw observation.

## Reproducibility architecture

This is where the previous attempt failed, so the requirements are explicit:

1. **Frozen inputs.** Query terms, country/language assignments, article baskets, and scoring thresholds live in versioned config files. A snapshot references the config commit it was built from.
2. **Raw archives.** Every API response is stored as fetched (JSON, timestamped) in `data/raw/` before any transformation. Curated entries are JSON with source URL + access date. Nothing is scored that isn't archived.
3. **Deterministic build.** `snapshot.json` is built from archived raw inputs by a pure function — re-running the build on the same inputs is byte-identical.
4. **Automated cadence.** A monthly GitHub Actions workflow pulls the automated sources (OpenAlex, GDELT, Wikimedia), rebuilds, and opens a pull request — never publishing directly, so failures and anomalies are reviewed before deployment. Curated sources are updated quarterly by hand through the same PR route.
5. **Source health check.** `verify_sources.py` (stdlib-only, no keys) exercises every automated endpoint and doubles as the CI smoke test. If a source breaks, the workflow fails loudly and the previous published snapshot stands.
6. **Open by construction.** Repo public, licenses documented per source (OpenAlex CC0; GDELT free with attribution; Wikimedia CC BY-SA; Oxford Insights cited under its own terms; Google Trends data displayed under Google's attribution requirements).

## Known limitations, stated up front

English-language bias in scholarly indexing means T1/T2 undercount non-English work — partially mitigated by using shares and within-country trends, but real. Language-country mismatch limits A3 to corroboration. Trends data is UI-normalized and opaque; it is used only within-country and clearly labeled. Curated indicators (T3, P1, P2) involve judgment; the mitigation is provenance, not pretended automation. And tier thresholds encode choices; they are published, justified, and versioned so a critic can attack them specifically — which is the point of publishing a methodology at all.
