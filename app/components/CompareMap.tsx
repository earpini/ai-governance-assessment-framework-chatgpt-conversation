"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import type { DimensionId, SnapshotV2, Tier, Track } from "../types/snapshot";
import fieldBuilding from "../../data/curated/field_building.json";
import policyActivity from "../../data/curated/policy_activity.json";
const FBM = fieldBuilding as any, PAM = policyActivity as any;

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
  { key: "p2", label: "AI-safety commitments (0–5)", fmt: v => `${v}/5`, get: c => c.policy.frontier.p2_score },
];

function TierCell({ tier }: { tier: Tier | null }) {
  if (!tier) return <td className="cmp-cell tier-cell-pending"><span className="mini-tier tier-dot-pending" />collecting</td>;
  return <td className={`cmp-cell tier-cell-${tier.toLowerCase()}`}><span className={`mini-tier tier-dot-${tier.toLowerCase()}`} />{tier}</td>;
}

export function CompareView({ dataset, onCountry }: { dataset: SnapshotV2; onCountry: (iso: string) => void }) {
  const [track, setTrack] = useState<Track>("frontier");
  const [sortBy, setSortBy] = useState<string>("name");
  const [mode, setMode] = useState<"table" | "charts">("table");
  const [chartView, setChartView] = useState<"ranking" | "research" | "talent" | "policy">("ranking");
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

  const metric = METRICS.find(m => m.key === sortBy);
  const rows = useMemo(() => {
    const r = codes.map(code => ({ code, c: dataset.countries[code] }));
    if (metric) r.sort((a, b) => (metric.get(b.c) ?? -1) - (metric.get(a.c) ?? -1));
    else if (sortBy === "readiness") {
      const rank = (c: any) => DIMS.reduce((s, d) => s + (c[d.id][track].tier ? TIERS.indexOf(c[d.id][track].tier) + 1 : 0), 0);
      r.sort((a, b) => rank(b.c) - rank(a.c));
    } else r.sort((a, b) => a.c.name.localeCompare(b.c.name));
    return r;
  }, [dataset, sortBy, track]);

  const maxMetric = metric ? Math.max(...rows.map(r => metric.get(r.c) ?? 0)) : 0;

  return (
    <section className="compare-page">
      <div className="section-title"><div><span className="eyebrow">Compare · {dataset.snapshot}</span><h2>All countries, side by side.</h2></div><p>Grades for each sphere on one lens, and rankings of the numbers behind them. Click any country to open its full profile.</p></div>
      <div className="stat-tiles">
        {tiles.map((t, i) => <div className="stat-tile" key={i}><strong>{t.n}</strong><span>{t.l}</span><small>{t.s}</small></div>)}
      </div>
      <div className="cmp-controls">
        <div className="range-toggle" role="tablist" aria-label="View">
          <button className={mode === "table" ? "active" : ""} onClick={() => setMode("table")}>Table</button>
          <button className={mode === "charts" && chartView === "ranking" ? "active" : ""} onClick={() => { setMode("charts"); setChartView("ranking"); if (!METRICS.find(m => m.key === sortBy)) setSortBy("t2"); }}>Rankings</button>
          <button className={mode === "charts" && chartView === "research" ? "active" : ""} onClick={() => { setMode("charts"); setChartView("research"); }}>Research landscape</button>
          <button className={mode === "charts" && chartView === "talent" ? "active" : ""} onClick={() => { setMode("charts"); setChartView("talent"); }}>Field landscape</button>
          <button className={mode === "charts" && chartView === "policy" ? "active" : ""} onClick={() => { setMode("charts"); setChartView("policy"); }}>Government landscape</button>
        </div>
        {(mode === "table" || chartView === "ranking") && <>
          {mode === "table" && <div className="range-toggle" role="tablist" aria-label="Lens">
            <button className={track === "frontier" ? "active" : ""} onClick={() => setTrack("frontier")}>AI safety lens</button>
            <button className={track === "mainstream" ? "active" : ""} onClick={() => setTrack("mainstream")}>AI governance overall lens</button>
          </div>}
          <label className="cmp-sort">{mode === "charts" ? "Indicator" : "Sort by"}{" "}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="name">Country name</option>
              <option value="readiness">Overall readiness (tier sum)</option>
              {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        </>}
      </div>
      {mode === "charts" ? (
        <ChartPanel dataset={dataset} metric={metric ?? METRICS[1]} onCountry={onCountry} view={chartView} />
      ) : (
      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead><tr>
            <th>Country</th>
            {DIMS.map(d => <th key={d.id}>{d.name}</th>)}
            {metric && <th className="cmp-metric-head">{metric.label}</th>}
          </tr></thead>
          <tbody>
            {rows.map(({ code, c }) => {
              const v = metric ? metric.get(c) : null;
              return (
                <tr key={code}>
                  <td className="cmp-country"><button onClick={() => onCountry(code)}>{c.name} <i>→</i></button></td>
                  {DIMS.map(d => <TierCell key={d.id} tier={c[d.id][track].tier} />)}
                  {metric && (
                    <td className="cmp-metric">
                      <div className="cmp-metric-inner">
                        <span className="cmp-val">{v === null || v === undefined ? "—" : metric.fmt(v)}</span>
                        <span className="cmp-bar-track"><span className="cmp-bar" style={{ width: `${v && maxMetric ? Math.max((v / maxMetric) * 100, 1.5) : 0}%` }} /></span>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      <p className="cmp-note">Tier colors: <span className="mini-tier tier-dot-nascent" /> Nascent · <span className="mini-tier tier-dot-emerging" /> Emerging · <span className="mini-tier tier-dot-established" /> Established · <span className="mini-tier tier-dot-pending" /> collecting. Attention grades await complete media and search data and show as collecting — never guessed.</p>
    </section>
  );
}

type LandscapeCfg = {
  title: string; sub: string; xLabel: string; yLabel: string;
  x: (c: any) => number; y: (c: any) => number; sqrtY: boolean;
  xFmt: (v: number) => string; yFmt: (v: number) => string;
  tier: (c: any) => Tier | null; tierLabel: string;
};

const LANDSCAPES: Record<string, LandscapeCfg> = {
  research: {
    title: "The research landscape: AI governance overall vs AI safety",
    sub: "Each dot is a country. Right = AI is a big share of national research. Up = more AI-safety papers. Countries low and to the right are active on AI but missing a safety research field.",
    xLabel: "AI\u2019s share of the country\u2019s research output \u2192",
    yLabel: "AI-safety papers (\u221a scale) \u2192",
    x: c => c.talent.mainstream.t1_ai_share ?? 0, y: c => c.talent.frontier.t2_works ?? 0, sqrtY: true,
    xFmt: v => `${(v * 100).toFixed(2)}%`, yFmt: v => v.toLocaleString(),
    tier: c => c.talent.frontier.tier, tierLabel: "Field grade (AI-safety lens)",
  },
  talent: {
    title: "The field landscape: safety research vs organized community",
    sub: "Right = AI-safety papers exist. Up = safety organizations and student groups exist. Low-right: researchers without a field around them. High-left: organizers ahead of the research (like Argentina).",
    xLabel: "AI-safety papers since 2022 (\u221a scale) \u2192",
    yLabel: "Safety orgs & student groups \u2192",
    x: c => c.talent.frontier.t2_works ?? 0, y: c => c.talent.frontier.t3_orgs + c.talent.frontier.t3_university_groups, sqrtY: false,
    xFmt: v => v.toLocaleString(), yFmt: v => String(v),
    tier: c => c.talent.frontier.tier, tierLabel: "Field grade (AI-safety lens)",
  },
  policy: {
    title: "The government landscape: AI policy activity vs safety commitments",
    sub: "Right = lots of national AI policy activity. Up = concrete safety commitments (declarations, institutes, risk language, law). Low-right: governments busy with AI that have not yet engaged its serious risks.",
    xLabel: "National AI policy initiatives (OECD.AI) \u2192",
    yLabel: "Safety commitments (0\u20135) \u2192",
    x: c => c.policy.mainstream.p1_oecd_initiative_count ?? 0, y: c => c.policy.frontier.p2_score, sqrtY: false,
    xFmt: v => String(v), yFmt: v => `${v}/5`,
    tier: c => c.policy.frontier.tier, tierLabel: "Government grade (AI-safety lens)",
  },
};

function ChartPanel({ dataset, metric, onCountry, view }: { dataset: SnapshotV2; metric: Metric; onCountry: (iso: string) => void; view: "ranking" | "research" | "talent" | "policy" }) {
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
                 onMouseMove={(e) => { const el = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ text: [r.c.name, `${metric.label}: ${r.v === null ? "no data" : metric.fmt(r.v)}${additive && r.v ? ` · ${((r.v / total) * 100).toFixed(1)}% of G20 total` : ""}`, "Click for full profile"], x: e.clientX - el.left, y: e.clientY - el.top }); }}
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
          {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={SP.l} x2={SW - SP.r} y1={SH - SP.b - f * (SH - SP.t - SP.b)} y2={SH - SP.b - f * (SH - SP.t - SP.b)} className="gridline" />)}
          <line x1={SP.l} x2={SW - SP.r} y1={SH - SP.b} y2={SH - SP.b} className="axisline" />
          <line x1={SP.l} x2={SP.l} y1={SP.t} y2={SH - SP.b} className="axisline" />
          <text x={SW / 2} y={SH - 10} textAnchor="middle" className="axis-label">{cfg.xLabel}</text>
          <text x={14} y={SH / 2} textAnchor="middle" transform={`rotate(-90 14 ${SH / 2})`} className="axis-label">{cfg.yLabel}</text>
          {sc.map(d => (
            <g key={d.code} className="dot-g" onClick={() => onCountry(d.code)}
               onMouseMove={(e) => { const el = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ text: [dataset.countries[d.code].name, `${cfg.xLabel.replace(" \u2192", "")}: ${cfg.xFmt(d.x)}`, `${cfg.yLabel.replace(" \u2192", "")}: ${cfg.yFmt(d.y)}`, "Click for full profile"], x: e.clientX - el.left, y: e.clientY - el.top }); }}
               onMouseLeave={() => setTip(null)}>
              <circle cx={sx(d.x)} cy={sy(d.y)} r={7} fill={d.tier ? TIER_FILL[d.tier] : "#9b968e"} stroke="#fff" strokeWidth={1.5} />
              <text x={sx(d.x) + 10} y={sy(d.y) + 4} className="dot-label">{d.code}</text>
            </g>
          ))}
        </svg>
        <div className="map-legend">{TIERS.map(t => <span key={t}><i style={{ background: TIER_FILL[t] }} />{t} ({cfg.tierLabel})</span>)}</div>
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

  const sel = selected ? dataset.countries[selected] : null;
  const selFB = selected ? FBM.countries[selected] : null;
  const selPA = selected ? PAM.countries[selected] : null;

  return (
    <section className="map-page">
      <div className="section-title"><div><span className="eyebrow">Map · {dataset.snapshot}</span><h2>The G20, at a glance.</h2></div><p>Color the map by a grade or by a number. Hover for detail; click a country to see its numbers and the evidence behind them. Gray countries are outside the current G20 scope.</p></div>
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
            <option value="grade">Grade (pick sphere & lens)</option>
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
                : <span>{DIMS.find(d => d.id === dim)!.name} · {TRACK_LABEL[track]}: {tierOf(hover.iso) ?? "collecting"}</span>}
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

      {sel && selected && (
        <aside className="map-detail">
          <div className="map-detail-head">
            <h3>{sel.name}</h3>
            <button className="map-detail-open" onClick={() => onCountry(selected)}>Open full profile →</button>
            <button className="map-detail-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          </div>
          <div className="map-detail-grid">
            <div>
              <p className="absolute-label">The numbers</p>
              <ul className="map-nums">
                {METRICS.map(m => { const v = m.get(sel); return <li key={m.key}><span>{m.label}</span><strong>{v === null ? "—" : m.fmt(v)}</strong></li>; })}
                <li><span>Grades (AI safety lens)</span><strong className="map-grades">{DIMS.map(d => { const t = sel[d.id].frontier.tier; return <span key={d.id} title={d.name} className={`mini-tier tier-dot-${t?.toLowerCase() ?? "pending"}`} />; })}</strong></li>
              </ul>
            </div>
            <div>
              <p className="absolute-label">The evidence</p>
              <ul className="map-links">
                {(sel.talent.frontier.t2_sample ?? []).slice(0, 3).map((w, i) => <li key={i}>{w.link ? <a href={w.link} target="_blank" rel="noreferrer">{w.title} ↗</a> : <span>{w.title}</span>}<small>AI-safety paper{w.year ? ` · ${w.year}` : ""}</small></li>)}
                {(selFB?.entities ?? []).slice(0, 3).map((e: any, i: number) => <li key={`o${i}`}><a href={e.source} target="_blank" rel="noreferrer">{e.name} ↗</a><small>{e.type === "university_group" ? "University group" : "Organization"} · {e.city_or_university}</small></li>)}
                {selPA?.latest_initiative?.source && <li><a href={selPA.latest_initiative.source} target="_blank" rel="noreferrer">{selPA.latest_initiative.name} ↗</a><small>Latest policy move · {selPA.latest_initiative.year}</small></li>}
                <li><a href={`https://openalex.org/works?filter=${encodeURIComponent(`title_and_abstract.search:"AI safety" OR "AI alignment" OR "existential risk from artificial intelligence" OR "frontier model safety" OR "catastrophic AI risk",from_publication_date:2022-01-01,authorships.countries:${selected}`)}`} target="_blank" rel="noreferrer">Browse {sel.talent.frontier.t2_works === 1 ? "the 1 AI-safety paper" : `all ${sel.talent.frontier.t2_works ?? ""} AI-safety papers`} from this country on OpenAlex ↗</a><small>Live, filterable list</small></li>
              </ul>
            </div>
          </div>
        </aside>
      )}
    </section>
  );
}
