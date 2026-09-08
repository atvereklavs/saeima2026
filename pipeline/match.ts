// Stage 4: join Delna, titania.saeima.lv and Wikidata records to CVK candidates.
//
// Reads only the cache. Writes .cache/raw/match.json (consumed by
// build-dataset.ts), .cache/raw/saeima-matched-unids.json (consumed by
// fetch-saeima.ts --deputy-pages) and data/reports/matching.json (committed,
// for the operator to review ambiguities and add overrides).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_ROOT, atomicWrite, readCached } from "./lib/http.ts";
import { csvObjects } from "./lib/csv.ts";
import { parseAllCandidatesTable } from "./lib/cvk-parsers.ts";
import { cvkTableUrl } from "./lib/cvk-urls.ts";
import { flipSurnameFirst, nameKey, tokenKey } from "./lib/names.ts";
import { parseDeputiesView } from "./lib/saeima-parsers.ts";
import { rowsOf } from "./fetch-wikidata.ts";
import { SAEIMA_MATCHED_UNIDS, SAEIMA_TERMS, WIKIDATA_KEYS, delnaCsvUrl, saeimaDeputiesViewUrl } from "./lib/sources.ts";

export type MatchLevel = "exact_unique" | "birth_year" | "via_delna_link" | "override" | "ambiguous" | "none";

export type DelnaMatch = {
  level: MatchLevel;
  name: string;
  birth_year: number | null;
  mandate_status: string | null;
  faction: string | null;
  party: string | null;
  elected_from: string | null;
  titania_unid: string | null;
  education: string | null;
  occupation: string | null;
  residence: string | null;
};

export type TitaniaMatch = { level: MatchLevel; unid: string; faction: string; group: string };

export type WikidataMatch = {
  level: MatchLevel;
  qid: string;
  label: string;
  birth_year: number | null;
  terms: number[];
  minister_roles: { role: string; from: string | null; to: string | null }[];
  lvwiki: string | null;
  enwiki: string | null;
};

export type CandidateMatch = {
  id: number;
  name: string;
  birth_year: number | null;
  delna14: DelnaMatch | null;
  delna13: DelnaMatch | null;
  titania: Record<string, TitaniaMatch>;
  wikidata: WikidataMatch | null;
};

type Overrides = {
  delna?: Record<string, string | null>;
  titania?: Record<string, Record<string, string> | null>;
  wikidata?: Record<string, string | null>;
};

type Ext<T> = { key: string; token: string; birth: number | null; ref: T };
type Issue = { source: string; id: number; name: string; birth_year: number | null; note: string; candidates: string[] };

const ELECTIONS: [number, string][] = [
  [7, "1998-10-03"], [8, "2002-10-05"], [9, "2006-10-07"], [10, "2010-10-02"], [11, "2011-09-17"],
  [12, "2014-10-04"], [13, "2018-10-06"], [14, "2022-10-01"], [15, "2026-10-03"],
];

export function termFromDate(iso: string | null): number | null {
  if (!iso) return null;
  let term: number | null = null;
  for (const [n, date] of ELECTIONS) if (iso.slice(0, 10) >= date) term = n;
  return term;
}

const year = (s: string | undefined): number | null => {
  const m = (s ?? "").match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
};
const unidOf = (url: string | undefined): string | null => (url ?? "").match(/\/0\/([A-F0-9]{32})/i)?.[1] ?? (url ?? "").match(/unid=([A-F0-9]{32})/i)?.[1] ?? null;
const orNull = (s: string | undefined): string | null => (s && s.trim() ? s.trim() : null);

function must(url: string, key?: string): string {
  const t = readCached(url, key);
  if (t === null) throw new Error(`not cached: ${key ?? url}`);
  return t;
}

/** Pick the one external record that belongs to this candidate, or explain why not. */
function resolve<T>(
  cand: { id: number; name: string; name_key: string; token: string; birth_year: number | null },
  byKey: Map<string, Ext<T>[]>,
  byToken: Map<string, Ext<T>[]>,
  candCountByKey: Map<string, number>,
  issues: Issue[],
  source: string,
  describe: (r: T) => string,
): { ref: T; level: MatchLevel } | null {
  const recs = byKey.get(cand.name_key) ?? byToken.get(cand.token) ?? [];
  if (recs.length === 0) return null;
  const sameYear = recs.filter((r) => r.birth !== null && cand.birth_year !== null && r.birth === cand.birth_year);
  const noYear = recs.filter((r) => r.birth === null || cand.birth_year === null);
  if (sameYear.length === 1) return { ref: sameYear[0].ref, level: "birth_year" };
  if (sameYear.length > 1) {
    issues.push({ source, id: cand.id, name: cand.name, birth_year: cand.birth_year, note: "several records with the same name and birth year", candidates: sameYear.map((r) => describe(r.ref)) });
    return null;
  }
  if (recs.length === 1 && noYear.length === 1) {
    // Name-only match: fine unless another 2026 candidate shares the name.
    if ((candCountByKey.get(cand.name_key) ?? 1) > 1) {
      issues.push({ source, id: cand.id, name: cand.name, birth_year: cand.birth_year, note: "name shared by several 2026 candidates and the record has no birth year", candidates: [describe(recs[0].ref)] });
      return null;
    }
    return { ref: recs[0].ref, level: "exact_unique" };
  }
  if (recs.length === 1) {
    issues.push({ source, id: cand.id, name: cand.name, birth_year: cand.birth_year, note: `name matches but birth year differs (${recs[0].birth})`, candidates: [describe(recs[0].ref)] });
    return null;
  }
  issues.push({ source, id: cand.id, name: cand.name, birth_year: cand.birth_year, note: "several records with this name", candidates: recs.map((r) => describe(r.ref)) });
  return null;
}

function index<T>(items: Ext<T>[]): { byKey: Map<string, Ext<T>[]>; byToken: Map<string, Ext<T>[]> } {
  const byKey = new Map<string, Ext<T>[]>();
  const byToken = new Map<string, Ext<T>[]>();
  for (const it of items) {
    byKey.set(it.key, [...(byKey.get(it.key) ?? []), it]);
    byToken.set(it.token, [...(byToken.get(it.token) ?? []), it]);
  }
  return { byKey, byToken };
}

function delnaRecord(row: Record<string, string>, level: MatchLevel, surnameFirst: boolean): DelnaMatch {
  const raw = row["Deputāts/e"] ?? "";
  return {
    level,
    name: surnameFirst ? flipSurnameFirst(raw) : raw.trim(),
    birth_year: year(row["Dzimšanas gads"]),
    mandate_status: orNull(row["Mandāta statuss"]),
    faction: orNull(row["Frakcija"]),
    party: orNull(row["Politiska partija"]),
    elected_from: orNull(row["Ievelēts/-a no saraksta"]),
    titania_unid: unidOf(row["Darbība 13.Saeimā"]),
    education: orNull(row["Izglitība"]),
    occupation: orNull(row["Nodarbošanās"]),
    residence: orNull(row["Dzīvesvieta"]),
  };
}

function main(): void {
  const rows = parseAllCandidatesTable(must(cvkTableUrl));
  const cands = rows.map((r) => ({ id: r.id, name: r.name, name_key: nameKey(r.name), token: tokenKey(r.name), birth_year: r.birth_year }));
  const candCountByKey = new Map<string, number>();
  for (const c of cands) candCountByKey.set(c.name_key, (candCountByKey.get(c.name_key) ?? 0) + 1);
  const overridesPath = join(process.cwd(), "data", "curated", "match-overrides.json");
  const overrides: Overrides = existsSync(overridesPath) ? (JSON.parse(readFileSync(overridesPath, "utf8")) as Overrides) : {};
  const issues: Issue[] = [];

  // Delna
  const d14 = csvObjects(must(delnaCsvUrl("groups_14.csv")));
  const d13 = csvObjects(must(delnaCsvUrl("groups.csv")));
  const ext14 = index(d14.map((row) => ({ key: nameKey(row["Deputāts/e"]), token: tokenKey(row["Deputāts/e"]), birth: year(row["Dzimšanas gads"]), ref: row })));
  const ext13 = index(d13.map((row) => {
    const n = flipSurnameFirst(row["Deputāts/e"]);
    return { key: nameKey(n), token: tokenKey(n), birth: year(row["Dzimšanas gads"]), ref: row };
  }));
  const delnaByName14 = new Map(d14.map((r) => [nameKey(r["Deputāts/e"]), r]));
  const delnaByName13 = new Map(d13.map((r) => [nameKey(flipSurnameFirst(r["Deputāts/e"])), r]));

  // titania views
  const views = new Map<number, ReturnType<typeof parseDeputiesView>>();
  for (const term of SAEIMA_TERMS) views.set(term, parseDeputiesView(must(saeimaDeputiesViewUrl(term))));
  const viewIndex = new Map<number, ReturnType<typeof index<{ unid: string; shortStr: string; lst: string }>>>();
  for (const [term, refs] of views) {
    viewIndex.set(term, index(refs.map((r) => ({ key: nameKey(`${r.name} ${r.sname}`), token: tokenKey(`${r.name} ${r.sname}`), birth: null, ref: { unid: r.unid, shortStr: r.shortStr, lst: r.lst } }))));
  }
  const viewByUnid = new Map<string, { term: number; shortStr: string; lst: string }>();
  for (const [term, refs] of views) for (const r of refs) viewByUnid.set(r.unid, { term, shortStr: r.shortStr, lst: r.lst });

  // Wikidata
  type WdPerson = { qid: string; label: string; birth: number | null; terms: Set<number>; roles: { role: string; from: string | null; to: string | null }[]; lvwiki: string | null; enwiki: string | null };
  const people = new Map<string, WdPerson>();
  const person = (r: Record<string, string>): WdPerson => {
    const qid = r.p.split("/").pop()!;
    let p = people.get(qid);
    if (!p) {
      p = { qid, label: r.pLabel ?? qid, birth: year(r.birth), terms: new Set(), roles: [], lvwiki: r.lvwiki ?? null, enwiki: r.enwiki ?? null };
      people.set(qid, p);
    }
    if (p.birth === null) p.birth = year(r.birth);
    p.lvwiki ??= r.lvwiki ?? null;
    p.enwiki ??= r.enwiki ?? null;
    return p;
  };
  for (const r of rowsOf(must("", WIKIDATA_KEYS.deputies))) {
    const p = person(r);
    const t = Number((r.termLabel ?? "").match(/^(\d+)\./)?.[1]) || termFromDate(r.start ?? null);
    if (t) p.terms.add(t);
  }
  for (const r of rowsOf(must("", WIKIDATA_KEYS.ministers))) {
    const p = person(r);
    const role = r.posLabel ?? r.pos;
    if (!p.roles.some((x) => x.role === role && x.from === (r.start ?? null))) p.roles.push({ role, from: r.start?.slice(0, 10) ?? null, to: r.end?.slice(0, 10) ?? null });
  }
  const wdIndex = index([...people.values()].map((p) => ({ key: nameKey(p.label), token: tokenKey(p.label), birth: p.birth, ref: p })));
  const wdMatch = (p: WdPerson, level: MatchLevel): WikidataMatch => ({
    level, qid: p.qid, label: p.label, birth_year: p.birth, terms: [...p.terms].sort((a, b) => b - a),
    minister_roles: p.roles.sort((a, b) => (b.from ?? "").localeCompare(a.from ?? "")), lvwiki: p.lvwiki, enwiki: p.enwiki,
  });

  const results: CandidateMatch[] = [];
  const wantedUnids = new Map<string, number>();
  const counts: Record<string, Record<string, number>> = {};
  const bump = (src: string, level: string) => {
    counts[src] ??= {};
    counts[src][level] = (counts[src][level] ?? 0) + 1;
  };

  for (const c of cands) {
    const m: CandidateMatch = { id: c.id, name: c.name, birth_year: c.birth_year, delna14: null, delna13: null, titania: {}, wikidata: null };
    const ovDelna = overrides.delna?.[String(c.id)];
    if (ovDelna !== undefined) {
      if (ovDelna !== null) {
        const r14 = delnaByName14.get(nameKey(ovDelna));
        const r13 = delnaByName13.get(nameKey(ovDelna));
        if (r14) m.delna14 = delnaRecord(r14, "override", false);
        if (r13) m.delna13 = delnaRecord(r13, "override", true);
      }
    } else {
      const r14 = resolve(c, ext14.byKey, ext14.byToken, candCountByKey, issues, "delna14", (r) => `${r["Deputāts/e"]} (${r["Dzimšanas gads"]})`);
      if (r14) m.delna14 = delnaRecord(r14.ref, r14.level, false);
      const r13 = resolve(c, ext13.byKey, ext13.byToken, candCountByKey, issues, "delna13", (r) => `${r["Deputāts/e"]} (${r["Dzimšanas gads"]})`);
      if (r13) m.delna13 = delnaRecord(r13.ref, r13.level, true);
    }
    bump("delna14", m.delna14?.level ?? "none");
    bump("delna13", m.delna13?.level ?? "none");

    // Overrides merge per term: a term present in the override wins, terms it
    // does not name still match automatically; the whole entry set to null
    // suppresses every term.
    const ovTit = overrides.titania?.[String(c.id)];
    for (const term of SAEIMA_TERMS) {
      let hit: TitaniaMatch | null = null;
      const ovUnid = ovTit === null ? null : ovTit?.[String(term)];
      if (ovUnid !== undefined) {
        if (ovUnid !== null) hit = { level: "override", unid: ovUnid, faction: viewByUnid.get(ovUnid)?.shortStr ?? "", group: viewByUnid.get(ovUnid)?.lst ?? "" };
      } else {
        const viaDelna = term === 14 ? m.delna14?.titania_unid : term === 13 ? m.delna13?.titania_unid : null;
        if (viaDelna) hit = { level: "via_delna_link", unid: viaDelna, faction: viewByUnid.get(viaDelna)?.shortStr ?? "", group: viewByUnid.get(viaDelna)?.lst ?? "" };
        else {
          const vi = viewIndex.get(term)!;
          const r = resolve(c, vi.byKey, vi.byToken, candCountByKey, issues, `titania${term}`, (x) => `${x.lst} ${x.unid}`);
          if (r) hit = { level: r.level, unid: r.ref.unid, faction: r.ref.shortStr, group: r.ref.lst };
        }
      }
      if (hit) {
        m.titania[String(term)] = hit;
        wantedUnids.set(hit.unid, term);
      }
      bump(`titania${term}`, hit?.level ?? "none");
    }

    const ovWd = overrides.wikidata?.[String(c.id)];
    if (ovWd !== undefined) {
      if (ovWd && people.has(ovWd)) m.wikidata = wdMatch(people.get(ovWd)!, "override");
    } else {
      const r = resolve(c, wdIndex.byKey, wdIndex.byToken, candCountByKey, issues, "wikidata", (p) => `${p.label} ${p.qid} (${p.birth ?? "?"})`);
      if (r) m.wikidata = wdMatch(r.ref, r.level);
    }
    bump("wikidata", m.wikidata?.level ?? "none");
    results.push(m);
  }

  atomicWrite(join(CACHE_ROOT, "raw", "match.json"), JSON.stringify(results, null, 1));
  atomicWrite(join(CACHE_ROOT, "raw", SAEIMA_MATCHED_UNIDS), JSON.stringify([...wantedUnids].map(([unid, term]) => ({ term, unid })), null, 1));
  const reportsDir = join(process.cwd(), "data", "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, "matching.json"), JSON.stringify({ generated_at: new Date().toISOString(), counts, issues }, null, 1));
  for (const [src, levels] of Object.entries(counts)) console.log(`${src.padEnd(10)} ${Object.entries(levels).map(([l, n]) => `${l}=${n}`).join(" ")}`);
  console.log(`issues: ${issues.length}, deputy pages wanted: ${wantedUnids.size}`);
}

main();
