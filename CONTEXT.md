# Project Context & Handoff — Plures AI Ecosystem Explorer

*Last updated: 2026-07-22. Purpose: everything an assistant (or Ettore in a fresh session) needs to continue this project without re-explaining it.*

## What this project is

An open-source explorer that scores countries on the maturity of their AI governance ecosystem, to identify where **Plures** can have the biggest field-building impact. Repo: `~/Documents/GitHub/AI-Policy-Windows-Explorer` (local git repo, publishes to GitHub Pages from `docs/`).

**The hypothesis:** in most countries whose main language is not English, AI governance is not yet a real topic — the talent pipeline is thin, media hasn't caught up, policymakers aren't aware. Field-building there is cheap now and valuable later, because only prepared countries can use a policy window (Kingdon's model) when one opens.

**Dual purpose:** (1) genuinely identify where to intervene; (2) serve as public, reproducible "traction/track record" evidence for grant applications. So: open source, no credentials required to reproduce, every number traceable to an archived source.

**History:** first version was built with GPT Codex; Ettore liked the front end but the content failed (not reproducible, no live-data solution). Current effort keeps the front end (`brand.html` = Ettore's style-guide design, `index.html` = original; built via `pnpm run build:pages` → `docs/`) and rebuilds methodology + data + pipeline.

## The framework (full spec: `methodology/METHODOLOGY.md`)

Three dimensions: **Talent** (T), **Attention** (A), **Policy** (P). Each measured on two separate, never-merged tracks: **mainstream** (AI as general topic) and **frontier** (AI safety specifically — sparse data IS the finding). Each dimension resolves to a tier — Nascent / Emerging / Established — via published rules in `config/scoring/` (thresholds: calibrate once on first real pull, then freeze). NO composite index, ever. The lowest tier = the **binding constraint** = the intervention target. Core opportunity profile: *mainstream-mature, frontier-empty*. Missing data is displayed as missing, never zero.

**Coverage:** 19 G20 countries (AR AU BR CA CN FR DE IN ID IT JP MX RU SA ZA KR TR GB US) + EU/AU blocs as unscored roll-ups. Principal languages per country (for A-indicators): AR es, AU en, BR pt, CA en+fr, CN zh, FR fr, DE de, IN en+hi, ID id, IT it, JP ja, MX es, RU ru, SA ar, ZA en+zu, KR ko, TR tr, GB en, US en.

**Indicators:** T1 AI share of national research output (OpenAlex, automated, monthly). T2 AI-safety research works+institutions (OpenAlex search, automated). T3 field-building orgs/university groups (curated quarterly). A1 media coverage intensity+acceleration (GDELT timelinevol, automated). A2 search interest (Google Trends — manual CSV export until API alpha granted). A3 Wikipedia attention (pageviews + article-existence, automated). P1 policy activity (OECD.AI, curated quarterly). P2 frontier-commitments checklist 0–5 (curated: strategy / frontier-risk language / Bletchley+successors / safety institute / binding law). P3 Oxford Insights Gov AI Readiness Index (annual, displayed as context, never re-scored).

## Current status (2026-07-22)

**DONE, in repo:**
- `methodology/METHODOLOGY.md` — full methodology draft v0.2 (needs Ettore's sign-off).
- `verify_sources.py` — stdlib-only source health check; doubles as future CI smoke test. Run: `python3 verify_sources.py`.
- `data/curated/frontier_checklist.json` (P2), `data/curated/field_building.json` (T3), `data/curated/policy_activity.json` (P1) — all 19 countries, every fact with source URL + access date, caveats arrays flag judgment calls. Structure validated (scores match items, counts match entity lists, identical country keys).

**VERIFIED by running (Ettore's machine, 2026-07-22):**
- OpenAlex: PASS both tracks, keyless. T1 AI works since 2023 (sample): US 105,851 / IN 61,370 / ID 30,440 (inflated by local-journal volume — WHY we use shares not raw counts) / DE 27,381 / BR 7,908 / AR 944. T2 frontier works since 2022: US 1,493 / DE 156 / IN 116 / BR 37 / MX 11 / SA 2 / AR 1.
- Wikimedia pageviews: PASS. AI-alignment article exists in ar de es fr id ja ko pt ru zh; MISSING in **hi, it, tr, zu** (finding!). Lesson learned: resolve article titles via English Wikipedia interlanguage links (`action=query&prop=langlinks`), never guess titles (a pt guess 404'd on an article that exists). To-do: resolve redirects and sum their views before trusting levels (pt "Inteligência artificial" showed only 381/mo — suspicious).
- GDELT DOC 2.0: works in principle but aggressively rate-limits (429 even on first request from Ettore's IP; empty JSON sometimes). PLAN: run only in GitHub Actions, monthly, 30–60s between calls, exponential backoff (see `fetch_json_retry` in verify_sources.py). Fallback if CI also blocked: GDELT raw export files (no rate limit). `sourcecountry:` takes FIPS codes or names — NOT ISO (Germany = GM in FIPS); use full names like `sourcecountry:germany` to avoid bugs.
- OECD.AI: no API. Country dashboards are JS-heavy, BUT the Policy Navigator list server-renders counts when filtered: `https://oecd.ai/en/dashboards/policy-initiatives?countryIds=N` (BR=26, DE=66, US=185 etc. — IDs in policy_activity.json sources). Russia = 0 there (coverage gap, not absence).
- Google Trends: no free stable API. Official alpha exists — application form at https://developers.google.com/search/apis/trends (**Ettore still needs to apply**; form is a Google Form requiring login, assistant cannot fill it). MVP: documented monthly manual CSV export, committed to repo. Trends interpreted within-country only, never across.
- Cloud-sandbox note: the Claude cloud container CANNOT reach api.openalex.org / wikimedia REST (network allowlist) and gets 429s on GDELT. Do not burn time trying; run pulls in GitHub Actions or on Ettore's machine.

**DONE 2026-07-22 (second pass) — the v2 pipeline, built in parallel namespaces so the old Codex pipeline (`pipeline/`, `config/` roots) is untouched:**
- `config/v2/countries.json` — all 19 countries: OECD ids, GDELT FIPS codes, per-language pinned query terms (AI term + governance terms + frontier phrases in es/pt/zh/fr/de/hi/id/it/ja/ru/ar/ko/tr/zu/en), Wikipedia article basket, OpenAlex query spec.
- `config/v2/scoring.json` — provisional tier rules (`calibrated: false` — do NOT cite tiers publicly until calibrated on first real pull).
- `pipeline/v2/`: `common.py` (fetch with backoff, raw archiving), `collect_openalex.py` (T1 share + T2, 3 API calls), `collect_wikimedia.py` (langlinks-resolved titles, redirect-summed pageviews, absence archived as finding), `collect_gdelt.py` (30s pacing, 5-try backoff, loud partial-failure exit), `build.py` (deterministic builder → `data/published/snapshot_v2.json`).
- `.github/workflows/monthly-collect.yml` — monthly cron + manual dispatch, collectors → build → PR via peter-evans/create-pull-request; GDELT step is continue-on-error with outcome surfaced in the PR body; never publishes directly.
- Builder TESTED on synthetic fixtures: byte-identical on re-run; missing GDELT → `insufficient_data`, tier null, binding_constraint null (never fabricated); TR frontier attention Nascent via missing alignment article; snapshot format: `{snapshot, schema_version:2, provisional_thresholds, tier_order, countries:{ISO:{name, talent/attention/policy × mainstream/frontier with values+tier+insufficient_data, binding_constraint, provenance}}}`.

**NOT DONE (remaining queue, in order):**
1. First real CI run: Ettore commits + pushes, enables Actions, triggers `monthly-collect` manually from the Actions tab; review the PR it opens.
2. Threshold calibration on that first real pull → write justification per threshold in `config/v2/scoring.json`, set `calibrated: true`, freeze.
3. Front-end wiring: inspect `pages-entry.tsx` / `pages-entry-brand.tsx` / `app/` to see the format the UI expects; adapt UI to read `snapshot_v2.json` (two-track tiers + binding-constraint display). Keep the brand.html design Ettore likes. Do on a git branch if extra caution wanted.
4. A2 Trends: pending Ettore's alpha application; until then, documented manual CSV export procedure (not yet written).
5. P3 Oxford Insights ingestion (annual, low priority); T2 distinct-institutions enhancement; Wikimedia pageview sanity-check vs known-traffic articles.
6. Repo hygiene: duplicate files from editor-save collisions (`README 2.md`, `docs/brand 3/4/5.html`, `favicon 3-6.svg` etc.); eventually retire the old Codex pipeline and `pnpm`-era README instructions.

**ETTORE'S personal to-dos:** apply for Trends API alpha; commit & push (nothing has been committed to git yet — all files are just in the working tree); enable GitHub Actions + Pages when workflow lands; review METHODOLOGY.md and the caveats arrays in the three curated files (esp. 2026-dated claims: Canada's June 2026 strategy, Russia's pending framework law, South Africa's policy withdrawal).

## Headline findings so far (usable in grant apps now)

- Archetype *policy-active, civil-society-empty*: South Korea (P2 5/5, AI law in force Jan 2026, gov safety institute — and ZERO non-governmental AI safety orgs found); Saudi Arabia (65 OECD initiatives, SDAIA — zero orgs).
- Greenfield: Indonesia, Mexico, Türkiye (1 org each, no frontier language in official docs, regulation perpetually deferred); Argentina (1 frontier paper total, explicit anti-regulation posture as policy).
- Brazil overperforms: systemic-risk language in the Senate-passed PL 2338 text, real if small field-building scene (AI Safety Brazil, Condor Initiative, impactRIO).
- Frontier research gap: US 1,493 safety-ish papers vs Argentina 1, Saudi 2, Mexico 11.
- Hindi (~600M speakers, 2026 AI Impact Summit host country) has no Wikipedia article on AI alignment; same for Italian, Turkish, Zulu.

## Working conventions

Provenance on everything (source URL + access date); curated vs automated clearly labeled; caveats stated in-file, not hidden; within-country trends over cross-country levels for attention data; shares over raw counts for research volume; publication only via reviewed PR; thresholds published and frozen after one calibration. Write in Ettore's voice for anything public-facing (he has voice-profile skills in his Claude setup; plain fluent prose, no AI-sounding boilerplate).
