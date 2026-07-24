"use client";

import { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { snapMonth } from "../format";
import type { DimensionId, SnapshotV2, Tier, Track } from "../types/snapshot";
import fieldBuilding from "../../data/curated/field_building.json";
import policyActivity from "../../data/curated/policy_activity.json";
import frontierChecklist from "../../data/curated/frontier_checklist.json";
const FBM = fieldBuilding as any, PAM = policyActivity as any, FCM = frontierChecklist as any;

const P2_ORDER = ["national_strategy", "frontier_risk_language", "bletchley_or_successor", "safety_institute", "binding_law"];
const P2_LABELS: Record<string, string> = {
  national_strategy: "National AI strategy exists",
  frontier_risk_language: "Frontier / systemic-risk language in official documents",
  bletchley_or_successor: "Signed Bletchley or successor declaration",
  safety_institute: "AI safety institute or International Network membership",
  binding_law: "Binding AI law in force or advanced passage",
};

const TIER_FILL: Record<string, string> = { Established: "#2F6E7B", Emerging: "#E2A33C", Nascent: "#C0512E" };
const TRACK_LABEL = { mainstream: "AI governance overall", frontier: "AI safety" } as const;
const TIERS: Tier[] = ["Nascent", "Emerging", "Established"];
const DIMS: { id: DimensionId; name: string }[] = [
  { id: "talent", name: "The field" }, { id: "attention", name: "The public" }, { id: "policy", name: "The government" },
];

// world-atlas uses ISO 3166 numeric ids
const ISO_NUM: Record<string, string> = {
  AR: "032", AU: "036", BR: "076", CA: "124", CN: "156", FR: "250", DE: "276", IN: "356", ID: "360",
  IT: "380", JP: "392", MX: "484", RU: "643", SA: "682", ZA: "710", KR: "410", TR: "792", GB: "826", US: "840",
};
const NUM_ISO = Object.fromEntries(Object.entries(ISO_NUM).map(([k, v]) => [v, k]));

type Metric = { key: string; label: string; fmt: (v: number) => string; get: (c: any) => number | null };
const METRICS: Metric[] = [
  { key: "t1", label: "AI\u2019s share of all research output", fmt: v => `${(v * 100).toFixed(2)}%`, get: c => c.talent.mainstream.t1_ai_share },
  { key: "t2", label: "AI-safety papers (since 2022)", fmt: v => v.toLocaleString(), get: c => c.talent.frontier.t2_works },
  { key: "t3", label: "AI-safety orgs & student groups", fmt: v => String(v), get: c => c.talent.frontier.t3_orgs + c.talent.frontier.t3_university_groups },
  { key: "p1", label: "National AI policy initiatives", fmt: v => String(v), get: c => c.policy.mainstream.p1_oecd_initiative_count },
  { key: "t2i", label: "AI-safety share of the country\u2019s AI research", fmt: v => `${(v * 100).toFixed(2)}%`, get: c => (c.talent.frontier.t2_works != null && c.talent.mainstream.t1_ai_works) ? c.talent.frontier.t2_works / c.talent.mainstream.t1_ai_works : null },
  { key: "p2", label: "AI-safety commitments (0–5)", fmt: v => `${v}/5`, get: c => c.policy.frontier.p2_score },
];

function TierCell({ tier }: { tier: Tier | null }) {
  if (!tier) return <td className="cmp-cell tier-cell-pending"><span className="mini-tier tier-dot-pending" />Collecting</td>;
  return <td className={`cmp-cell tier-cell-${tier.toLowerCase()}`}><span className={`mini-tier tier-dot-${tier.toLowerCase()}`} />{tier}</td>;
}

export function CompareView({ dataset, onCountry }: { dataset: SnapshotV2; onCountry: (iso: string) => void }) {
  const [panel, setPanel] = useState<string | null>(null);
  const [track, setTrack] = useState<Track>("frontier");
  const [rankBy, setRankBy] = useState<string>("t2");
  const [land, setLand] = useState<"research" | "intensity" | "talent" | "policy">("research");
  const [tblSort, setTblSort] = useState<{ col: "name" | DimensionId; dir: 1 | -1 }>({ col: "name", dir: 1 });
  const [activeSec, setActiveSec] = useState("cmp-table");
  const codes = Object.keys(dataset.countries);

  // Headline numbers (MIT-style stat tiles)
  const tiles = useMemo(() => {
    const cs = codes.map(c => dataset.countries[c]);
    const totalPapers = cs.reduce((s, c) => s + (c.talent.frontier.t2_works ?? 0), 0);
    const sorted = [...cs].sort((x, y) => (y.talent.frontier.t2_works ?? 0) - (x.talent.frontier.t2_works ?? 0));
    const top3 = sorted.slice(0, 3).reduce((s, c) => s + (c.talent.frontier.t2_works ?? 0), 0);
    const fewOrgs = cs.filter(c => (c.talent.frontier.t3_orgs + c.talent.frontier.t3_university_groups) <= 1).length;
    const committed = cs.filter(c => c.policy.frontier.p2_score >= 4).length;
    return [
      { n: totalPapers.toLocaleString(), l: "AI-safety papers across the G20", s: "since 2022" },
      { n: `${Math.round((top3 / totalPapers) * 100)}%`, l: "of them from just three countries", s: "US, UK, Canada" },
      { n: String(fewOrgs), l: "countries with at most one safety organization", s: "of 19 covered" },
      { n: `${committed}/19`, l: "countries with 4+ of 5 safety commitments", s: "Bletchley, institutes, risk language, law" },
    ];
  }, [dataset]);

  // Computed section headlines — numbers recompute per snapshot, so they can't go stale
  const estCounts = useMemo(() => {
    const cs = codes.map(c => dataset.countries[c]);
    const est = (d: DimensionId) => cs.filter(c => (c as any)[d][track].tier === "Established").length;
    return { field: est("talent"), gov: est("policy") };
  }, [dataset, track]);

  const rankMetric = METRICS.find(m => m.key === rankBy) ?? METRICS[1];
  const rankHeadline = useMemo(() => {
    const vals = codes.map(c => ({ c: dataset.countries[c], v: rankMetric.get(dataset.countries[c]) ?? 0 }))
      .sort((a, b) => b.v - a.v);
    const stripped = rankMetric.label.replace(/\s*\(.*\)$/, "");
    // decapitalize for mid-sentence use, but never break the "AI" acronym
    const short = stripped.startsWith("AI") ? stripped : stripped.charAt(0).toLowerCase() + stripped.slice(1);
    if (["t2", "t3", "p1"].includes(rankMetric.key)) {
      const total = vals.reduce((s, x) => s + x.v, 0);
      const top3 = vals.slice(0, 3).reduce((s, x) => s + x.v, 0);
      return total ? `${Math.round((top3 / total) * 100)}% of the G20\u2019s ${short} come from three countries.` : "The rankings.";
    }
    return vals[0] ? `${vals[0].c.name} leads the G20 on ${short}.` : "The rankings.";
  }, [dataset, rankBy]);

  const rows = useMemo(() => {
    const r = codes.map(code => ({ code, c: dataset.countries[code] }));
    if (tblSort.col === "name") r.sort((a, b) => a.c.name.localeCompare(b.c.name) * tblSort.dir);
    else {
      const rk = (c: any) => { const t = c[tblSort.col][track].tier; return t ? TIERS.indexOf(t) : -1; };
      r.sort((a, b) => (rk(a.c) - rk(b.c)) * tblSort.dir || a.c.name.localeCompare(b.c.name));
    }
    return r;
  }, [dataset, tblSort, track]);

  // Scrollspy for the sticky section nav
  useEffect(() => {
    const ids = ["cmp-table", "cmp-rankings", "cmp-landscape"];
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActiveSec((e.target as HTMLElement).id);
    }, { rootMargin: "-130px 0px -55% 0px" });
    ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const sortTh = (col: "name" | DimensionId, label: React.ReactNode, note?: React.ReactNode) => (
    <th key={String(col)} aria-sort={tblSort.col === col ? (tblSort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button className="th-sort" onClick={() => setTblSort(s => s.col === col ? { col, dir: -s.dir as 1 | -1 } : { col, dir: col === "name" ? 1 : -1 })}>
        {label}{tblSort.col === col ? (tblSort.dir === 1 ? " \u2191" : " \u2193") : ""}
      </button>
      {note}
    </th>
  );

  return (
    <section className="compare-page">
      <div className="section-title"><div><span className="eyebrow">Compare · {snapMonth(dataset.snapshot)}</span><h2>All countries, side by side.</h2></div><p>Three views, one scroll: the grades, the rankings behind them, and the landscape of gaps. Click any country, bar, or dot to open its details in a side panel.</p></div>
      <div className="stat-tiles">
        {tiles.map((t, i) => <div className="stat-tile" key={i}><strong>{t.n}</strong><span>{t.l}</span><small>{t.s}</small></div>)}
      </div>

      <nav className="cmp-subnav" aria-label="Compare sections">
        {([["cmp-table", "01 · The grades"], ["cmp-rankings", "02 · The rankings"], ["cmp-landscape", "03 · The landscape"]] as const).map(([id, label]) => (
          <button key={id} className={activeSec === id ? "active" : ""} aria-current={activeSec === id || undefined} onClick={() => jump(id)}>{label}</button>
        ))}
      </nav>

      <div className="cmp-section" id="cmp-table">
        <div className="section-title"><div><span className="eyebrow">01 · The grades</span><h2>Who has the ingredients in place?</h2><p className="section-answer">{estCounts.field} of 19 are Established in the field — {estCounts.gov} in government, on the {TRACK_LABEL[track]} lens.</p></div><p>Every sphere, every country, one lens at a time. Click a column header to sort, or a country for its details.</p></div>
        <div className="cmp-controls">
          <div className="range-toggle" role="tablist" aria-label="Lens">
            <button className={track === "frontier" ? "active" : ""} onClick={() => setTrack("frontier")}>AI safety lens</button>
            <button className={track === "mainstream" ? "active" : ""} onClick={() => setTrack("mainstream")}>AI governance overall lens</button>
          </div>
        </div>
        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead><tr>
              {sortTh("name", "Country")}
              {DIMS.map(d => sortTh(d.id, d.name, d.id === "attention" ? <small className="th-note">data arriving monthly</small> : undefined))}
            </tr></thead>
            <tbody>
              {rows.map(({ code, c }) => (
                <tr key={code}>
                  <td className="cmp-country"><button onClick={() => setPanel(code)}>{c.name} <i>→</i></button></td>
                  {DIMS.map(d => <TierCell key={d.id} tier={(c as any)[d.id][track].tier} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cmp-note">Grade colors: <span className="mini-tier tier-dot-nascent" /> Nascent · <span className="mini-tier tier-dot-emerging" /> Emerging · <span className="mini-tier tier-dot-established" /> Established · <span className="mini-tier tier-dot-pending" /> Collecting. Attention grades await complete media and search data and show as Collecting — never guessed.</p>
      </div>

      <div className="cmp-section" id="cmp-rankings">
        <div className="section-title"><div><span className="eyebrow">02 · The rankings</span><h2>Where does the work concentrate?</h2><p className="section-answer">{rankHeadline}</p></div><p>The raw numbers behind the grades, one indicator at a time. Hover a bar for each country's share of the G20 total.</p></div>
        <div className="cmp-controls">
          <label className="cmp-sort">Indicator{" "}
            <select value={rankBy} onChange={e => setRankBy(e.target.value)}>
              {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        </div>
        <ChartPanel dataset={dataset} metric={rankMetric} onCountry={setPanel} view="ranking" />
      </div>

      <div className="cmp-section" id="cmp-landscape">
        <div className="section-title"><div><span className="eyebrow">03 · The landscape</span><h2>{LANDSCAPES[land].question}</h2><p className="section-answer">{LANDSCAPES[land].answer}</p></div><p>Two indicators at a time, every country on one canvas. Click any dot for details.</p></div>
        <div className="cmp-controls">
          <div className="range-toggle" role="tablist" aria-label="Landscape">
            <button className={land === "research" ? "active" : ""} onClick={() => setLand("research")}>Research</button>
            <button className={land === "intensity" ? "active" : ""} onClick={() => setLand("intensity")}>Safety intensity</button>
            <button className={land === "talent" ? "active" : ""} onClick={() => setLand("talent")}>The field</button>
            <button className={land === "policy" ? "active" : ""} onClick={() => setLand("policy")}>The government</button>
          </div>
        </div>
        <ChartPanel dataset={dataset} metric={rankMetric} onCountry={setPanel} view={land} />
      </div>

      {panel && (
        <div className="drawer-backdrop" onMouseDown={() => setPanel(null)}>
          <aside className="drawer cmp-drawer" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Country details">
            <CountryDetail dataset={dataset} iso={panel} onCountry={onCountry} onClose={() => setPanel(null)} />
          </aside>
        </div>
      )}
    </section>
  );
}

/** Shared country detail card: evidence grouped by indicator, each group
 *  expandable with the underlying items and sources. Used inline on the map
 *  and as a slide-in panel on Compare. */
export function CountryDetail({ dataset, iso, onCountry, onClose }: { dataset: SnapshotV2; iso: string; onCountry: (iso: string) => void; onClose: () => void }) {
  const sel = dataset.countries[iso];
  const selFB = FBM.countries[iso];
  const selPA = PAM.countries[iso];
  const selFC = FCM.countries[iso];
  if (!sel) return null;
  const tm = sel.talent.mainstream, tf = sel.talent.frontier, pm = sel.policy.mainstream, pf = sel.policy.frontier;
  const t3 = tf.t3_orgs + tf.t3_university_groups;
  const samples = (tf.t2_sample ?? []).filter((w, i, a) => a.findIndex(x => x.title === w.title) === i).slice(0, 3);
  const oaT2 = `https://openalex.org/works?filter=${encodeURIComponent(`title_and_abstract.search:"AI safety" OR "AI alignment" OR "existential risk from artificial intelligence" OR "frontier model safety" OR "catastrophic AI risk",from_publication_date:2022-01-01,authorships.countries:${iso}`)}`;
  const oaT1 = `https://openalex.org/works?filter=${encodeURIComponent(`primary_topic.subfield.id:subfields/1702,from_publication_date:2023-01-01,authorships.countries:${iso}`)}`;
  return (
    <>
      <div className="map-detail-head">
        <h3>{sel.name}</h3>
        <button className="map-detail-open" onClick={() => onCountry(iso)}>View full profile →</button>
        <button className="map-detail-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="detail-grades"><span>Grades, AI-safety lens:</span>{DIMS.map(d => { const t = (sel as any)[d.id].frontier.tier; return <span key={d.id} className="detail-grade"><i className={`mini-tier tier-dot-${t?.toLowerCase() ?? "pending"}`} />{d.name.replace("The ", "")}: {t ?? "Collecting"}</span>; })}</div>
      <div className="detail-groups">

        <details className="detail-group" open>
          <summary><span>AI-safety commitments</span><strong>{pf.p2_score}/5</strong></summary>
          <p className="dg-note">Five binary items, hand-coded from primary documents — the score counts the yeses. Each item links to the source it was verified on.</p>
          <ul className="p2-list">
            {P2_ORDER.map(k => {
              const yes = pf.p2_items[k];
              const item = selFC?.items?.[k];
              return (
                <li key={k} className={yes ? "p2-yes" : "p2-no"}>
                  <span className="p2-mark">{yes ? "✓" : "✗"}</span>
                  <span className="p2-body">
                    {item?.source ? <a href={item.source} target="_blank" rel="noreferrer">{P2_LABELS[k]} ↗</a> : P2_LABELS[k]}
                    {item?.note && <small>{item.note}</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>

        <details className="detail-group" open>
          <summary><span>AI-safety papers since 2022</span><strong>{tf.t2_works?.toLocaleString() ?? "—"}</strong></summary>
          <p className="dg-note">Works matching the pinned safety vocabulary (AI safety, alignment, existential risk, frontier model safety, catastrophic risk).</p>
          <ul className="map-links">
            {samples.map((w, i) => <li key={i}>{w.link ? <a href={w.link} target="_blank" rel="noreferrer">{w.title} ↗</a> : <span>{w.title}</span>}<small>{w.year ? `Published ${w.year}` : "Recent paper"}</small></li>)}
            <li><a href={oaT2} target="_blank" rel="noreferrer">Browse {tf.t2_works === 1 ? "the 1 paper" : `all ${tf.t2_works ?? ""} papers`} on OpenAlex ↗</a><small>Live, filterable list</small></li>
          </ul>
        </details>

        <details className="detail-group" open>
          <summary><span>AI-safety orgs & student groups</span><strong>{t3}{tf.t3_capped ? "+" : ""}</strong></summary>
          <p className="dg-note">Verified-active organizations and university groups; government institutes and frontier labs excluded.</p>
          {(selFB?.entities?.length ?? 0) > 0 ? (
            <ul className="map-links">
              {(selFB.entities as any[]).map((e, i) => <li key={i}><a href={e.source} target="_blank" rel="noreferrer">{e.name} ↗</a><small>{e.type === "university_group" ? "University group" : "Organization"} · {e.city_or_university}</small></li>)}
            </ul>
          ) : <p className="dg-empty">None found — that absence is the finding, not a data gap.</p>}
        </details>

        <details className="detail-group">
          <summary><span>National AI policy initiatives</span><strong>{pm.p1_oecd_initiative_count ?? "n/a"}</strong></summary>
          <p className="dg-note">Initiatives listed on the OECD.AI Policy Navigator, coded ‘{pm.p1_activity_level}’ activity overall.</p>
          <ul className="map-links">
            {selPA?.latest_initiative?.source && <li><a href={selPA.latest_initiative.source} target="_blank" rel="noreferrer">{selPA.latest_initiative.name} ↗</a><small>Latest significant move · {selPA.latest_initiative.year}</small></li>}
            {(selPA?.governance_bodies ?? []).map((b: any, i: number) => <li key={i}><a href={b.source} target="_blank" rel="noreferrer">{b.name} ↗</a><small>Governance body</small></li>)}
            {selPA?.oecd_source && <li><a href={selPA.oecd_source} target="_blank" rel="noreferrer">All initiatives on the OECD.AI Navigator ↗</a><small>External database</small></li>}
          </ul>
        </details>

        <details className="detail-group">
          <summary><span>AI’s share of the country’s research</span><strong>{tm.t1_ai_share != null ? `${(tm.t1_ai_share * 100).toFixed(2)}%` : "—"}</strong></summary>
          <p className="dg-note">{tm.t1_ai_works?.toLocaleString() ?? "—"} AI works of {tm.t1_total_works?.toLocaleString() ?? "—"} total works since 2023 — all AI research, not just safety or governance.</p>
          <ul className="map-links">
            <li><a href={oaT1} target="_blank" rel="noreferrer">Browse the AI works on OpenAlex ↗</a><small>Live, filterable list</small></li>
          </ul>
        </details>

      </div>
    </>
  );
}

type LandscapeCfg = {
  title: string; sub: string; xLabel: string; yLabel: string;
  x: (c: any) => number; y: (c: any) => number; sqrtY: boolean;
  xFmt: (v: number) => string; yFmt: (v: number) => string;
  tier: (c: any) => Tier | null; tierLabel: string;
  /** quadrant labels, split at the G20 medians; br is the gap/opportunity quadrant */
  quads: { tl: string; tr: string; bl: string; br: string };
  /** section headline (question form) and answer line, swapped per landscape */
  question: string; answer: string;
};

const LANDSCAPES: Record<string, LandscapeCfg> = {
  research: {
    title: "The research landscape: all AI vs AI safety",
    question: "Who is busy with AI, but missing the safety side?",
    answer: "Start at the lower-right: a big AI research base, few safety papers.",
    sub: "Each dot is a country. Right = AI of any kind — methods, applications, everything — is a big share of national research. Up = more AI-safety papers. Low and to the right: deep in AI, not yet engaging its safety.",
    xLabel: "All AI research as a share of the country’s output \u2192",
    yLabel: "AI-safety papers (\u221a scale) \u2192",
    x: c => c.talent.mainstream.t1_ai_share ?? 0, y: c => c.talent.frontier.t2_works ?? 0, sqrtY: true,
    xFmt: v => `${(v * 100).toFixed(2)}%`, yFmt: v => v.toLocaleString(),
    tier: c => c.talent.frontier.tier, tierLabel: "field grade, AI-safety lens",
    quads: { tl: "Safety-leaning", tr: "Deep in both", bl: "Early on both", br: "AI without safety" },
  },
  intensity: {
    title: "Safety intensity: AI focus vs the safety share of that AI work",
    question: "Whose AI research engages its own safety?",
    answer: "Lower-right: deep in AI, and almost none of that work touches safety.",
    sub: "Right = AI of any kind is a big slice of the country\u2019s total research. Up = a big slice of that AI research engages safety. Low-right: deep in AI, and almost none of it touches safety.",
    xLabel: "All AI research as a share of the country’s output →",
    yLabel: "AI safety as a share of the country’s AI research (√ scale) →",
    x: c => c.talent.mainstream.t1_ai_share ?? 0,
    y: c => (c.talent.frontier.t2_works != null && c.talent.mainstream.t1_ai_works) ? c.talent.frontier.t2_works / c.talent.mainstream.t1_ai_works : 0,
    sqrtY: true,
    xFmt: v => `${(v * 100).toFixed(2)}%`, yFmt: v => `${(v * 100).toFixed(2)}%`,
    tier: c => c.talent.frontier.tier, tierLabel: "field grade, AI-safety lens",
    quads: { tl: "Safety-leaning", tr: "Deep in both", bl: "Early on both", br: "AI without safety" },
  },
  talent: {
    title: "The field landscape: safety research vs organized community",
    question: "Where is research missing a community — and vice versa?",
    answer: "Lower-right: papers without organized groups. Upper-left: organizers ahead of the research.",
    sub: "Right = AI-safety papers exist. Up = safety organizations and student groups exist. Low-right: researchers without a field around them. High-left: organizers ahead of the research (like Argentina).",
    xLabel: "AI-safety papers since 2022 (\u221a scale) \u2192",
    yLabel: "Safety orgs & student groups \u2192",
    x: c => c.talent.frontier.t2_works ?? 0, y: c => c.talent.frontier.t3_orgs + c.talent.frontier.t3_university_groups, sqrtY: false,
    xFmt: v => v.toLocaleString(), yFmt: v => String(v),
    tier: c => c.talent.frontier.tier, tierLabel: "field grade, AI-safety lens",
    quads: { tl: "Organizers ahead of research", tr: "Field and community", bl: "Not yet started", br: "Research without community" },
  },
  policy: {
    title: "The government landscape: AI policy activity vs safety commitments",
    question: "Which governments are busy with AI but uncommitted on safety?",
    answer: "Lower-right: plenty of AI policy activity, few concrete safety commitments.",
    sub: "Right = lots of national AI policy activity. Up = concrete safety commitments (declarations, institutes, risk language, law). Low-right: governments busy with AI that have not yet engaged its serious risks.",
    xLabel: "National AI policy initiatives (OECD.AI) \u2192",
    yLabel: "Safety commitments (0\u20135) \u2192",
    x: c => c.policy.mainstream.p1_oecd_initiative_count ?? 0, y: c => c.policy.frontier.p2_score, sqrtY: false,
    xFmt: v => String(v), yFmt: v => `${v}/5`,
    tier: c => c.policy.frontier.tier, tierLabel: "government grade, AI-safety lens",
    quads: { tl: "Committed, little activity", tr: "Engaged and committed", bl: "Not yet engaged", br: "Busy, not committed" },
  },
};

function ChartPanel({ dataset, metric, onCountry, view }: { dataset: SnapshotV2; metric: Metric; onCountry: (iso: string) => void; view: "ranking" | "research" | "intensity" | "talent" | "policy" }) {
  const [tip, setTip] = useState<{ text: string[]; x: number; y: number } | null>(null);
  const rows = Object.keys(dataset.countries)
    .map(code => ({ code, c: dataset.countries[code], v: metric.get(dataset.countries[code]) }))
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  const max = Math.max(...rows.map(r => r.v ?? 0));
  const total = rows.reduce((s, r) => s + (r.v ?? 0), 0);
  const additive = ["t2", "t3", "p1"].includes(metric.key);
  const W = 980, RH = 30, LW = 150, top = 8;
  const H = top + rows.length * RH + 8;

  const cfg = view !== "ranking" ? LANDSCAPES[view] : null;
  const sc = cfg ? Object.keys(dataset.countries).map(code => {
    const c = dataset.countries[code];
    return { code, x: cfg.x(c), y: cfg.y(c), tier: cfg.tier(c) };
  }) : [];
  const SW = 980, SH = 420, SP = { l: 56, r: 24, t: 16, b: 44 };
  const xT = (x: number) => (view === "talent" ? Math.sqrt(x) : x);
  const yT = (y: number) => (cfg && cfg.sqrtY ? Math.sqrt(y) : y);
  const xMax = cfg ? Math.max(...sc.map(d => xT(d.x))) * 1.1 : 1;
  const yMax = cfg ? Math.max(...sc.map(d => yT(d.y))) * 1.12 : 1;
  const sx = (x: number) => SP.l + (xT(x) / xMax) * (SW - SP.l - SP.r);
  const sy = (y: number) => SH - SP.b - (yT(y) / yMax) * (SH - SP.t - SP.b);
  // Real-value axis ticks: pick candidates at even positions along the
  // (possibly sqrt-scaled) axis, round each to a nice number, and place the
  // tick at the rounded value's own coordinate - labels are always truthful.
  const niceNum = (v: number) => {
    if (v <= 0) return 0;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };
  const ticksFor = (maxT: number, invT: (t: number) => number, fwdT: (v: number) => number) =>
    [...new Set([0.25, 0.5, 0.75, 0.95].map(f => niceNum(invT(f * maxT))))]
      .filter(v => v > 0 && fwdT(v) <= maxT);
  const xTicks = cfg ? ticksFor(xMax, view === "talent" ? (t => t * t) : (t => t), xT) : [];
  const yTicks = cfg ? ticksFor(yMax, cfg.sqrtY ? (t => t * t) : (t => t), yT) : [];
  const tickText = (fmt: (v: number) => string, v: number) =>
    fmt(v).replace(/\.0+%$/, "%").replace(/(\.\d*?)0+%$/, "$1%");

  return (
    <div className="chartpanel">
      {view === "ranking" && <div className="chart-block">
        <h3>{metric.label} — all 19 countries</h3>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric.label} by country`}>
          {rows.map((r, i) => {
            const y = top + i * RH;
            const bw = r.v && max ? Math.max((r.v / max) * (W - LW - 110 - 16), 2) : 0;
            return (
              <g key={r.code} className="bar-row" onClick={() => onCountry(r.code)}
                 onMouseMove={(e) => { const el = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ text: [r.c.name, `${metric.label}: ${r.v === null ? "no data" : metric.fmt(r.v)}${additive && r.v ? ` · ${((r.v / total) * 100).toFixed(1)}% of G20 total` : ""}`, "Click for details"], x: e.clientX - el.left, y: e.clientY - el.top }); }}
                 onMouseLeave={() => setTip(null)}>
                <rect x={0} y={y} width={W} height={RH} fill="transparent" />
                <text x={LW - 10} y={y + RH / 2 + 4} textAnchor="end" className="bar-label">{r.c.name}</text>
                <text y={y + RH / 2 + 4} className="bar-value" x={LW + 8 + bw + 6}>{r.v === null ? "—" : metric.fmt(r.v)}</text>
                <rect x={LW + 8} y={y + 7} width={bw} height={RH - 14} rx={3} className="bar-fill" />
              </g>
            );
          })}
        </svg>
        {additive && <p className="chart-foot">Shares of the G20 total appear on hover — e.g. how the G20&rsquo;s AI-safety research distributes across countries.</p>}
      </div>}

      {cfg && <div className="chart-block">
        <h3>{cfg.title}</h3>
        <p className="chart-sub">{cfg.sub}</p>
        <svg viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={cfg.title}>
          {yTicks.map(v => <g key={`y${v}`}>
            <line x1={SP.l} x2={SW - SP.r} y1={sy(v)} y2={sy(v)} className="gridline" />
            <text x={SP.l - 7} y={sy(v) + 3.5} textAnchor="end" className="tick-label">{tickText(cfg.yFmt, v)}</text>
          </g>)}
          {xTicks.map(v => <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={SH - SP.b} y2={SH - SP.b + 5} className="axisline" />
            <text x={sx(v)} y={SH - SP.b + 17} textAnchor="middle" className="tick-label">{tickText(cfg.xFmt, v)}</text>
          </g>)}
          <line x1={SP.l} x2={SW - SP.r} y1={SH - SP.b} y2={SH - SP.b} className="axisline" />
          <line x1={SP.l} x2={SP.l} y1={SP.t} y2={SH - SP.b} className="axisline" />
          {(() => {
            const med = (a: number[]) => { const v = [...a].sort((p, q) => p - q); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
            const mxv = med(sc.map(d => d.x)), myv = med(sc.map(d => d.y));
            const X = sx(mxv), Y = sy(myv);
            return (
              <g className="quads">
                <rect x={X} y={Y} width={SW - SP.r - X} height={SH - SP.b - Y} className="quad-fill" />
                <line x1={X} x2={X} y1={SP.t} y2={SH - SP.b} className="quad-line" />
                <line x1={SP.l} x2={SW - SP.r} y1={Y} y2={Y} className="quad-line" />
                <text x={SP.l + 10} y={SP.t + 16} className="quad-label">{cfg.quads.tl}</text>
                <text x={SW - SP.r - 10} y={SP.t + 16} textAnchor="end" className="quad-label">{cfg.quads.tr}</text>
                <text x={SP.l + 10} y={SH - SP.b - 10} className="quad-label">{cfg.quads.bl}</text>
                <text x={SW - SP.r - 10} y={SH - SP.b - 10} textAnchor="end" className="quad-label hot">{cfg.quads.br}</text>
              </g>
            );
          })()}
          <text x={SW / 2} y={SH - 6} textAnchor="middle" className="axis-label">{cfg.xLabel}</text>
          <text x={14} y={SH / 2} textAnchor="middle" transform={`rotate(-90 14 ${SH / 2})`} className="axis-label">{cfg.yLabel}</text>
          {sc.map(d => (
            <g key={d.code} className="dot-g" onClick={() => onCountry(d.code)}
               onMouseMove={(e) => { const el = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ text: [dataset.countries[d.code].name, `${cfg.xLabel.replace(" \u2192", "")}: ${cfg.xFmt(d.x)}`, `${cfg.yLabel.replace(" \u2192", "")}: ${cfg.yFmt(d.y)}`, "Click for details"], x: e.clientX - el.left, y: e.clientY - el.top }); }}
               onMouseLeave={() => setTip(null)}>
              <circle cx={sx(d.x)} cy={sy(d.y)} r={7} fill={d.tier ? TIER_FILL[d.tier] : "#9b968e"} stroke="#fff" strokeWidth={1.5} />
              <text x={sx(d.x) + 10} y={sy(d.y) + 4} className="dot-label">{d.code}</text>
            </g>
          ))}
        </svg>
        <div className="map-legend"><span className="legend-note">{cfg.tierLabel.charAt(0).toUpperCase() + cfg.tierLabel.slice(1)}:</span>{TIERS.map(t => <span key={t}><i style={{ background: TIER_FILL[t] }} />{t}</span>)}</div>
      </div>}
      {tip && (
        <div className="map-tip chart-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.text.map((l, i) => i === 0 ? <strong key={i}>{l}</strong> : i === tip.text.length - 1 ? <small key={i}>{l}</small> : <span key={i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

const countriesGeo = feature(world as any, (world as any).objects.countries) as any;

export function MapView({ dataset, onCountry }: { dataset: SnapshotV2; onCountry: (iso: string) => void }) {
  const [track, setTrack] = useState<Track>("frontier");
  const [dim, setDim] = useState<DimensionId>("talent");
  const [colorBy, setColorBy] = useState<string>("grade");
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ iso: string; x: number; y: number } | null>(null);

  const width = 960, height = 480;
  const path = useMemo(() => geoPath(geoNaturalEarth1().fitSize([width, height], countriesGeo)), []);

  const metric = METRICS.find(m => m.key === colorBy);
  const tierOf = (iso: string): Tier | null => dataset.countries[iso]?.[dim][track].tier ?? null;
  const maxV = metric ? Math.max(...Object.keys(dataset.countries).map(c => metric.get(dataset.countries[c]) ?? 0)) : 0;

  // Sequential single-hue ramp (slate), sqrt-eased for skewed counts
  const seqFill = (v: number | null) => {
    if (v === null || maxV === 0) return "#b8b3ab";
    const t = Math.sqrt(v / maxV);
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    return `rgb(${mix(226, 26)},${mix(235, 78)},${mix(237, 90)})`;
  };
  const fillOf = (iso: string) => {
    if (metric) return seqFill(metric.get(dataset.countries[iso]));
    const t = tierOf(iso);
    return t ? TIER_FILL[t] : "#b8b3ab";
  };

  return (
    <section className="map-page">
      <div className="section-title"><div><span className="eyebrow">Map · {snapMonth(dataset.snapshot)}</span><h2>The G20, at a glance.</h2></div><p>Color the map by a grade or by a number. Hover for detail; click a country to see its numbers and the evidence behind them. Gray countries aren't covered yet — the explorer is G20-only for now.</p></div>
      <div className="cmp-controls">
        {!metric && <div className="range-toggle" role="tablist" aria-label="Ingredient">
          {DIMS.map(d => <button key={d.id} className={dim === d.id ? "active" : ""} onClick={() => setDim(d.id)}>{d.name}</button>)}
        </div>}
        {!metric && <div className="range-toggle" role="tablist" aria-label="Lens">
          <button className={track === "frontier" ? "active" : ""} onClick={() => setTrack("frontier")}>AI safety</button>
          <button className={track === "mainstream" ? "active" : ""} onClick={() => setTrack("mainstream")}>AI governance overall</button>
        </div>}
        <label className="cmp-sort">Color by{" "}
          <select value={colorBy} onChange={e => setColorBy(e.target.value)}>
            <option value="grade">Grade (sphere & lens above)</option>
            {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <div className="map-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={metric ? `World map: ${metric.label}` : `World map: ${dim} grade, ${TRACK_LABEL[track]} lens`}>
          {countriesGeo.features.map((f: any) => {
            const iso = NUM_ISO[f.id];
            const fill = iso ? fillOf(iso) : "#eceae5";
            return (
              <path key={f.id} d={path(f) ?? undefined} fill={fill}
                stroke={iso && iso === selected ? "#191919" : "#ffffff"} strokeWidth={iso && iso === selected ? 1.6 : 0.6}
                className={iso ? "map-g20" : "map-rest"}
                onMouseMove={iso ? (e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ iso, x: e.clientX - r.left, y: e.clientY - r.top }); } : undefined}
                onClick={iso ? () => setSelected(iso === selected ? null : iso) : undefined}
              />
            );
          })}
        </svg>
        {hover && (() => {
          const c = dataset.countries[hover.iso];
          const v = metric ? metric.get(c) : null;
          return (
            <div className="map-tip" style={{ left: hover.x, top: hover.y }}>
              <strong>{c.name}</strong>
              {metric
                ? <span>{metric.label}: {v === null ? "no data" : metric.fmt(v)}</span>
                : <span>{DIMS.find(d => d.id === dim)!.name} · {TRACK_LABEL[track]}: {tierOf(hover.iso) ?? "Collecting"}</span>}
              <small>Click to see the evidence</small>
            </div>
          );
        })()}
      </div>
      {metric ? (
        <div className="map-legend seq-legend">
          <span>0</span>
          <i className="seq-bar" />
          <span>{metric.fmt(maxV)}</span>
          <span className="seq-note">{metric.label} (√ scale)</span>
        </div>
      ) : (
        <div className="map-legend">
          {TIERS.map(t => <span key={t}><i style={{ background: TIER_FILL[t] }} />{t}</span>)}
          <span><i className="legend-pending" />Collecting</span>
          <span><i className="legend-out" />Outside G20 scope</span>
        </div>
      )}

      {selected && (
        <aside className="map-detail">
          <CountryDetail dataset={dataset} iso={selected} onCountry={onCountry} onClose={() => setSelected(null)} />
        </aside>
      )}
    </section>
  );
}
