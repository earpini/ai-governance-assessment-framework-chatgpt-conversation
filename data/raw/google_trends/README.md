# Google Trends public-attention inputs

The public-attention pillar uses monthly Google Trends interest for two local-language queries per country, defined in `config/queries/google_trends.json`:

1. **AI risk concern** — the primary signal.
2. **AI regulation / policy attention** — a companion signal, used when the risk query is sparse or to distinguish concern from policy engagement.

For each country, export the monthly Google Trends CSV covering the same 36 complete months. Archive the original CSV, the Explore URL, query language, country geography, download date, and a checksum.

The 0–100 values are normalized within the exact Google Trends request. They must be used only to calculate within-country acceleration, persistence after spikes, and the risk-versus-regulation relationship. They are not absolute searches and must not be compared directly between separately run countries.

The official Google Trends API is alpha-access only. Until approved API responses are available, this pilot accepts dated public-interface exports but does not depend on an unofficial scraper for recurring collection.
