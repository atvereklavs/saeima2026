// Stage 6: turn the cache into the committed dataset under data/.
//
// Reads only what fetch-cvk.ts cached (never hits the network), derives the
// fields the site needs, applies the privacy filter, validates, and writes
// data/lists.json, data/candidates.json, data/candidates.index.json, data/meta.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_ROOT, cachedEntry, readCached } from "./lib/http.ts";
import { buildHistory } from "./lib/history.ts";
import type { CandidateMatch } from "./match.ts";
import { DELNA_MPS_URL, POLISTATS_DEPUTIES_URL, saeimaDeputyUrl } from "./lib/sources.ts";
import { parseAllCandidatesTable, parseCandidatePage, parseIndex, parseListPage } from "./lib/cvk-parsers.ts";
import type { CvkCandidatePage, CvkListPage, CvkTableRow } from "./lib/cvk-parsers.ts";
import { ageBand, ageOf, loadTierRules, mean, median } from "./lib/derive.ts";
import { deriveTags, loadTagRules } from "./lib/tags.ts";
import { nameKey } from "./lib/names.ts";
import { cvkCandidateUrl, cvkCandidateUrlEn, cvkIndexUrl, cvkListUrl, cvkListUrlEn, cvkTableUrl } from "./lib/cvk-urls.ts";

const DATA_DIR = join(process.cwd(), "data");
const ELECTION_DATE = "2026-10-03";
/** Individual-level fields CVK publishes that this site deliberately does not. */
export const EXCLUDED_FIELDS = ["ethnicity", "marital_status", "foreign_citizenship"] as const;
const PUBLISH_KGB = process.env.PUBLISH_KGB !== "0";

import type { Candidate, Position } from "./lib/types.ts";

type CuratedList = Partial<{
  short_name: string;
  pm_candidate: string;
  leads_by_constituency: Record<string, string>;
  coalition: string;
  seats_14: number;
  wikipedia_lv: string;
  wikipedia_en: string;
  knab_public_id: string;
}>;

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

function must(url: string): string {
  const text = readCached(url);
  if (text === null) throw new Error(`not cached: ${url} - run pipeline:cvk first`);
  return text;
}

function splitPositionLine(line: string): Position {
  // CVK table cells read "Workplace, Role"; the role is the shortest sensible tail.
  const i = line.lastIndexOf(", ");
  return i > 0 ? { workplace: line.slice(0, i), role: line.slice(i + 2) } : { workplace: line, role: "" };
}

function main(): void {
  const rules = loadTierRules();
  const tagRules = loadTagRules();
  const index = parseIndex(must(cvkIndexUrl));
  const constituencyName = Object.fromEntries(index.constituencies.map((c) => [c.slug, c.name]));
  const rows = parseAllCandidatesTable(must(cvkTableUrl));
  const listPages = new Map<string, CvkListPage>();
  for (const l of index.lists) listPages.set(l.slug, parseListPage(must(cvkListUrl(l.slug))));

  const curated = readJson<Record<string, CuratedList>>(join(DATA_DIR, "curated", "lists.json"), {});
  delete (curated as Record<string, unknown>)._comment;
  const previous = readJson<Candidate[]>(join(DATA_DIR, "candidates.json"), []);
  const matches = readJson<CandidateMatch[]>(join(CACHE_ROOT, "raw", "match.json"), []);
  const matchById = new Map(matches.map((m) => [m.id, m]));
  let withHistory = 0;
  const previousById = new Map(previous.map((c) => [c.id, c]));

  const candidates: Candidate[] = [];
  let withProfile = 0;
  let latestUpdate: string | null = null;

  for (const row of rows) {
    const url = cvkCandidateUrl(row.path);
    const html = readCached(url);
    const profile: CvkCandidatePage | null = html ? parseCandidatePage(html) : null;
    if (profile) withProfile += 1;
    if (profile?.updated_at && (!latestUpdate || profile.updated_at > latestUpdate)) latestUpdate = profile.updated_at;

    const positionsRaw = row.workplace_raw ? row.workplace_raw.split("\n") : [];
    const positions = profile?.positions.length ? profile.positions : positionsRaw.map(splitPositionLine);
    const m = matchById.get(row.id);
    const history = buildHistory(m, positions, rules);
    if (!history.provisional) withHistory += 1;
    const birthYear = profile?.birth_year ?? row.birth_year;
    const age = ageOf(birthYear);
    const headline = positions[0] ? (positions[0].role ? `${positions[0].role}, ${positions[0].workplace}` : positions[0].workplace) : positionsRaw[0] ?? null;
    const latestTerm = Object.keys(history.sources.titania).map(Number).sort((a, b) => b - a)[0];
    const links: Record<string, string> = {
      cvk: url,
      cvk_en: cvkCandidateUrlEn(row.path),
      cvk_list: cvkListUrl(row.list_slug),
    };
    if (latestTerm) links.saeima = saeimaDeputyUrl(latestTerm, history.sources.titania[String(latestTerm)]);
    if (history.sources.delna_14) links.delna = DELNA_MPS_URL;
    else if (history.sources.delna_13) links.delna = DELNA_MPS_URL.replace("saeima=14", "saeima=13");
    if (history.saeima_terms.length) links.polistats = POLISTATS_DEPUTIES_URL;
    if (m?.wikidata) {
      links.wikidata = `https://www.wikidata.org/wiki/${m.wikidata.qid}`;
      if (m.wikidata.lvwiki) links.wikipedia_lv = m.wikidata.lvwiki;
      if (m.wikidata.enwiki) links.wikipedia_en = m.wikidata.enwiki;
    }

    const c: Candidate = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      name_key: nameKey(row.name),
      status: "active",
      withdrawn_at: null,
      list_slug: row.list_slug,
      list_no: index.lists.find((l) => l.slug === row.list_slug)?.no ?? 0,
      constituency: row.constituency_slug,
      constituency_name: constituencyName[row.constituency_slug] ?? row.constituency,
      position: row.position,
      birth_year: birthYear,
      age,
      age_band: ageBand(age),
      gender: profile?.gender ?? null,
      residence: profile?.residence ?? null,
      education_level: profile?.education_level ?? null,
      education: profile?.education ?? [],
      positions,
      positions_raw: positionsRaw,
      headline_role: headline,
      has_profile: Boolean(profile),
      history,
      tags: deriveTags(profile?.education ?? [], positions, history.committees, tagRules),
      links,
      sources: {
        cvk: { url, fetched_at: cachedEntry(url)?.fetched_at ?? cachedEntry(cvkTableUrl)?.fetched_at ?? null, updated_at: profile?.updated_at ?? null },
        ...(m?.delna14 || m?.delna13 ? { delna: { url: links.delna, fetched_at: cachedEntry("https://deputatiuzdelnas.lv/data/tab_b/groups_14.csv")?.fetched_at ?? null } } : {}),
        ...(latestTerm ? { saeima: { url: links.saeima, fetched_at: cachedEntry(links.saeima)?.fetched_at ?? null } } : {}),
        ...(m?.wikidata ? { wikidata: { url: links.wikidata, fetched_at: null } } : {}),
      },
      photo: null,
    };
    if (PUBLISH_KGB) c.kgb_no_collaboration = profile?.kgb_no_collaboration ?? null;
    candidates.push(c);
  }

  // Candidates that were in a previous build but vanished from the CVK table
  // stay in the dataset as withdrawn, so their page keeps existing with a notice.
  const currentIds = new Set(candidates.map((c) => c.id));
  const today = new Date().toISOString().slice(0, 10);
  for (const old of previous) {
    if (currentIds.has(old.id)) continue;
    candidates.push({ ...old, status: "withdrawn", withdrawn_at: old.withdrawn_at ?? today });
  }
  candidates.sort((a, b) => a.list_no - b.list_no || a.constituency.localeCompare(b.constituency) || a.position - b.position);

  const lists = index.lists.map((l) => {
    const page = listPages.get(l.slug)!;
    const own = candidates.filter((c) => c.list_slug === l.slug && c.status === "active");
    const tierCounts: Record<string, number> = {};
    for (const t of rules.order) tierCounts[t] = 0;
    for (const c of own) tierCounts[c.history.tier] = (tierCounts[c.history.tier] ?? 0) + 1;
    const parl = tierCounts.minister + tierCounts.sitting_mp + tierCounts.former_mp;
    const office = parl + tierCounts.municipal + tierCounts.civil_service;
    const ages = own.map((c) => c.age).filter((a): a is number => a !== null);
    const byConstituency: Record<string, number[]> = {};
    for (const con of index.constituencies) {
      byConstituency[con.slug] = own
        .filter((c) => c.constituency === con.slug)
        .sort((a, b) => a.position - b.position)
        .map((c) => c.id);
    }
    const tagCounts = new Map<string, number>();
    for (const c of own) for (const t of c.tags) tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + 1);
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));
    const leads: Record<string, string> = {};
    for (const [slug, ids] of Object.entries(byConstituency)) {
      const first = own.find((c) => c.id === ids[0]);
      if (first) leads[slug] = first.name;
    }
    const cur = curated[l.slug] ?? {};
    return {
      slug: l.slug,
      no: l.no,
      name: l.name,
      short_name: cur.short_name ?? null,
      candidates_count: own.length,
      programme: page.programme,
      stats: {
        candidates_count: page.stats.candidates_count,
        gender: page.stats.gender,
        education: page.stats.education,
        foreign_citizenship: page.stats.foreign_citizenship,
      },
      knab: null,
      curated: {
        pm_candidate: cur.pm_candidate ?? null,
        coalition: cur.coalition ?? null,
        seats_14: cur.seats_14 ?? null,
        wikipedia_lv: cur.wikipedia_lv ?? null,
        wikipedia_en: cur.wikipedia_en ?? null,
      },
      leads_by_constituency: { ...leads, ...(cur.leads_by_constituency ?? {}) },
      aggregates: {
        tier_counts: tierCounts,
        experience_share: own.length ? Math.round((parl / own.length) * 1000) / 10 : 0,
        public_office_share: own.length ? Math.round((office / own.length) * 1000) / 10 : 0,
        avg_age: mean(ages),
        median_age: median(ages),
        education_mix: page.stats.education,
        top_tags: topTags,
        by_constituency: byConstituency,
      },
      links: {
        cvk: cvkListUrl(l.slug),
        cvk_en: cvkListUrlEn(l.slug),
        knab: cur.knab_public_id ? `https://info.knab.gov.lv/parties/${cur.knab_public_id}` : "https://info.knab.gov.lv/parties",
      },
      sources: { cvk: { url: cvkListUrl(l.slug), fetched_at: cachedEntry(cvkListUrl(l.slug))?.fetched_at ?? null } },
      debates: null,
      position_vector: null,
    };
  });

  // Validation before anything is written.
  const active = candidates.filter((c) => c.status === "active");
  if (lists.length !== 14) throw new Error(`expected 14 lists, got ${lists.length}`);
  const listSlugs = new Set(lists.map((l) => l.slug));
  for (const c of active) {
    if (!listSlugs.has(c.list_slug)) throw new Error(`candidate ${c.id} has unknown list ${c.list_slug}`);
    if (!constituencyName[c.constituency]) throw new Error(`candidate ${c.id} has unknown constituency ${c.constituency}`);
    for (const f of EXCLUDED_FIELDS) if (f in c) throw new Error(`excluded field ${f} leaked into candidate ${c.id}`);
  }
  if (active.length !== rows.length) throw new Error(`active count ${active.length} != table rows ${rows.length}`);

  const indexRows = candidates.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    list_no: c.list_no,
    constituency: c.constituency,
    position: c.position,
    birth_year: c.birth_year,
    age_band: c.age_band,
    tier: c.history.tier,
    tags: c.tags.map((t) => t.tag),
    headline_role: c.headline_role,
    status: c.status,
  }));

  const meta = {
    built_at: new Date().toISOString(),
    election_date: ELECTION_DATE,
    cvk_index_fetched_at: cachedEntry(cvkIndexUrl)?.fetched_at ?? null,
    cvk_last_updated: latestUpdate,
    counts: {
      lists: lists.length,
      candidates: candidates.length,
      active: active.length,
      withdrawn: candidates.length - active.length,
      with_profile: withProfile,
      with_official_history: withHistory,
      matched_delna_14: matches.filter((m) => m.delna14).length,
      matched_delna_13: matches.filter((m) => m.delna13).length,
      matched_titania: matches.filter((m) => Object.keys(m.titania).length > 0).length,
      matched_wikidata: matches.filter((m) => m.wikidata).length,
    },
    constituencies: index.constituencies,
    tiers: rules.labels,
    tier_order: rules.order,
    tags: Object.fromEntries(Object.entries(tagRules.tags).map(([k, v]) => [k, { lv: v.lv, en: v.en }])),
    publish_kgb: PUBLISH_KGB,
    excluded_fields: EXCLUDED_FIELDS,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "lists.json"), JSON.stringify(lists, null, 1));
  writeFileSync(join(DATA_DIR, "candidates.json"), JSON.stringify(candidates, null, 1));
  writeFileSync(join(DATA_DIR, "candidates.index.json"), JSON.stringify(indexRows, null, 1));
  writeFileSync(join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 1));
  const tierSummary = rules.order.map((t) => `${t}=${active.filter((c) => c.history.tier === t).length}`).join(" ");
  console.log(`lists=${lists.length} candidates=${candidates.length} active=${active.length} with_profile=${withProfile} with_official_history=${withHistory}`);
  console.log(`tiers: ${tierSummary}`);
}

main();
