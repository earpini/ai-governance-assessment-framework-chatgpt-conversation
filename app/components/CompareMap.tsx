"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import type { DimensionId, SnapshotV2, Tier, Track } from "../types/snapshot";

const TIER_FILL: Record<string, string> = { Established: "#2F6E7B", Emerging: "#E2A33C", Nascent: "#C0512E" };
const TIERS: Tier[] = ["Nascent", "Emerging", "Established"];
const DIMS: { id: DimensionId; name: string }[] = [
  { id: "talent", name: "Talent" }, { id: "attention", name: "Attention" }, { id: "policy", name: "Policy" },
];

// world-atlas uses ISO 3166 numeric ids
const ISO_NUM: Record<string, string> = {
  AR: "032", AU: "036", BR: "076", CA: "124", CN: "156", FR: "250", DE: "276", IN: "356", ID: "360",
  IT: "380", JP: "392", MX: "484", RU: "643", SA: "682", ZA: "710", KR: "410", TR: "792", GB: "826", US: "840",
};
const NUM_ISO = Object.fromEntries(Object.entries(ISO_NUM).map(([k, v]) => [v, k]));

type Metric = { key: string; label: string; fmt: (v: number) => string; get: (c: any) => number | null };
const METRICS: Metric[] = [
  { key: "t1", label: "T1 · AI share of research output", fmt: v => `${(v * 100).toFixed(2)}%`, get: c => c.talent.mainstream.t1_ai_share },
  { key: "t2", label: "T2 · Frontier-safety works", fmt: v => v.toLocaleString(), get: c => c.talent.frontier.t2_works },
  { key: "t3", label: "T3 · Field-building entities", fmt: v => String(v), get: c => c.talent.frontier.t3_orgs + c.talent.frontier.t3_university_groups },
  { key: "p1", label: "P1 · Policy initiatives (OECD.AI)", fmt: v => String(v), get: c => c.policy.mainstream.p1_oecd_initiative_count },
  { key: "p2", label: "P2 · Frontier commitments (0–5)", fmt: v => `${v}/5`, get: c => c.policy.frontier.p2_score },
];

function TierCell({ tier }: { tier: Tier | null }) {
  if (!tier) return <td className="cmp-cell tier-cell-pending"><span className="mini-tier tier-dot-pending" />collecting</td>;
  return <td className={`cmp-cell tier-cell-${tier.toLowerCase()}`}><span className={`mini-tier tier-dot-${tier.toLowerCase()}`} />{tier}</td>;
}

export function CompareView({ dataset, onCountry }: { dataset: SnapshotV2; onCountry: (iso: string) => void }) {
  const [track, setTrack] = useState<Track>("frontier");
  const [sortBy, setSortBy] = useState<string>("name");
  const codes = Object.keys(dataset.countries);

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
      <div className="section-title"><div><span className="eyebrow">Compare · {dataset.snapshot}</span><h2>All countries, side by side.</h2></div><p>Tiers per dimension on one track, plus sortable indicator rankings. Click a country to open its profile.</p></div>
      <div className="cmp-controls">
        <div className="range-toggle" role="tablist" aria-label="Track">
          <button className={track === "frontier" ? "active" : ""} onClick={() => setTrack("frontier")}>Frontier track</button>
          <button className={track === "mainstream" ? "active" : ""} onClick={() => setTrack("mainstream")}>Mainstream track</button>
        </div>
        <label className="cmp-sort">Sort by{" "}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Country name</option>
            <option value="readiness">Overall readiness (tier sum)</option>
            {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
      </div>
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
      <p className="cmp-note">Tier colors: <span className="mini-tier tier-dot-nascent" /> Nascent · <span className="mini-tier tier-dot-emerging" /> Emerging · <span className="mini-tier tier-dot-established" /> Established · <span className="mini-tier tier-dot-pending" /> collecting. Attention tiers await complete media/search data and are shown as collecting — never fabricated.</p>
    </section>
  );
}

const countriesGeo = feature(world as any, (world as any).objects.countries) as any;

export function MapView({ dataset, onCountry }: { dataset: SnapshotV2; onCountry: (iso: string) => void }) {
  const [track, setTrack] = useState<Track>("frontier");
  const [dim, setDim] = useState<DimensionId>("talent");
  const [hover, setHover] = useState<{ iso: string; x: number; y: number } | null>(null);

  const width = 960, height = 480;
  const path = useMemo(() => geoPath(geoNaturalEarth1().fitSize([width, height], countriesGeo)), []);

  const tierOf = (iso: string): Tier | null => dataset.countries[iso]?.[dim][track].tier ?? null;

  return (
    <section className="map-page">
      <div className="section-title"><div><span className="eyebrow">Map · {dataset.snapshot}</span><h2>The G20, colored by tier.</h2></div><p>Pick a dimension and track; hover for detail, click a country to open its profile. Uncolored countries are outside the current G20 scope.</p></div>
      <div className="cmp-controls">
        <div className="range-toggle" role="tablist" aria-label="Dimension">
          {DIMS.map(d => <button key={d.id} className={dim === d.id ? "active" : ""} onClick={() => setDim(d.id)}>{d.name}</button>)}
        </div>
        <div className="range-toggle" role="tablist" aria-label="Track">
          <button className={track === "frontier" ? "active" : ""} onClick={() => setTrack("frontier")}>Frontier</button>
          <button className={track === "mainstream" ? "active" : ""} onClick={() => setTrack("mainstream")}>Mainstream</button>
        </div>
      </div>
      <div className="map-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`World map: ${dim} tier, ${track} track`}>
          {countriesGeo.features.map((f: any) => {
            const iso = NUM_ISO[f.id];
            const tier = iso ? tierOf(iso) : undefined;
            const fill = iso ? (tier ? TIER_FILL[tier] : "#b8b3ab") : "#eceae5";
            return (
              <path key={f.id} d={path(f) ?? undefined} fill={fill}
                stroke="#ffffff" strokeWidth={0.6}
                className={iso ? "map-g20" : "map-rest"}
                onMouseMove={iso ? (e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ iso, x: e.clientX - r.left, y: e.clientY - r.top }); } : undefined}
                onClick={iso ? () => onCountry(iso) : undefined}
              />
            );
          })}
        </svg>
        {hover && (() => {
          const c = dataset.countries[hover.iso];
          const t = tierOf(hover.iso);
          return (
            <div className="map-tip" style={{ left: hover.x, top: hover.y }}>
              <strong>{c.name}</strong>
              <span>{DIMS.find(d => d.id === dim)!.name} · {track}: {t ?? "collecting"}</span>
              <small>Click for full profile</small>
            </div>
          );
        })()}
      </div>
      <div className="map-legend">
        {TIERS.map(t => <span key={t}><i style={{ background: TIER_FILL[t] }} />{t}</span>)}
        <span><i className="legend-pending" />Collecting</span>
        <span><i className="legend-out" />Outside G20 scope</span>
      </div>
    </section>
  );
}
