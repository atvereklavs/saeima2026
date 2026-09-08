import { useEffect, useState } from "react";
import type { Label } from "../../pipeline/lib/types.ts";

type Item = {
  no: number;
  slug: string;
  name: string;
  href: string;
  candidates_count: number;
  experience_share: number;
  public_office_share: number;
  tier_counts: Record<string, number>;
  avg_age: number | null;
  median_age: number | null;
  women_pct: number | null;
  higher_ed_pct: number | null;
  minister_count: number;
  sitting_mp_count: number;
  former_mp_count: number;
  person_terms: number;
  committees_distinct: number;
  riga_share: number;
  debates_count: number;
  founded_year: number | null;
};

type Props = {
  locale: "lv" | "en";
  lists: Item[];
  tiers: Record<string, Label>;
  tierOrder: string[];
  labels: Record<string, string>;
};

const MAX = 4;

function Meter({ value, label, locale, alt }: { value: number | null; label: string; locale: string; alt?: boolean }) {
  const v = value ?? 0;
  return (
    <div className="meter">
      <span>{label}</span>
      <strong>{value === null ? "-" : `${v.toLocaleString(locale === "lv" ? "lv-LV" : "en-GB", { maximumFractionDigits: 1 })}%`}</strong>
      <div className="track"><div className={alt ? "fill alt" : "fill"} style={{ width: `${Math.min(100, v)}%` }} /></div>
    </div>
  );
}

/** Columns of the all-14 table: key, label lookup, numeric accessor, percent flag. */
const COLUMNS: { key: string; label: string; get: (l: Item) => number | null; pct?: boolean }[] = [
  { key: "candidates", label: "list.candidates", get: (l) => l.candidates_count },
  { key: "founded", label: "list.founded", get: (l) => l.founded_year },
  { key: "avg_age", label: "list.avg_age", get: (l) => l.avg_age },
  { key: "median_age", label: "list.median_age", get: (l) => l.median_age },
  { key: "women", label: "compare.women", get: (l) => l.women_pct, pct: true },
  { key: "higher_ed", label: "compare.higher_ed", get: (l) => l.higher_ed_pct, pct: true },
  { key: "ministers", label: "min.", get: (l) => l.minister_count },
  { key: "sitting", label: "MP", get: (l) => l.sitting_mp_count },
  { key: "former", label: "ex-MP", get: (l) => l.former_mp_count },
  { key: "terms", label: "list.person_terms", get: (l) => l.person_terms },
  { key: "committees", label: "list.committees_distinct", get: (l) => l.committees_distinct },
  { key: "riga", label: "list.riga_share", get: (l) => l.riga_share, pct: true },
  { key: "experience", label: "list.experience_share", get: (l) => l.experience_share, pct: true },
  { key: "office", label: "list.public_office_share", get: (l) => l.public_office_share, pct: true },
  { key: "debates", label: "list.debates_count", get: (l) => l.debates_count },
];

export default function Compare(props: Props) {
  const { labels: L, locale } = props;
  const defaults = props.lists.slice(0, 3).map((l) => l.slug);
  const [selected, setSelected] = useState<string[]>(defaults);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "no", dir: 1 });

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const fromHash = (p.get("lists") ?? "").split(",").filter((s) => props.lists.some((l) => l.slug === s));
    if (fromHash.length >= 1) setSelected(fromHash.slice(0, MAX));
    if (p.get("view") === "table") setView("table");
  }, []);
  useEffect(() => {
    const parts: string[] = [];
    if (selected.length) parts.push(`lists=${selected.join(",")}`);
    if (view === "table") parts.push("view=table");
    window.history.replaceState(null, "", parts.length ? `#${parts.join("&")}` : window.location.pathname);
  }, [selected, view]);

  const toggle = (slug: string) => {
    setSelected((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length >= MAX ? cur : [...cur, slug]));
  };
  const chosen = selected.map((s) => props.lists.find((l) => l.slug === s)!).filter(Boolean);
  const fmt = (n: number | null, digits = 1) =>
    n === null ? "-" : n.toLocaleString(locale === "lv" ? "lv-LV" : "en-GB", { maximumFractionDigits: digits });
  const tierLabel = (t: string) => props.tiers[t]?.[locale] ?? t;
  const colLabel = (c: (typeof COLUMNS)[number]) => L[c.label] ?? c.label;

  const sorted = [...props.lists].sort((a, b) => {
    if (sort.key === "no") return (a.no - b.no) * sort.dir;
    const col = COLUMNS.find((c) => c.key === sort.key)!;
    const va = col.get(a);
    const vb = col.get(b);
    if (va === null && vb === null) return a.no - b.no;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (vb - va) * sort.dir || a.no - b.no;
  });
  const clickSort = (key: string) => {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  };

  return (
    <div>
      <div className="results-bar">
        <span className="picker" style={{ margin: 0 }}>
          <label className={view === "cards" ? "on" : undefined}>
            <input type="radio" name="view" checked={view === "cards"} onChange={() => setView("cards")} />
            {L["compare.view_cards"]}
          </label>
          <label className={view === "table" ? "on" : undefined}>
            <input type="radio" name="view" checked={view === "table"} onChange={() => setView("table")} />
            {L["compare.view_table"]}
          </label>
        </span>
        {view === "table" && <span>{L["compare.sort_hint"]}</span>}
      </div>

      {view === "table" ? (
        <div className="table-wrap">
          <table className="data compact">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => clickSort("no")}>Nr.{sort.key === "no" ? (sort.dir === 1 ? " ↓" : " ↑") : ""}</th>
                <th>{locale === "lv" ? "Saraksts" : "List"}</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} style={{ cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => clickSort(c.key)}>
                    {colLabel(c)}{sort.key === c.key ? (sort.dir === 1 ? " ↓" : " ↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.slug}>
                  <td className="num">{l.no}.</td>
                  <td className="name"><a href={l.href}>{l.name}</a></td>
                  {COLUMNS.map((c) => {
                    const v = c.get(l);
                    return <td key={c.key} className="num">{c.key === "founded" ? (v ?? "-") : fmt(v)}{c.pct && v !== null ? "%" : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="muted">{L["compare.pick"]}</p>
          <div className="picker">
            {props.lists.map((l) => {
              const on = selected.includes(l.slug);
              return (
                <label key={l.slug} className={on ? "on" : undefined}>
                  <input type="checkbox" checked={on} disabled={!on && selected.length >= MAX} onChange={() => toggle(l.slug)} />
                  {l.no}. {l.name}
                </label>
              );
            })}
          </div>
          <div className="compare-grid">
            {chosen.map((l) => {
              const total = Object.values(l.tier_counts).reduce((a, b) => a + b, 0) || 1;
              return (
                <article key={l.slug} className="card">
                  <h3><span className="list-no">{l.no}</span><a href={l.href}>{l.name}</a></h3>
                  <dl className="kv">
                    <dt>{L["list.candidates"]}</dt><dd>{l.candidates_count}</dd>
                    {l.founded_year !== null && <><dt>{L["list.founded"]}</dt><dd>{l.founded_year}</dd></>}
                    <dt>{L["list.avg_age"]}</dt><dd>{fmt(l.avg_age)} / {fmt(l.median_age)}</dd>
                    <dt>{L["list.mp_counts"]}</dt><dd>{l.minister_count} / {l.sitting_mp_count} / {l.former_mp_count}</dd>
                    <dt>{L["list.person_terms"]}</dt><dd>{l.person_terms}</dd>
                    <dt>{L["list.committees_distinct"]}</dt><dd>{l.committees_distinct}</dd>
                    {l.debates_count > 0 && <><dt>{L["list.debates_count"]}</dt><dd>{l.debates_count}</dd></>}
                  </dl>
                  <Meter value={l.experience_share} label={L["list.experience_share"]} locale={locale} />
                  <Meter value={l.public_office_share} label={L["list.public_office_share"]} locale={locale} alt />
                  <Meter value={l.women_pct} label={L["compare.women"]} locale={locale} alt />
                  <Meter value={l.higher_ed_pct} label={L["compare.higher_ed"]} locale={locale} alt />
                  <Meter value={l.riga_share} label={L["list.riga_share"]} locale={locale} alt />
                  <div>
                    <small className="muted">{L["compare.tiers"]}</small>
                    <div className="stack">
                      {props.tierOrder.map((t) => {
                        const n = l.tier_counts[t] ?? 0;
                        return n > 0 ? <span key={t} style={{ width: `${(n / total) * 100}%`, background: `var(--tier-${t})` }} title={`${tierLabel(t)}: ${n}`} /> : null;
                      })}
                    </div>
                    <div className="legend">
                      {props.tierOrder.map((t) => (
                        <span key={t}><i style={{ background: `var(--tier-${t})` }} />{tierLabel(t)} · {l.tier_counts[t] ?? 0}</span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
