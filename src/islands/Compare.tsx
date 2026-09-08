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

export default function Compare(props: Props) {
  const { labels: L, locale } = props;
  const defaults = props.lists.slice(0, 3).map((l) => l.slug);
  const [selected, setSelected] = useState<string[]>(defaults);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const fromHash = (p.get("lists") ?? "").split(",").filter((s) => props.lists.some((l) => l.slug === s));
    if (fromHash.length >= 1) setSelected(fromHash.slice(0, MAX));
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", selected.length ? `#lists=${selected.join(",")}` : window.location.pathname);
  }, [selected]);

  const toggle = (slug: string) => {
    setSelected((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length >= MAX ? cur : [...cur, slug]));
  };
  const chosen = selected.map((s) => props.lists.find((l) => l.slug === s)!).filter(Boolean);
  const fmt = (n: number | null) => (n === null ? "-" : n.toLocaleString(locale === "lv" ? "lv-LV" : "en-GB", { maximumFractionDigits: 1 }));
  const tierLabel = (t: string) => props.tiers[t]?.[locale] ?? t;

  return (
    <div>
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
              <div className="facts">
                <div className="fact"><strong>{l.candidates_count}</strong><small>{L["list.candidates"]}</small></div>
                <div className="fact"><strong>{fmt(l.avg_age)}</strong><small>{L["list.avg_age"]}</small></div>
              </div>
              <Meter value={l.experience_share} label={L["list.experience_share"]} locale={locale} />
              <Meter value={l.public_office_share} label={L["list.public_office_share"]} locale={locale} alt />
              <Meter value={l.women_pct} label={L["compare.women"]} locale={locale} alt />
              <Meter value={l.higher_ed_pct} label={L["compare.higher_ed"]} locale={locale} alt />
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
    </div>
  );
}
