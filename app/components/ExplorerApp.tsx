"use client";

import { useMemo, useState } from "react";
import type { CountrySnapshot, DimensionId, SnapshotV2, Tier } from "../types/snapshot";
import fieldBuilding from "../../data/curated/field_building.json";
import frontierChecklist from "../../data/curated/frontier_checklist.json";
import policyActivity from "../../data/curated/policy_activity.json";
import { CompareView, MapView } from "./CompareMap";

const FB = fieldBuilding as any, FC = frontierChecklist as any, PA = policyActivity as any;

const T2_SEARCH = '"AI safety" OR "AI alignment" OR "existential risk from artificial intelligence" OR "frontier model safety" OR "catastrophic AI risk"';
const oaBrowseT1 = (iso: string) => `https://openalex.org/works?filter=${encodeURIComponent(`primary_topic.subfield.id:subfields/1702,from_publication_date:2023-01-01,authorships.countries:${iso}`)}`;
const oaBrowseT2 = (iso: string) => `https://openalex.org/works?filter=${encodeURIComponent(`title_and_abstract.search:${T2_SEARCH},from_publication_date:2022-01-01,authorships.countries:${iso}`)}`;
const P2_ORDER = ["national_strategy", "frontier_risk_language", "bletchley_or_successor", "safety_institute", "binding_law"];
export const TRACK_LABEL = { mainstream: "AI overall", frontier: "AI safety" } as const;

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

interface FactItem { label: string; sub?: string; url?: string; ok?: boolean }
interface Fact { label: string; hint?: string; value: string; detail: string; sourceLabel: string; sourceUrl: string; items?: FactItem[]; itemsTitle?: string }

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
        {fact.items && fact.items.length > 0 && (
          <div className="fact-items">
            {fact.itemsTitle && <p className="absolute-label">{fact.itemsTitle}</p>}
            <ul>
              {fact.items.map((it, i) => (
                <li key={i} className={it.ok === undefined ? "" : it.ok ? "item-yes" : "item-no"}>
                  {it.url ? <a href={it.url} target="_blank" rel="noreferrer">{it.label} ↗</a> : <span>{it.label}</span>}
                  {it.sub && <small>{it.sub}</small>}
                </li>
              ))}
            </ul>
          </div>
        )}
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
    return { headline: `AI-safety ${dim.name.toLowerCase()}`, detail: `Of the three ingredients, ${dim.name.toLowerCase()} is currently the weakest on the AI-safety lens — the most promising place to start building.` };
  }
  const tiers = DIMENSIONS.map(d => ({ d, tier: c[d.id].frontier.tier })).filter(x => x.tier !== null);
  if (!tiers.length) return { headline: "Assessment incomplete", detail: "Attention data is still being gathered; no recommendation is made until all three ingredients have evidence." };
  const order: Tier[] = ["Nascent", "Emerging", "Established"];
  const lowest = tiers.sort((a, b) => order.indexOf(a.tier!) - order.indexOf(b.tier!))[0];
  if (lowest.tier === "Established") return { headline: "No weak spot found yet", detail: "Every AI-safety ingredient measured so far is Established. Attention data is still being gathered before a full assessment." };
  return { headline: `AI-safety ${lowest.d.name.toLowerCase()} (provisional)`, detail: `${lowest.d.name} is the weakest AI-safety ingredient measured so far. Attention data is still being gathered, so this may change.` };
}

export default function ExplorerApp({ dataset, variant = "window" }: { dataset: SnapshotV2; variant?: "window" | "brand" }) {
  const codes = useMemo(() => Object.keys(dataset.countries).sort((a, b) => dataset.countries[a].name.localeCompare(dataset.countries[b].name)), [dataset]);
  const [selected, setSelected] = useState(codes[0]);
  const [fact, setFact] = useState<Fact | null>(null);
  const [view, setView] = useState<"explore" | "compare" | "map" | "method">("explore");
  const country = dataset.countries[selected];

  const facts = useMemo(() => {
    const c = country;
    const tm = c.talent.mainstream, tf = c.talent.frontier, pm = c.policy.mainstream, pf = c.policy.frontier;
    const fbc = FB.countries[selected], fcc = FC.countries[selected], pac = PA.countries[selected];
    const f: Record<string, Fact[]> = {
      talent: [
        { label: "AI\u2019s share of the country\u2019s research", hint: `how much of ${c.name}\u2019s own research output is AI \u00b7 G20 reference: ${pct(tm.g20_median_share)}`, value: pct(tm.t1_ai_share), detail: `${tm.t1_ai_works?.toLocaleString() ?? "—"} AI works of ${tm.t1_total_works?.toLocaleString() ?? "—"} total works since 2023 (OpenAlex, by authorship country). Compared against a frozen G20 reference share of ${pct(tm.g20_median_share)}. Shares, never raw counts: raw counts mostly measure country size and indexing volume.`, sourceLabel: "OpenAlex", sourceUrl: "https://openalex.org/", itemsTitle: "Browse the underlying papers", items: [
          { label: `All ${tm.t1_ai_works?.toLocaleString() ?? ""} AI works from ${c.name} — live, filterable list`, url: oaBrowseT1(selected) },
          { label: "The denominator: every indexed work since 2023", url: `https://openalex.org/works?filter=${encodeURIComponent(`from_publication_date:2023-01-01,authorships.countries:${selected}`)}` },
        ] },
        { label: "AI-safety papers", hint: "since 2022, matching the pinned safety vocabulary", value: tf.t2_works?.toLocaleString() ?? "—", detail: "Works since 2022 matching the pinned safety search (AI safety, AI alignment, existential risk, frontier models, catastrophic risk) in title or abstract. Small numbers are the finding: this maps where the field does not yet exist.", sourceLabel: "OpenAlex", sourceUrl: "https://openalex.org/", itemsTitle: (tf.t2_sample && tf.t2_sample.length) ? "Most recent frontier papers" : "Browse the papers", items: [
          ...(tf.t2_sample ?? []).map(w => ({ label: w.title ?? "Untitled", sub: w.year ? String(w.year) : undefined, url: w.link ?? undefined })),
          { label: `Browse all ${tf.t2_works ?? ""} frontier works from ${c.name} on OpenAlex — live, filterable`, url: oaBrowseT2(selected) },
        ] },
        { label: "AI-safety orgs & student groups", hint: "verified active; gov institutes and frontier labs excluded", value: `${tf.t3_orgs + tf.t3_university_groups}${tf.t3_capped ? "+" : ""}`, detail: `${tf.t3_orgs} organization(s) and ${tf.t3_university_groups} university group(s) verified active, from public directories with per-entity activity signals and sources.${tf.t3_capped ? " Enumeration capped; the true total is higher." : ""}`, sourceLabel: "Curated dataset (field_building.json)", sourceUrl: `${REPO}/blob/main/data/curated/field_building.json`, itemsTitle: "The organizations and groups", items: (fbc?.entities ?? []).map((e: any) => ({ label: e.name, sub: `${e.type === "university_group" ? "University group" : "Organization"} · ${e.city_or_university} · ${e.active_signal}`, url: e.source })) },
      ],
      attention: [
        ...(c.attention.mainstream.a1_trend_ratio != null ? [{ label: "Media attention trend", hint: "last 12 months vs the 12 before, within this country", value: `×${c.attention.mainstream.a1_trend_ratio}`, detail: "Mean of the last 12 months of AI-governance media coverage (as % of the country's monitored articles, GDELT) over the mean of the prior 12. Within-country comparison only.", sourceLabel: "GDELT", sourceUrl: "https://www.gdeltproject.org/" }] : []),
        { label: "AI-alignment article in the local Wikipedia", hint: "existence resolved via interlanguage links", value: c.attention.frontier.alignment_article_exists_in_principal_language === null || c.attention.frontier.alignment_article_exists_in_principal_language === undefined ? "—" : c.attention.frontier.alignment_article_exists_in_principal_language ? "Exists" : "Missing", detail: "Whether the AI-alignment article exists in the country's principal-language Wikipedia, resolved via interlanguage links. Absence is a verified frontier-attention finding, not a data gap.", sourceLabel: "Wikimedia", sourceUrl: "https://wikimedia.org/api/rest_v1/" },
      ],
      policy: [
        { label: "National AI policy initiatives", hint: "listed on OECD.AI, with recency", value: pm.p1_oecd_initiative_count === null ? "n/a" : String(pm.p1_oecd_initiative_count), detail: `OECD.AI-listed national AI policy initiatives, coded '${pm.p1_activity_level}' activity overall. Latest significant action: ${pm.p1_latest_initiative.name} (${pm.p1_latest_initiative.year}).`, sourceLabel: "Curated dataset (policy_activity.json)", sourceUrl: `${REPO}/blob/main/data/curated/policy_activity.json`, itemsTitle: "The initiatives and bodies", items: [
          { label: `Latest: ${pm.p1_latest_initiative.name} (${pm.p1_latest_initiative.year})`, url: pm.p1_latest_initiative.source },
          ...(pac?.governance_bodies ?? []).map((b: any) => ({ label: b.name, url: b.source })),
          { label: `All ${pm.p1_oecd_initiative_count ?? ""} initiatives on the OECD.AI Policy Navigator`, url: pac?.oecd_source },
        ].filter((it: any) => it.url) },
        { label: "AI-safety commitments", hint: "five concrete items, each verified on a primary source", value: `${pf.p2_score}/5`, detail: "Five binary items, hand-coded from primary documents. Each item links to the source it was verified on.", sourceLabel: "Curated dataset (frontier_checklist.json)", sourceUrl: `${REPO}/blob/main/data/curated/frontier_checklist.json`, itemsTitle: "The five commitments", items: P2_ORDER.map(k => {
          const item = fcc?.items?.[k];
          return { label: `${pf.p2_items[k] ? "✓" : "✗"} ${P2_LABELS[k] ?? k}`, sub: item?.note, url: item?.source, ok: pf.p2_items[k] };
        }) },
      ],
    };
    return f;
  }, [country]);

  const constraint = constraintLabel(country);

  return (
    <main>
      <header className="site-header">
        {variant === "brand" ? <div className="header-brand"><a className="ea-wordmark" href="https://ettorearpini.com/" aria-label="Ettore Arpini, home">Ettore Arpini<span className="ea-logo-arrow">↗</span></a><span className="header-tool-title">|&nbsp; AI Policy Windows Explorer</span></div> : <button className="brand" onClick={() => setView("explore")}><span>W/</span> WINDOW</button>}
        <nav aria-label="Primary"><button className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Explore</button><button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>Compare</button><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Map</button><button className={view === "method" ? "active" : ""} onClick={() => setView("method")}>Methodology</button></nav>
        <div className="status-dot"><i /> Snapshot {dataset.snapshot}{dataset.provisional_thresholds ? " · provisional tiers" : ""}</div>
      </header>

      {view === "compare" ? (
        <CompareView dataset={dataset} onCountry={(iso) => { setSelected(iso); setView("explore"); }} />
      ) : view === "map" ? (
        <MapView dataset={dataset} onCountry={(iso) => { setSelected(iso); setView("explore"); }} />
      ) : view === "method" ? (
        <section className="method-page">
          <span className="eyebrow">Methodology · G20 edition · snapshot {dataset.snapshot}</span>
          <h1>Three dimensions, two tracks—<br /><em>and no composite index.</em></h1>
          <p className="method-lead">The explorer grades each country on Talent, Attention, and Policy — twice. The "AI overall" lens asks whether AI is on the country's radar at all; the "AI safety" lens asks specifically about work on serious risks from advanced systems, where sparse data is itself the finding. A country strong on the first and empty on the second is exactly where new safety work goes furthest. (In the methodology document these lenses are called the mainstream and frontier tracks.) The safety lens is read as governance capacity, not as a race to host alignment labs: technical safety research concentrates where frontier models are built, and the question for every other country is whether it can understand and act on advanced-AI risks in its own context.</p>
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

          <div className="method-section-heading"><span className="eyebrow">03 · The indicators, exactly</span><h2>How each number is calculated</h2><p>Plain definitions first; the frozen queries and thresholds live in the repository's config files.</p></div>
          <ol className="method-steps">
            <li><strong>AI&rsquo;s share of the country&rsquo;s research</strong><span>Works whose primary topic falls in OpenAlex&rsquo;s Artificial Intelligence subfield, authored from the country since 2023, divided by ALL of the country&rsquo;s indexed works in the same window. It measures how much of the country&rsquo;s own research is about AI &mdash; not the country&rsquo;s share of world AI research &mdash; so small countries are not penalized for size. Graded against a frozen G20 reference share (2.03%).</span></li>
            <li><strong>AI-safety papers</strong><span>Count of works since 2022 whose title or abstract matches a pinned vocabulary: &ldquo;AI safety&rdquo;, &ldquo;AI alignment&rdquo;, &ldquo;existential risk from artificial intelligence&rdquo;, &ldquo;frontier model safety&rdquo;, &ldquo;catastrophic AI risk&rdquo;. An absolute count &mdash; small numbers are the finding. Known bias: work using mainstream-ML language without these terms is missed.</span></li>
            <li><strong>AI-safety orgs &amp; student groups</strong><span>Verified-active organizations and university groups from public directories, each entry carrying an activity signal and source URL. Government safety institutes and frontier labs are excluded &mdash; this measures civil society. A good-faith floor, refreshed quarterly.</span></li>
            <li><strong>Media attention</strong><span>The share of a country&rsquo;s monitored media coverage (GDELT) matching local-language queries &mdash; AI plus governance terms on the broad lens, safety phrases on the safety lens. Graded only on each country&rsquo;s own 12-month trend; never compared across countries, because media systems differ.</span></li>
            <li><strong>Search interest</strong><span>Google Trends for local equivalents of &ldquo;AI risks&rdquo; and &ldquo;AI regulation&rdquo;, interpreted within-country. Pending official API access; absent until then, never imputed.</span></li>
            <li><strong>Wikipedia signal</strong><span>Whether safety articles (e.g. AI alignment) exist in the country&rsquo;s principal-language Wikipedia &mdash; resolved through interlanguage links, so absence is verified &mdash; plus monthly pageviews. Language communities are not countries; corroborating evidence only.</span></li>
            <li><strong>National AI policy initiatives</strong><span>The count and recency of the country&rsquo;s initiatives on the OECD.AI Policy Navigator, hand-checked quarterly and coded into low / medium / high activity. Counts measure breadth of reported policy activity, not binding regulation.</span></li>
            <li><strong>AI-safety commitments</strong><span>Five binary items, each requiring a linked primary source: a national AI strategy exists; official documents use frontier / systemic-risk language; the country signed Bletchley or a successor declaration; it has a safety institute or International Network membership; binding AI law is in force or in advanced passage. The score is the count of yeses.</span></li>
          </ol>

          <div className="method-section-heading"><span className="eyebrow">04 · Data sources</span><h2>What each source contributes</h2><p>Every automated source is free and credential-less; every curated fact carries a source URL and access date; every chart value traces to an archived raw response.</p></div>
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
            <p>AI rules are being written everywhere — but the capacity to shape them well is not. This explorer measures, for every G20 country, whether the ingredients of good AI governance exist: researchers, public attention, and prepared institutions — with special attention to AI safety, the part of the field focused on serious risks from advanced systems.</p>
          </section>

          <div className="prototype-strip"><strong>Open data · updates monthly</strong><span>Every number on this site links to its source — an academic database, an official document, or an archived data pull. The full dataset, methodology, and code are public.</span><a href={REPO} target="_blank" rel="noreferrer">View the repository ↗</a></div>

          <section className="howto">
            <div className="section-title"><div><span className="eyebrow">How to read this</span><h2>Three ingredients, two lenses.</h2></div><p>When a political moment for AI policy arrives — an election, an incident, an international commitment — only countries with these ingredients in place can use it.</p></div>
            <div className="howto-grid">
              <article><h3>Talent</h3><p>Researchers working on AI — and on AI safety specifically — plus the groups and organizations that turn research into a field. For most countries the goal is not a frontier lab: it is local expertise that can advise government.</p></article>
              <article><h3>Attention</h3><p>Whether AI and its risks are part of the public conversation, measured in each country's own language.</p></article>
              <article><h3>Policy</h3><p>What the government has actually done: strategies, laws, institutions, and international commitments.</p></article>
            </div>
            <div className="howto-note">
              <p>Each ingredient is graded twice. The <strong>AI overall</strong> lens asks whether the country is engaged with AI and its governance at all — its AI research base, its public conversation about AI and its regulation, its AI policy activity. The <strong>AI safety</strong> lens narrows to the field focused on serious risks from advanced AI systems — both its technical research and its policy work — as distinct from AI ethics or AI regulation in general. Technical safety research naturally concentrates in the few countries building frontier AI; for everyone else, the real question is governance capacity — whether the country can understand what advanced AI means for its economy, security, and place in the world, and act on it, at home and in international coalitions. The grades: <span className="stage tier-nascent"><i />Nascent</span> largely absent · <span className="stage tier-emerging"><i />Emerging</span> present but partial · <span className="stage tier-established"><i />Established</span> comparable to the strongest G20 countries. Where data is still being gathered, a grade shows as <span className="stage tier-pending"><i />Collecting</span> — never as a guess.</p>
            </div>
          </section>

          <section className="country-strip" aria-label="Country comparison">
            {codes.map(code => {
              const c = dataset.countries[code];
              return (
                <button key={code} className={code === selected ? "selected" : ""} onClick={() => setSelected(code)}>
                  <div><span className="country-code">{code}</span><span title="Talent grade on the AI-safety lens"><TierPill tier={c.talent.frontier.tier} /></span></div>
                  <strong>{c.name}</strong>
                  <div className="mini-tiers">
                    {DIMENSIONS.map(d => <span key={d.id} className={`mini-tier tier-dot-${c[d.id].frontier.tier?.toLowerCase() ?? "pending"}`} title={`${d.name} (frontier): ${c[d.id].frontier.tier ?? "collecting"}`} />)}
                    <small>AI safety lens</small>
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

            {isOpportunityProfile(country) && <div className="data-warning opportunity">◆ High-leverage profile: this country is highly active on AI overall, but has little or no organized AI-safety field. The missing piece is not a frontier lab — it is a local community able to think through what advanced AI means for the country and prepare its response. That is where new talent, attention, and policy work go furthest.</div>}

            <div className="section-title"><div><span className="eyebrow">Readiness profile</span><h2>Three ingredients, two lenses.</h2></div><p>Each card grades one ingredient on both lenses. Click any figure to see what it means, where it comes from, and the underlying items — papers, organizations, laws.</p></div>

            <div className="pillars dims">
              {DIMENSIONS.map((d, i) => {
                const block = country[d.id];
                return (
                  <article className="pillar-card" key={d.id}>
                    <div className="pillar-top"><span className="pillar-number">0{i + 1}</span></div>
                    <h3>{d.name}</h3>
                    <p className="pillar-question">{d.question}</p>
                    <TrackRow label="AI overall" tier={block.mainstream.tier} />
                    <TrackRow label="AI safety" tier={block.frontier.tier} />
                    <div className="evidence-list">
                      <p className="absolute-label">Evidence</p>
                      {facts[d.id].map(f => <FactButton key={f.label} fact={f} onOpen={setFact} />)}
                      {d.id === "attention" && country.attention.mainstream.insufficient_data && <div className="evidence-empty">Media-coverage and search-interest data for this country is still being gathered (the sources limit how fast we can collect). Until it arrives, the grade reads "collecting" — never a made-up zero.</div>}
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
