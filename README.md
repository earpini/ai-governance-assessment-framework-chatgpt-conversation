# AI Governance Policy-Window Validation Pilot

An open-data proof of concept for assessing whether Brazil, Germany, India, Kenya, and Mexico have the observable capacity, political attention, public momentum, and policy preparation needed to use an AI-governance policy window.

## Publication status

The checked-in public snapshot contains **no synthetic country observations**. Every country remains `collection_pending`, with no score or stage, until empirical source records and a structured review satisfy the publication gates.

The interface is available in two visual versions:

- `index.html`: original Window design.
- `brand.html`: Ettore Arpini style-guide design.

## Method

- **Observable field capacity:** OpenAlex works, authors, institutions, collaboration and concentration. This does not claim to count all practitioners.
- **Political receptivity and attention:** official parliamentary and government documents. OECD.AI is discovery-only; scored records require primary-source verification.
- **Public attention:** Google Trends monthly interest for the local equivalents of **“AI risks”** (primary) and **“AI regulation”** (companion). It is interpreted within country through acceleration and persistence, not compared as absolute search volume across countries. A public-interface export or approved API response must be archived before it affects a score.
- **Media momentum:** archived GDELT article records. Wikimedia pageviews are retained only as unscored, non-geographic general-interest context.
- **Policy readiness:** five criteria rated 0–2 by a country reviewer and a central second coder. Stages are never assigned automatically.

Raw counts, adjusted measures, within-country trends and component rubrics remain separate. The tool does not calculate an overall index.

## Reproducible workflow

1. Review and freeze `config/queries/`, `config/scoring/`, and `config/official_sources.json`.
2. Configure `OPENALEX_API_KEY` for live OpenAlex collection.
3. Add manually verified official documents to `data/inputs/political_documents.json`.
4. Run collectors without publishing:

   ```bash
   python3 -m pipeline.run_collection \
     --snapshot 2026-08 \
     --start 2026-07-01 \
     --end 2026-07-31 \
     --sources openalex,gdelt,political
   ```

5. Classify cached records and manually review the required samples described in `data/reviewed/samples/README.md`.
6. Write normalized observations with raw IDs, formulas, missing-data flags and provenance references.
7. Complete primary and secondary readiness reviews, record disagreements, and adjudicate them.
8. Build with publication gates enabled:

   ```bash
   python3 pipeline/build_snapshot.py --snapshot 2026-07 --publication-mode
   python3 -m pipeline.validate.pilot --snapshot 2026-07
   ```

9. Re-run the build from cached inputs and compare the resulting `data/published/snapshot.json` byte-for-byte.

Live collection never publishes automatically. If collection fails, the previous valid published snapshot remains untouched.

## Automated proxy refresh

The monthly workflow collects credential-free Wikimedia attention data and official-source records, then generates explicitly labelled automated readiness and window-stage proxies. If `OPENALEX_API_KEY` is configured as a repository secret, research-capacity collection is added automatically. The workflow opens a pull request so source failures and coverage warnings remain visible before deployment.

Run the same workflow locally with:

```bash
python3 -m pipeline.monthly_refresh
```

## Data contract

`schemas/pilot.schema.json` defines:

- `QuerySpec`
- `RawObservation`
- `NormalizedObservation`
- `SourceManifest`
- `ReviewAssessment`
- `MomentumPoint`

Every published evidence item and chart point must reference archived raw observation IDs. Missing observations remain missing and are never scored as zero.

## Tests and builds

```bash
python3 -m unittest tests/pipeline_test.py
pnpm run build:pages
```

The production Pages build is written to `docs/`.
