import { useEffect, useMemo, useState } from "react";
import rowsJson from "../../data/candidates.index.json";
import { foldText } from "../../pipeline/lib/names.ts";
import type { IndexRow, Label } from "../../pipeline/lib/types.ts";

const ELECTION_YEAR = 2026;
const AGE_BANDS = ["<30", "30-39", "40-49", "50-59", "60+"];
const rows = (rowsJson as IndexRow[]).filter((r) => r.status === "active");

type Props = {
  locale: "lv" | "en";
  base: string;
  lists: { no: number; slug: string; name: string }[];
  constituencies: { slug: string; name: string }[];
  tiers: Record<string, Label>;
  tierOrder: string[];
  tags: Record<string, Label>;
  labels: Record<string, string>;
};

type State = { q: string; list: string; con: string; tier: string; tag: string; age: string; sort: string };
const DEFAULT: State = { q: "", list: "", con: "", tier: "", tag: "", age: "", sort: "list" };

function readHash(): State {
  const p = new URLSearchParams(window.location.hash.slice(1));
  const s: State = { ...DEFAULT };
  for (const k of Object.keys(DEFAULT) as (keyof State)[]) {
    const v = p.get(k);
    if (v) s[k] = v;
  }
  return s;
}

function writeHash(s: State): void {
  const p = new URLSearchParams();
  for (const k of Object.keys(DEFAULT) as (keyof State)[]) if (s[k] && s[k] !== DEFAULT[k]) p.set(k, s[k]);
  const h = p.toString();
  window.history.replaceState(null, "", h ? `#${h}` : window.location.pathname + window.location.search);
}

export default function Explorer(props: Props) {
  const { labels: L, locale } = props;
  const [s, setS] = useState<State>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    setS(readHash());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeHash(s);
  }, [s, ready]);

  const listName = useMemo(() => new Map(props.lists.map((l) => [l.no, l.name])), [props.lists]);
  const conName = useMemo(() => new Map(props.constituencies.map((c) => [c.slug, c.name])), [props.constituencies]);
  const conOrder = useMemo(() => new Map(props.constituencies.map((c, i) => [c.slug, i])), [props.constituencies]);
  const haystack = useMemo(() => rows.map((r) => foldText(`${r.name} ${r.headline_role ?? ""}`)), []);

  const filtered = useMemo(() => {
    const q = foldText(s.q.trim());
    const out: IndexRow[] = [];
    rows.forEach((r, i) => {
      if (s.list && String(r.list_no) !== s.list) return;
      if (s.con && r.constituency !== s.con) return;
      if (s.tier && r.tier !== s.tier) return;
      if (s.tag && !r.tags.includes(s.tag)) return;
      if (s.age && r.age_band !== s.age) return;
      if (q && !haystack[i].includes(q)) return;
      out.push(r);
    });
    const by: Record<string, (a: IndexRow, b: IndexRow) => number> = {
      list: (a, b) => a.list_no - b.list_no || (conOrder.get(a.constituency) ?? 9) - (conOrder.get(b.constituency) ?? 9) || a.position - b.position,
      name: (a, b) => a.name.localeCompare(b.name, "lv"),
      age_asc: (a, b) => (b.birth_year ?? -1) - (a.birth_year ?? -1),
      age_desc: (a, b) => (a.birth_year ?? 9999) - (b.birth_year ?? 9999),
    };
    return out.sort(by[s.sort] ?? by.list);
  }, [s, haystack, conOrder]);

  const set = (patch: Partial<State>) => {
    setS((prev) => ({ ...prev, ...patch }));
    setLimit(100);
  };
  const tierLabel = (t: string) => props.tiers[t]?.[locale] ?? t;
  const shown = filtered.slice(0, limit);

  return (
    <div>
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <label className="search">
          {L["explorer.search"]}
          <input type="search" value={s.q} onChange={(e) => set({ q: e.target.value })} placeholder={L["explorer.search"]} />
        </label>
        <label>
          {L["candidate.list"]}
          <select value={s.list} onChange={(e) => set({ list: e.target.value })}>
            <option value="">{L["explorer.all"]}</option>
            {props.lists.map((l) => (
              <option key={l.no} value={String(l.no)}>{l.no}. {l.name}</option>
            ))}
          </select>
        </label>
        <label>
          {L["candidate.constituency"]}
          <select value={s.con} onChange={(e) => set({ con: e.target.value })}>
            <option value="">{L["explorer.all"]}</option>
            {props.constituencies.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          {L["candidate.tier"]}
          <select value={s.tier} onChange={(e) => set({ tier: e.target.value })}>
            <option value="">{L["explorer.all"]}</option>
            {props.tierOrder.map((t) => (
              <option key={t} value={t}>{tierLabel(t)}</option>
            ))}
          </select>
        </label>
        <label>
          {L["candidate.tags"]}
          <select value={s.tag} onChange={(e) => set({ tag: e.target.value })}>
            <option value="">{L["explorer.all"]}</option>
            {Object.entries(props.tags)
              .sort((a, b) => a[1][locale].localeCompare(b[1][locale], "lv"))
              .map(([k, v]) => (
                <option key={k} value={k}>{v[locale]}</option>
              ))}
          </select>
        </label>
        <label>
          {L["candidate.age"]}
          <select value={s.age} onChange={(e) => set({ age: e.target.value })}>
            <option value="">{L["explorer.all"]}</option>
            {AGE_BANDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          {L["explorer.sort"]}
          <select value={s.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="list">{L["explorer.sort.list"]}</option>
            <option value="name">{L["explorer.sort.name"]}</option>
            <option value="age_asc">{L["explorer.sort.age_asc"]}</option>
            <option value="age_desc">{L["explorer.sort.age_desc"]}</option>
          </select>
        </label>
      </form>
      <div className="results-bar">
        <span>
          <strong>{filtered.length.toLocaleString(locale === "lv" ? "lv-LV" : "en-GB")}</strong> {L["explorer.results"]}
        </span>
        <button type="button" className="btn" onClick={() => set({ ...DEFAULT })}>{L["explorer.reset"]}</button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>{L["nav.candidates"]}</th>
              <th>{L["candidate.list"]}</th>
              <th>{L["candidate.constituency"]}</th>
              <th>{L["candidate.position"]}</th>
              <th>{L["candidate.age"]}</th>
              <th>{L["candidate.tier"]}</th>
              <th>{L["explorer.role"]}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="name"><a href={`${props.base}/kandidati/${r.id}-${r.slug}/`}>{r.name}</a></td>
                <td>{r.list_no}. {listName.get(r.list_no) ?? ""}</td>
                <td>{conName.get(r.constituency) ?? r.constituency}</td>
                <td className="num">{r.position}.</td>
                <td className="num">{r.birth_year ? ELECTION_YEAR - r.birth_year : "-"}</td>
                <td><span className={`badge tier-${r.tier}`}>{tierLabel(r.tier)}</span></td>
                <td className="role">{r.headline_role ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length < filtered.length && (
        <p style={{ textAlign: "center", marginTop: "1rem" }}>
          <button type="button" className="btn" onClick={() => setLimit((n) => n + 200)}>
            {L["explorer.more"]} ({filtered.length - shown.length})
          </button>
        </p>
      )}
    </div>
  );
}
