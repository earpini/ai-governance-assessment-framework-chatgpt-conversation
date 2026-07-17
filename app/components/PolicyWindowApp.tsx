"use client";

import { useMemo, useState } from "react";
import type { CountryProfile, Dataset, Evidence, MomentumPoint, Pillar } from "../types/data";

const sourceLedger = [
  { name: "OpenAlex", role: "Research capacity", measures: "Relevant works, active authors, affiliations, collaboration and institutional concentration.", caveat: "Research records do not capture most civil servants, advocates or journalists.", url: "https://openalex.org/" },
  { name: "OECD.AI + official sources", role: "Political activity", measures: "Strategies, laws, consultations, institutions, mandates and evidence of implementation.", caveat: "An initiative is coded by what it does, not counted as equally important by default.", url: "https://oecd.ai/en/dashboards/overview" },
  { name: "Official parliamentary sources", role: "Political attention", measures: "Mentions, questions, bills, consultations, debates and implementation records.", caveat: "Access differs by country; PDF and OCR extraction is reported as semi-automated.", url: "https://www.bundestag.de/services/opendata/" },
  { name: "GDELT", role: "Media attention", measures: "Monthly article share, growth, outlet breadth and governance-related issue frames.", caveat: "Coverage differs by language and media system; raw records and exact queries must be archived.", url: "https://www.gdeltproject.org/" },
  { name: "Google Trends", role: "Optional context only", measures: "General-AI, governance and issue-specific searches when an approved export or official API response is available.", caveat: "It does not affect scores or stages in the validation pilot.", url: "https://developers.google.com/search/apis/trends" },
  { name: "Document-feature classifier", role: "Policy readiness proxy", measures: "Signals of a proposal, named institution, institutional route, coalition and domestic evidence base in archived records.", caveat: "This is an automated proxy. Optional expert review may later override it.", url: "https://github.com/earpini/ai-governance-assessment-framework-chatgpt-conversation" },
];

function StagePill({ stage, pendingLabel = "Stage not assessed" }: { stage: string | null; pendingLabel?: string }) {
  if (!stage) return <span className="stage stage-pending"><i />{pendingLabel}</span>;
  return <span className={`stage stage-${stage.toLowerCase()}`}><i />{stage}</span>;
}

function ScoreRing({ value }: { value: number | null }) {
  return (
    <div className={`score-ring ${value === null ? "score-pending" : ""}`} style={{ "--score": `${(value ?? 0) * 3.6}deg` } as React.CSSProperties}>
      <span>{value ?? "—"}</span>
    </div>
  );
}

function Sparkline({ country }: { country: CountryProfile }) {
  const byMonth = new Map<string, number[]>();
  country.momentum.forEach(point => {
    if (point.indexedValue === null || point.seriesType === "google_trends_context") return;
    byMonth.set(point.month, [...(byMonth.get(point.month) ?? []), point.indexedValue]);
  });
  const values = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, points]) => points.reduce((a, b) => a + b, 0) / points.length);
  if (values.length < 2) return <div className="spark-empty">Collection pending</div>;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${40 - value * .34}`).join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 44" preserveAspectRatio="none" aria-label="Combined attention trend">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MomentumChart({ country, range }: { country: CountryProfile; range: 12 | 36 }) {
  const months = [...new Set(country.momentum.map(point => point.month))].sort().slice(-range);
  const data = months.map(month => ({ month, points: country.momentum.filter(point => point.month === month) }));
  const width = 720, height = 220, pad = 20;
  const path = (seriesType: MomentumPoint["seriesType"]) => data.flatMap((d, i) => {
    const point = d.points.find(item => item.seriesType === seriesType && item.indexedValue !== null);
    if (!point || point.indexedValue === null) return [];
    const x = pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (point.indexedValue / 100) * (height - pad * 2);
    return [`${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`];
  }).join(" ");
  if (!data.length) return <div className="momentum-empty"><strong>No empirical attention series published</strong><p>The chart will appear after GDELT records and official political documents pass provenance and classification checks.</p></div>;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${range}-month political and media attention`}>
        {[25, 50, 75].map(v => <line key={v} x1={pad} x2={width-pad} y1={height-pad-(v/100)*(height-pad*2)} y2={height-pad-(v/100)*(height-pad*2)} className="gridline" />)}
        <path d={path("media_attention")} className="chart-media" />
        <path d={path("political_attention") || path("wikimedia_attention")} className="chart-search" />
      </svg>
      <div className="chart-labels"><span>{data[0]?.month}</span><span>{data.at(-1)?.month}</span></div>
    </div>
  );
}

function EvidenceDrawer({ evidence, onClose }: { evidence: Evidence | null; onClose: () => void }) {
  if (!evidence) return null;
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="evidence-title">
        <button className="close" onClick={onClose} aria-label="Close evidence">×</button>
        <span className="eyebrow">Indicator evidence</span>
        <h2 id="evidence-title">{evidence.label}</h2>
        <div className="evidence-value">{evidence.value}</div>
        <p>{evidence.definition}</p>
        <dl>
          <div><dt>Source</dt><dd><a href={evidence.sourceUrl} target="_blank" rel="noreferrer">{evidence.source} ↗</a></dd></div>
          <div><dt>Period</dt><dd>{evidence.period}</dd></div>
          <div><dt>Confidence</dt><dd>{evidence.confidence}</dd></div>
        </dl>
        <p className="drawer-note">Every indicator keeps its source, period, and confidence attached. Missing observations are flagged and never scored as zero.</p>
      </aside>
    </div>
  );
}

function PillarCard({ pillar, number, onEvidence }: { pillar: Pillar; number: number; onEvidence: (e: Evidence) => void }) {
  return (
    <article className="pillar-card">
      <div className="pillar-top"><span className="pillar-number">0{number}</span><ScoreRing value={pillar.score} /></div>
      <h3>{pillar.name}</h3>
      <p className="pillar-question">{pillar.question}</p>
      <div className="confidence"><span>{pillar.scoreLabel}</span><span className={`trend ${pillar.trend ?? "pending"}`}>{pillar.trend === "up" ? "↗ Rising" : pillar.trend === "down" ? "↘ Falling" : pillar.trend === "flat" ? "→ Stable" : "Review pending"}</span></div>
      <p className="pillar-note">{pillar.note}</p>
      <div className="evidence-list">
        {pillar.evidence.slice(0, 2).map((e) => <button key={e.label} onClick={() => onEvidence(e)}><span>{e.label}</span><strong>{e.value}</strong><i>→</i></button>)}
        {!pillar.evidence.length && <div className="evidence-empty">No approved observations yet</div>}
      </div>
    </article>
  );
}

export default function PolicyWindowApp({ dataset, variant = "window" }: { dataset: Dataset; variant?: "window" | "brand" }) {
  const [selectedId, setSelectedId] = useState(dataset.countries[0].id);
  const [range, setRange] = useState<12 | 36>(12);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [view, setView] = useState<"explore" | "method">("explore");
  const country = useMemo(() => dataset.countries.find(c => c.id === selectedId) ?? dataset.countries[0], [dataset, selectedId]);

  return (
    <main>
      <header className="site-header">
        {variant === "brand" ? <a className="ea-wordmark" href="https://ettorearpini.com/" aria-label="Ettore Arpini, home">Ettore Arpini<span className="ea-logo-arrow">↗</span></a> : <button className="brand" onClick={() => setView("explore")}><span>W/</span> WINDOW</button>}
        <nav aria-label="Primary"><button className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Explore</button><button className={view === "method" ? "active" : ""} onClick={() => setView("method")}>Methodology</button></nav>
        <div className="status-dot"><i /> Pilot snapshot {dataset.publishedAt}</div>
      </header>

      {view === "method" ? (
        <section className="method-page">
          <span className="eyebrow">Methodology · validation pilot {dataset.methodologyVersion}</span>
          <h1>What the tool measures—<br/><em>and what it cannot.</em></h1>
          <p className="method-lead">This pilot asks whether a country is prepared to use a policy opportunity when it appears. It generates reproducible proxies from public data and web-accessible official records. The result is a machine-generated diagnosis to investigate, not a definitive ranking.</p>
          <div className="method-callout"><strong>Publication rule:</strong><p>This build contains no synthetic observations. Automated proxies may publish with incomplete coverage, but missing sources lower confidence and remain visible.</p></div>

          <div className="method-section-heading"><span className="eyebrow">01 · The assessment</span><h2>Four separate questions</h2><p>No overall country score is published. Each pillar remains visible so a strong signal cannot hide a weak one.</p></div>
          <div className="method-grid">
            {dataset.countries[0].pillars.map((p, i) => <article key={p.id}><span>0{i+1}</span><h2>{p.name}</h2><p>{p.question}</p></article>)}
          </div>

          <div className="method-section-heading"><span className="eyebrow">02 · From evidence to score</span><h2>How the numbers are made</h2></div>
          <ol className="method-steps">
            <li><strong>Collect</strong><span>Monthly observations retain their source, period, collection date and confidence.</span></li>
            <li><strong>Check</strong><span>Failed sources keep the last valid snapshot. Missing data are flagged; they are never converted to zero.</span></li>
            <li><strong>Normalize</strong><span>Publish raw, population-adjusted and within-country trend values. Five-country min–max normalization is not used as the primary result.</span></li>
            <li><strong>Score</strong><span>Transparent 0–4 component rubrics may be converted to experimental 0–100 pillar scores for interface testing. No overall index is calculated.</span></li>
            <li><strong>Diagnose</strong><span>Explicit rules generate a provisional window stage. Optional expert review can add context or override it without blocking automated publication.</span></li>
          </ol>

          <div className="method-section-heading"><span className="eyebrow">03 · Data sources</span><h2>What each source contributes</h2><p>Source coverage is deliberately mixed: no single dataset can show whether a policy community is ready to act.</p></div>
          <div className="source-table" role="table" aria-label="Data source ledger">
            <div className="source-row source-head" role="row"><span>Source</span><span>Signal</span><span>What enters the assessment</span><span>Known limitation</span></div>
            {sourceLedger.map(source => <div className="source-row" role="row" key={source.name}><a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a><strong>{source.role}</strong><p>{source.measures}</p><p>{source.caveat}</p></div>)}
          </div>

          <div className="method-section-heading"><span className="eyebrow">04 · Window stage</span><h2>An explicit automated proxy</h2></div>
          <div className="stage-rules">
            <div><StagePill stage="Closed"/><p>Political receptivity and public momentum are both low.</p></div>
            <div><StagePill stage="Latent"/><p>Capacity or policy readiness exists, but attention remains low.</p></div>
            <div><StagePill stage="Opening"/><p>Receptivity or momentum is rising, and usable capacity is present.</p></div>
            <div><StagePill stage="Open"/><p>Current attention, political engagement and policy readiness are all strong.</p></div>
            <div><StagePill stage="Closing"/><p>Attention has fallen after a sustained or sharp peak.</p></div>
          </div>

          <div className="method-notes">
            <div><h3>Confidence</h3><p>Three judgments are reported separately: data coverage, classification quality and expert agreement. None is presented as a probability.</p></div>
            <div><h3>Comparability</h3><p>Raw counts, population-adjusted values and within-country trends remain visible. Experimental scores never replace the underlying measures.</p></div>
            <div><h3>Limits</h3><p>Language coverage, informal networks, access to decision-makers and the quality of proposals are difficult to observe. Country profiles expose warnings instead of filling those gaps with assumptions.</p></div>
          </div>
          <button className="back-button" onClick={() => setView("explore")}>← Back to country explorer</button>
        </section>
      ) : (
        <>
          <section className="hero">
            <div><span className="eyebrow">AI governance policy-window monitor · open-data validation pilot</span><h1>Where is the next<br/>window <em>opening?</em></h1></div>
            <p>Five countries. Four evidence profiles. One test: can open data support a useful policy-window diagnosis?</p>
          </section>

          <div className="prototype-strip"><strong>{dataset.status === "collection_pending" ? "Collection pending" : "First empirical pass"}</strong><span>No synthetic country findings are displayed. Available official records are shown now; missing sources, scores and country stages remain visibly pending.</span><button onClick={() => setView("method")}>See validation method →</button></div>

          <section className="country-strip" aria-label="Country comparison">
            {dataset.countries.map(c => (
              <button key={c.id} className={c.id === country.id ? "selected" : ""} onClick={() => setSelectedId(c.id)}>
                <div><span className="country-code">{c.code}</span><StagePill stage={c.stage} pendingLabel={c.status === "collection_pending" ? "Collection pending" : "Evidence available"} /></div>
                <strong>{c.name}</strong><Sparkline country={c} />
                <span className="select-label">{c.id === country.id ? "Viewing profile" : "View profile"} →</span>
              </button>
            ))}
          </section>

          <section className="profile" key={country.id}>
            <div className="profile-heading">
              <div><span className="eyebrow">{country.region} · {country.code}</span><h2>{country.name}</h2></div>
              <div className="stage-summary"><span>Policy window proxy</span><StagePill stage={country.stage} /><small>{country.stageConfidence}</small></div>
            </div>
            {country.lowDataWarning && <div className="data-warning">△ {country.lowDataWarning}</div>}
            <div className="diagnosis-grid">
              <blockquote>“{country.summary}”<footer>{country.expertReview}</footer></blockquote>
              <div className="signal"><span>What we’re watching</span><p>{country.signal}</p></div>
              <div className="missing"><span>Missing ingredients</span><ul>{country.missingIngredients.map(item => <li key={item}>{item}</li>)}</ul></div>
            </div>

            <div className="section-title"><div><span className="eyebrow">Readiness profile</span><h2>Four signals, no false precision.</h2></div><p>Click any evidence row to inspect its definition, source, date, and confidence.</p></div>
            <div className="pillars">{country.pillars.map((p, i) => <PillarCard key={p.id} pillar={p} number={i+1} onEvidence={setEvidence} />)}</div>

            <div className="momentum-section">
              <div className="momentum-head"><div><span className="eyebrow">Attention over time</span><h2>Is attention becoming durable?</h2></div><div className="range-toggle"><button className={range === 12 ? "active" : ""} onClick={() => setRange(12)}>12 months</button><button className={range === 36 ? "active" : ""} onClick={() => setRange(36)}>36 months</button></div></div>
              <MomentumChart country={country} range={range} />
              <div className="legend"><span><i className="search-dot"/>Political / Wikimedia attention</span><span><i className="media-dot"/>Media attention</span><small>Indexed within country · raw measures retained</small></div>
            </div>
          </section>
        </>
      )}

      <footer className="site-footer">{variant === "brand" ? <a className="ea-wordmark" href="https://ettorearpini.com/" aria-label="Ettore Arpini, home">Ettore Arpini<span className="ea-logo-arrow">↗</span></a> : <div className="brand"><span>W/</span> WINDOW</div>}<p>Designed and researched by <a href="https://ettorearpini.com/" target="_blank" rel="noreferrer">Ettore Arpini ↗</a></p><div className="footer-links"><button onClick={() => setView("method")}>Methodology</button><a href="https://www.admonymous.co/arpini" target="_blank" rel="noreferrer">Leave feedback ↗</a></div></footer>
      <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />
    </main>
  );
}
