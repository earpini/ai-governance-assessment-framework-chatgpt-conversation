"use client";

import { useMemo, useState } from "react";
import type { CountrySnapshot, DimensionId, SnapshotV2, Tier } from "../types/snapshot";

const REPO = "https://github.com/earpini/AI-Policy-Windows-Explorer";

const DIMENSIONS: { id: DimensionId; name: string; question: string }[] = [
  { id: "talent", name: "Talent", question: "Is there a pipeline of people who could staff an AI governance ecosystem?" },
  { id: "attention", name: "Attention", question: "Has AI governance reached the public conversation, in the local language?" },
  { id: "policy", name: "Policy", question: "Is the government aware, and has anyone prepared?" },
];

const P2_LABELS: Record<string, string> = {
  national_strategy: "National AI strategy exists",
  frontier_risk_language: "Frontier / systemic-risk language in official documents",
  bletchley_or_successor: "Signed Bletchley or successor declaration",
  safety_institute: "AI safety institute or International Network membership",
  binding_law: "Binding AI law in force or advanced passage",
};

const sourceLedger = [
  { name: "OpenAlex", role: "Talent · automated", measures: "AI share of national research output (T1) and frontier-safety works (T2), rolling windows, grouped by authorship country.", caveat: "Scholarly indexing under-counts non-English work; shares and within-country trends mitigate but do not remove this.", url: "https://openalex.org/" },
  { name: "aisafety.com directories + org sites", role: "Talent · curated quarterly", measures: "Active AI-safety organizations and university groups per country (T3), each entry with an activity signal and source URL.", caveat: "A good-faith floor, not a census; informal groups without a public trail are undercounted.", url: "https://www.aisafety.com/map" },
  { name: "GDELT DOC 2.0", role: "Attention · automated", measures: "Share of each country's monitored media coverage matching local-language AI-governance and AI-safety queries (A1).", caveat: "Aggressive rate limits mean partial collection some months; affected countries show 'insufficient data', never zeros.", url: "https://www.gdeltproject.org/" },
  { name: "Google Trends", role: "Attention · pending", measures: "Within-country search interest for local equivalents of 'AI risks' and 'AI regulation' (A2).", caveat: "No stable free API today; official Trends API access requested. Until then this signal is absent, not imputed.", url: "https://developers.google.com/search/apis/trends" },
  { name: "Wikimedia", role: "Attention · automated context", measures: "Whether frontier articles (e.g. AI alignment) exist in each principal language, plus pageviews (A3).", caveat: "Language communities are not countries; corroborating evidence only.", url: "https://wikimedia.org/api/rest_v1/" },
  { name: "OECD.AI Policy Navigator", role: "Policy · curated quarterly", measures: "Count and recency of national AI policy initiatives (P1), coded into an activity level.", caveat: "No export API; hand-curated with provenance. Coverage gaps exist (e.g. Russia is absent from OECD data).", url: "https://oecd.ai/en/dashboards/overview" },
  { name: "Primary documents", role: "Policy · curated quarterly", measures: "Five-item frontier-commitments checklist (P2): strategy, frontier-risk language, summit declarations, safety institute, binding law.", caveat: "Each yes requires a linked primary source; judgment calls are flagged in the dataset's caveats.", url: `${REPO}/blob/main/data/curated/frontier_checklist.json` },
];

function TierPill({ tier, pending = "Collecting" }: { tier: Tier | null; pending?: string }) {
  if (!tier) return <span className="stage tier-pending"><i />{pending}</span>;
  return <span className={`stage tier-${tier.toLowerCase()}`}><i />{tier}</span>;
}

function TrackRow({ label, tier, children }: { label: string; tier: Tier | null; children?: React.ReactNode }) {
  return (
    <div className="track-row">
      <div className="track-head"><span className="track-label">{label}</span><TierPill tier={tier} /></div>
      {children}
    </div>
  );
}

interface Fact { label: string; value: string; detail: string; sourceLabel: string; sourceUrl: string }

function FactButton({ fact, onOpen }: { fact: Fact; onOpen: (f: Fact) => void }) {
  return (
    <button className="fact" onClick={() => onOpen(fact)}>
      <span>{fact.label}</span><strong>{fact.value}</strong><i>→</i>
    </button>
  );
}

function FactDrawer({ fact, provenance, onClose }: { fact: Fact | null; provenance: string[]; onClose: () => void }) {
  if (!fact) return null;
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="fact-title">
        <button className="close" onClick={onClose} aria-label="Close evidence">×</button>
        <span className="eyebrow">Indicator evidence</span>
        <h2 id="fact-title">{fact.label}</h2>
        <div className="evidence-value">{fact.value}</div>
        <p>{fact.detail}</p>
        <dl>
          <div><dt>Source</dt><dd><a href={fact.sourceUrl} target="_blank" rel="noreferrer">{fact.sourceLabel} ↗</a></dd></div>
          <div><dt>Archived inputs</dt><dd>{provenance.map(p => <a key={p} className="prov-link" href={`${REPO}/blob/main/${p}`} target="_blank" rel="noreferrer">{p.split("/").pop()} ↗</a>)}</dd></div>
        </dl>
        <p className="drawer-note">Every displayed number traces to raw responses archived in the public repository. Missing observations are shown as missing and never scored as zero.</p>
      </aside>
    </div>
  );
}

function pct(v: number | null | undefined, digits = 2) {
  return v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;
}

function isOpportunityProfile(c: CountrySnapshot) {
  const mainstreamMature =
    c.talent.mainstream.tier === "Established" || c.policy.mainstream.tier === "Established";
  const frontierEmpty =
    (c.talent.frontier.tier === "Nascent" || (c.talent.frontier.t3_orgs + c.talent.frontier.t3_university_groups) === 0);
  return mainstreamMature && frontierEmpty;
}

function constraintLabel(c: CountrySnapshot): { headline: string; detail: string } {
  const bc = c.binding_constraint.frontier;
  if (bc) {
    const dim = DIMENSIONS.find(d => d.id === bc)!;
    return { headline: `Frontier ${dim.name.toLowerCase()}`, detail: `${dim.name} is the lowest frontier-track dimension — the suggested field-building entry point.` };
  }
  const tiers = DIMENSIONS.map(d => ({ d, tier: c[d.id].frontier.tier })).filter(x => x.tier !== null);
  if (!tiers.length) return { headline: "Assessment incomplete", detail: "Attention data is still being collected; no binding constraint is derived until all three dimensions have evidence." };
  const order: Tier[] = ["Nascent", "Emerging", "Established"];
  const lowest = tiers.sort((a, b) => order.indexOf(a.tier!) - order.indexOf(b.tier!))[0];
  return { headline: `Frontier ${lowest.d.name.toLowerCase()} (partial)`, detail: `${lowest.d.name} is the lowest scored frontier dimension so far; attention data is still being collected, so this is provisional.` };
}

export default function ExplorerApp({ dataset, variant = "window" }: { dataset: SnapshotV2; variant?: "window" | "brand" }) {
  const codes = useMemo(() => Object.keys(dataset.countries).sort((a, b) => dataset.countries[a].name.localeCompare(dataset.countries[b].name)), [dataset]);
  const [selected, setSelected] = useState(codes[0]);
  const [fact, setFact] = useState<Fact | null>(null);
  const [view, setView] = useState<"explore" | "method">("explore");
  const country = dataset.countries[selected];

  const facts = useMemo(() => {
    const c = country;
    const tm = c.talent.mainstream, tf = c.talent.frontier, pm = c.policy.mainstream, pf = c.policy.frontier;
    const f: Record<string, Fact[]> = {
      talent: [
        { label: "AI share of research output (T1)", value: pct(tm.t1_ai_share), detail: `${tm.t1_ai_works?.toLocaleString() ?? "—"} AI works of ${tm.t1_total_works?.toLocaleString() ?? "—"} total works since 2023 (OpenAlex, by authorship country). Compared against a frozen G20 reference share of ${pct(tm.g20_median_share)}. Shares, never raw counts: raw counts mostly measure country size and indexing volume.`, sourceLabel: "OpenAlex", sourceUrl: "https://openalex.org/" },
        { label: "Frontier-safety works (T2)", value: tf.t2_works?.toLocaleString() ?? "—", detail: "Works since 2022 matching the pinned safety search (AI safety, AI alignment, existential risk, frontier models, catastrophic risk) in title or abstract. Small numbers are the finding: this maps where the field does not yet exist.", sourceLabel: "OpenAlex", sourceUrl: "https://openalex.org/" },
        { label: "Field-building entities (T3)", value: `${tf.t3_orgs + tf.t3_university_groups}${tf.t3_capped ? "+" : ""}`, detail: `${tf.t3_orgs} organization(s) and ${tf.t3_university_groups} university group(s) verified active, from public directories with per-entity activity signals and sources.${tf.t3_capped ? " Enumeration capped; the true total is higher." : ""}`, sourceLabel: "Curated dataset (field_building.json)", sourceUrl: `${REPO}/blob/main/data/curated/field_building.json` },
      ],
      attention: [
        ...(c.attention.mainstream.a1_trend_ratio != null ? [{ label: "Media coverage trend (A1)", value: `×${c.attention.mainstream.a1_trend_ratio}`, detail: "Mean of the last 12 months of AI-governance media coverage (as % of the country's monitored articles, GDELT) over the mean of the prior 12. Within-country comparison only.", sourceLabel: "GDELT", sourceUrl: "https://www.gdeltproject.org/" }] : []),
        { label: "Frontier article in principal language", value: c.attention.frontier.alignment_article_exists_in_principal_language === null || c.attention.frontier.alignment_article_exists_in_principal_language === undefined ? "—" : c.attention.frontier.alignment_article_exists_in_principal_language ? "Exists" : "Missing", detail: "Whether the AI-alignment article exists in the country's principal-language Wikipedia, resolved via interlanguage links. Absence is a verified frontier-attention finding, not a data gap.", sourceLabel: "Wikimedia", sourceUrl: "https://wikimedia.org/api/rest_v1/" },
      ],
      policy: [
        { label: "Policy initiatives (P1)", value: pm.p1_oecd_initiative_count === null ? "n/a" : String(pm.p1_oecd_initiative_count), detail: `OECD.AI-listed national AI policy initiatives, coded '${pm.p1_activity_level}' activity overall. Latest significant action: ${pm.p1_latest_initiative.name} (${pm.p1_latest_initiative.year}).`, sourceLabel: "Curated dataset (policy_activity.json)", sourceUrl: `${REPO}/blob/main/data/curated/policy_activity.json` },
        { label: "Frontier commitments (P2)", value: `${pf.p2_score}/5`, detail: Object.entries(pf.p2_items).map(([k, v]) => `${v ? "✓" : "✗"} ${P2_LABELS[k] ?? k}`).join("  ·  "), sourceLabel: "Curated dataset (frontier_checklist.json)", sourceUrl: `${REPO}/blob/main/data/curated/frontier_checklist.json` },
      ],
    };
    return f;
  }, [country]);

  const constraint = constraintLabel(country);

  return (
    <main>
      <header className="site-header">
        {variant === "brand" ? <div className="header-brand"><a className="ea-wordmark" href="https://ettorearpini.com/" aria-label="Ettore Arpini, home">Ettore Arpini<span className="ea-logo-arrow">↗</span></a><span className="header-tool-title">|&nbsp; AI Policy Windows Explorer</span></div> : <button className="brand" onClick={() => setView("explore")}><span>W/</span> WINDOW</button>}
        <nav aria-label="Primary"><button className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Explore</button><button className={view === "method" ? "active" : ""} onClick={() => setView("method")}>Methodology</button></nav>
        <div className="status-dot"><i /> Snapshot {dataset.snapshot}{dataset.provisional_thresholds ? " · provisional tiers" : ""}</div>
      </header>

      {view === "method" ? (
        <section className="method-page">
          <span className="eyebrow">Methodology · G20 edition · snapshot {dataset.snapshot}</span>
          <h1>Three dimensions, two tracks—<br /><em>and no composite index.</em></h1>
          <p className="method-lead">The explorer scores each country on Talent, Attention, and Policy — twice. The mainstream track asks whether AI is on the country's radar at all; the frontier track asks specifically about AI safety, where sparse data is itself the finding. A country strong on mainstream and empty on frontier is exactly where field-building has the most leverage.</p>
          <div className="method-callout"><strong>The reading:</strong><p>A country strong on all three dimensions is window-ready: when a policy window opens, it can act. A country weak on one dimension has a binding constraint — the intervention target. Weak on all three is greenfield: the highest-leverage place for early field-building. Full methodology, every query, and every threshold justification live in the <a href={`${REPO}/blob/main/methodology/METHODOLOGY.md`} target="_blank" rel="noreferrer">public repository ↗</a>.</p></div>

          <div className="method-section-heading"><span className="eyebrow">01 · The dimensions</span><h2>Three questions per country</h2></div>
          <div className="method-grid">
            {DIMENSIONS.map((d, i) => <article key={d.id}><span>0{i + 1}</span><h2>{d.name}</h2><p>{d.question}</p></article>)}
          </div>

          <div className="method-section-heading"><span className="eyebrow">02 · Tiers</span><h2>Rules, published and frozen</h2><p>Each dimension resolves to a tier via rules committed to the repository, calibrated once on the first real data pull, with a written justification per threshold.</p></div>
          <div className="stage-rules">
            <div><TierPill tier="Nascent" /><p>The ingredient is largely absent: minimal research share, no organized community, or no meaningful policy engagement.</p></div>
            <div><TierPill tier="Emerging" /><p>Present but partial: some research, a young community, engaged but uncommitted policymakers.</p></div>
            <div><TierPill tier="Established" /><p>A functioning ecosystem component, comparable to the stronger G20 countries.</p></div>
            <div><TierPill tier={null} pending="Collecting" /><p>Insufficient data. Missing observations are surfaced as missing — never scored as zero, never imputed.</p></div>
          </div>

          <div className="method-section-heading"><span className="eyebrow">03 · Data sources</span><h2>What each source contributes</h2><p>Every automated source is free and credential-less; every curated fact carries a source URL and access date; every chart value traces to an archived raw response.</p></div>
          <div className="source-table" role="table" aria-label="Data source ledger">
            <div className="source-row source-head" role="row"><span>Source</span><span>Role</span><span>What enters the assessment</span><span>Known limitation</span></div>
            {sourceLedger.map(s => <div className="source-row" role="row" key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name} ↗</a><strong>{s.role}</strong><p>{s.measures}</p><p>{s.caveat}</p></div>)}
          </div>

          <div className="method-notes">
            <div><h3>Reproducibility</h3><p>A monthly GitHub Actions workflow collects, archives raw responses, rebuilds the snapshot deterministically, and opens a pull request. Nothing publishes without human review.</p></div>
            <div><h3>Honest gaps</h3><p>Attention currently runs on partial data: GDELT throttles aggressively and Google Trends API access is pending. Affected tiers display as collecting, and no binding constraint is derived from incomplete evidence.</p></div>
            <div><h3>Known artifacts</h3><p>Research-share denominators are distorted for some countries by bulk indexing (notably Japan); flagged in the scoring configuration with fixes queued rather than silently adjusted.</p></div>
          </div>
          <button className="back-button" onClick={() => setView("explore")}>← Back to country explorer</button>
        </section>
      ) : (
        <>
          <section className="hero">
            <div><span className="eyebrow">AI Policy Windows Explorer · G20 · open data</span><h1>Where could capacity<br />make the <em>difference?</em></h1></div>
            <p>Mapping talent, attention, and policy readiness for AI governance across the G20 — on a mainstream track and a frontier-safety track — to find where field-building matters most.</p>
          </section>

          <div className="prototype-strip"><strong>Open source · reproducible</strong><span>Every number traces to an archived raw response or a cited primary source in the public repository. Data refreshes monthly through a reviewed pull request.</span><a href={REPO} target="_blank" rel="noreferrer">View the repository ↗</a></div>

          <section className="country-strip" aria-label="Country comparison">
            {codes.map(code => {
              const c = dataset.countries[code];
              return (
                <button key={code} className={code === selected ? "selected" : ""} onClick={() => setSelected(code)}>
                  <div><span className="country-code">{code}</span><TierPill tier={c.talent.frontier.tier} /></div>
                  <strong>{c.name}</strong>
                  <div className="mini-tiers">
                    {DIMENSIONS.map(d => <span key={d.id} className={`mini-tier tier-dot-${c[d.id].frontier.tier?.toLowerCase() ?? "pending"}`} title={`${d.name} (frontier): ${c[d.id].frontier.tier ?? "collecting"}`} />)}
                    <small>frontier track</small>
                  </div>
                  <span className="select-label">{code === selected ? "Viewing profile" : "View profile"} →</span>
                </button>
              );
            })}
          </section>

          <section className="profile" key={selected}>
            <div className="profile-heading">
              <div><span className="eyebrow">G20 · {selected}</span><h2>{country.name}</h2></div>
              <div className="stage-summary"><span>Suggested entry point</span><span className="constraint-headline">{constraint.headline}</span><small>{constraint.detail}</small></div>
            </div>

            {isOpportunityProfile(country) && <div className="data-warning opportunity">◆ Opportunity profile: mainstream-mature, frontier-empty — an active AI ecosystem with little or no organized safety field. This is the archetype where field-building has the highest leverage.</div>}

            <div className="section-title"><div><span className="eyebrow">Readiness profile</span><h2>Three dimensions, two tracks.</h2></div><p>Mainstream = AI as a general topic. Frontier = AI safety specifically. Click any figure for its definition, source, and archived inputs.</p></div>

            <div className="pillars dims">
              {DIMENSIONS.map((d, i) => {
                const block = country[d.id];
                return (
                  <article className="pillar-card" key={d.id}>
                    <div className="pillar-top"><span className="pillar-number">0{i + 1}</span></div>
                    <h3>{d.name}</h3>
                    <p className="pillar-question">{d.question}</p>
                    <TrackRow label="Mainstream" tier={block.mainstream.tier} />
                    <TrackRow label="Frontier" tier={block.frontier.tier} />
                    <div className="evidence-list">
                      <p className="absolute-label">Evidence</p>
                      {facts[d.id].map(f => <FactButton key={f.label} fact={f} onOpen={setFact} />)}
                      {d.id === "attention" && country.attention.mainstream.insufficient_data && <div className="evidence-empty">Media and search series still collecting — GDELT is rate-limited and Google Trends API access is pending. Shown as missing, never zero.</div>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      <footer className="site-footer">{variant === "brand" ? <a className="ea-wordmark" href="https://ettorearpini.com/" aria-label="Ettore Arpini, home">Ettore Arpini<span className="ea-logo-arrow">↗</span></a> : <div className="brand"><span>W/</span> WINDOW</div>}<p>An open-source project by <a href="https://ettorearpini.com/" target="_blank" rel="noreferrer">Ettore Arpini ↗</a></p><div className="footer-links"><button onClick={() => setView("method")}>Methodology</button><a href={REPO} target="_blank" rel="noreferrer">Source & data ↗</a></div></footer>
      <FactDrawer fact={fact} provenance={[...country.provenance.curated, ...country.provenance.raw]} onClose={() => setFact(null)} />
    </main>
  );
}
