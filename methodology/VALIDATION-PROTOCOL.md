# Validation protocol

This is an evidence-collection and review system, not a completed country assessment. The checked-in snapshot contains no synthetic findings and publishes no country stages.

## Six-week sequence

1. Freeze definitions, dictionaries, translations, rubrics, transformations, and exclusions; test one month per country.
2. Log inaccessible country-language-source combinations and revise the preregistration once.
3. Collect 36 complete months into immutable OpenAlex, GDELT, and official-source caches.
4. Code 50 OpenAlex works and 100 GDELT articles per country. Freeze the revised dictionary only at 80% precision, or publish the shortfall.
5. Obtain independent readiness assessments from a country reviewer and central coder; preserve both and log adjudication.
6. Run reproducibility, traceability, agreement, usefulness, sensitivity, and coverage checks before publication.

## Coverage matrix

| Country | Research | Media | Official political sources | State |
|---|---|---|---|---|
| Brazil | OpenAlex | GDELT | Câmara, Senado, consultations, gazette | Pending |
| Germany | OpenAlex | GDELT | Bundestag, ministries, regulators | Pending |
| India | OpenAlex | GDELT | Digital Sansad, Parliament Digital Library, ministries | Pending; OCR risk |
| Kenya | OpenAlex | GDELT | Hansard, Kenya Law, ministries | Pending; semi-automated PDFs |
| Mexico | OpenAlex | GDELT | Gaceta, Cámara, Senado, Diario Oficial | Pending |

OECD.AI is discovery-only. Google Trends is optional, contextual, and unscored.

## Coding and publication rules

- A research or media result must concern both AI and a versioned governance topic or issue pathway.
- Political records retain their stable ID, exact match, language, issue, instrument, pipeline stage, named institutions, implementation fields, retrieval details, and checksum.
- Missing observations remain missing; failures never become zero.
- Readiness uses five 0–2 criteria. Every non-zero rating needs a citation and rationale.
- A country stage is a reviewed conclusion, never a numerical output.
- A cached rebuild must be byte-identical and every published claim must resolve to dated evidence.
- Readiness agreement must reach weighted kappa 0.6 or include a disagreement analysis.
- At least four country reviewers must judge the result directionally accurate and useful.
- Leave-one-component-out sensitivity and all low-coverage warnings must be published.

The generated validation report records current gates. Precision, agreement, sensitivity, known-failure, and recommendation sections remain pending until data collection and human review occur.
