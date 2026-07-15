"use client";

import { useMemo, useState } from "react";
import type { CountryProfile, Dataset, Evidence, Pillar } from "../types/data";

const stageOrder = ["Closed", "Latent", "Opening", "Open", "Closing"];

function StagePill({ stage }: { stage: string }) {
  return <span className={`stage stage-${stage.toLowerCase()}`}><i />{stage}</span>;
}

function ScoreRing({ value }: { value: number }) {
  return (
    <div className="score-ring" style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}>
      <span>{value}</span>
    </div>
  );
}

function Sparkline({ country }: { country: CountryProfile }) {
  const values = country.momentum.map((point) => (point.search + point.media) / 2);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${40 - value * .34}`).join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 44" preserveAspectRatio="none" aria-label="Combined attention trend">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MomentumChart({ country, range }: { country: CountryProfile; range: 12 | 36 }) {
  const data = country.momentum.slice(-range);
  const width = 720, height = 220, pad = 20;
  const path = (key: "search" | "media") => data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - (d[key] / 100) * (height - pad * 2);
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${range}-month search and media momentum`}>
        {[25, 50, 75].map(v => <line key={v} x1={pad} x2={width-pad} y1={height-pad-(v/100)*(height-pad*2)} y2={height-pad-(v/100)*(height-pad*2)} className="gridline" />)}
        <path d={path("media")} className="chart-media" />
        <path d={path("search")} className="chart-search" />
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
      <div className="confidence"><span>{pillar.confidence} confidence</span><span className={`trend ${pillar.trend}`}>{pillar.trend === "up" ? "↗ Rising" : pillar.trend === "down" ? "↘ Falling" : "→ Stable"}</span></div>
      <p className="pillar-note">{pillar.note}</p>
      <div className="evidence-list">
        {pillar.evidence.slice(0, 2).map((e) => <button key={e.label} onClick={() => onEvidence(e)}><span>{e.label}</span><strong>{e.value}</strong><i>→</i></button>)}
      </div>
    </article>
  );
}

export default function PolicyWindowApp({ dataset }: { dataset: Dataset }) {
  const [selectedId, setSelectedId] = useState(dataset.countries[0].id);
  const [range, setRange] = useState<12 | 36>(12);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [view, setView] = useState<"explore" | "method">("explore");
  const country = useMemo(() => dataset.countries.find(c => c.id === selectedId) ?? dataset.countries[0], [dataset, selectedId]);

  return (
    <main>
      <header className="site-header">
        <button className="brand" onClick={() => setView("explore")}><span>W/</span> WINDOW</button>
        <nav aria-label="Primary"><button className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Explore</button><button className={view === "method" ? "active" : ""} onClick={() => setView("method")}>Methodology</button></nav>
        <div className="status-dot"><i /> Updated {dataset.publishedAt}</div>
      </header>

      {view === "method" ? (
        <section className="method-page">
          <span className="eyebrow">How to read this tool</span>
          <h1>Readiness is a profile,<br/><em>not a ranking.</em></h1>
          <p className="method-lead">Window combines observable signals with structured expert judgment to ask one practical question: when attention rises, can a country turn it into meaningful AI governance?</p>
          <div className="method-grid">
            {dataset.countries[0].pillars.map((p, i) => <article key={p.id}><span>0{i+1}</span><h2>{p.name}</h2><p>{p.question}</p></article>)}
          </div>
          <div className="method-notes">
            <div><h3>Scoring</h3><p>Each pillar runs from 0–100 and is reported separately. Quantitative observations are normalized across the pilot; expert-coded readiness uses five documented criteria.</p></div>
            <div><h3>Stage rules</h3><p>Closed, Latent, Opening, Open, and Closing describe the interaction of capacity, political receptivity, momentum, and readiness. A human reviewer must approve any stage change.</p></div>
            <div><h3>Limitations</h3><p>This is an illustrative pilot dataset, not a definitive country assessment. Language coverage, source availability, and expert access vary; confidence and low-data warnings make those gaps visible.</p></div>
          </div>
          <button className="back-button" onClick={() => setView("explore")}>← Back to country explorer</button>
        </section>
      ) : (
        <>
          <section className="hero">
            <div><span className="eyebrow">AI governance policy-window monitor</span><h1>Where is the next<br/>window <em>opening?</em></h1></div>
            <p>Five countries. Four readiness signals. One practical question: who is prepared to turn rising attention into meaningful policy?</p>
          </section>

          <section className="country-strip" aria-label="Country comparison">
            {dataset.countries.map(c => (
              <button key={c.id} className={c.id === country.id ? "selected" : ""} onClick={() => setSelectedId(c.id)}>
                <div><span className="country-code">{c.code}</span><StagePill stage={c.stage} /></div>
                <strong>{c.name}</strong><Sparkline country={c} />
                <span className="select-label">{c.id === country.id ? "Viewing profile" : "View profile"} →</span>
              </button>
            ))}
          </section>

          <section className="profile" key={country.id}>
            <div className="profile-heading">
              <div><span className="eyebrow">{country.region} · {country.code}</span><h2>{country.name}</h2></div>
              <div className="stage-summary"><span>Policy window</span><StagePill stage={country.stage} /><small>{country.stageConfidence} confidence</small></div>
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
              <div className="legend"><span><i className="search-dot"/>Search interest</span><span><i className="media-dot"/>Media attention</span><small>Indexed within country · 0–100</small></div>
            </div>
          </section>
        </>
      )}

      <footer className="site-footer"><div className="brand"><span>W/</span> WINDOW</div><p>Signals for people building the field.</p><button onClick={() => setView("method")}>Read the methodology →</button></footer>
      <EvidenceDrawer evidence={evidence} onClose={() => setEvidence(null)} />
    </main>
  );
}
