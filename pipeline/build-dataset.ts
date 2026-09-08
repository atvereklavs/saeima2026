// Stage 6: turn the cache into the committed dataset under data/.
//
// Reads only what fetch-cvk.ts cached (never hits the network), derives the
// fields the site needs, applies the privacy filter, validates, and writes
// data/lists.json, data/candidates.json, data/candidates.index.json, data/meta.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cachedEntry, readCached } from "./lib/http.ts";
import { parseAllCandidatesTable, parseCandidatePage, parseIndex, parseListPage } from "./lib/cvk-parsers.ts";
import type { CvkCandidatePage, CvkListPage, CvkTableRow } from "./lib/cvk-parsers.ts";
import { ageBand, ageOf, deriveTier, loadTierRules, mean, median } from "./lib/derive.ts";
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
  const index = parseIndex(must(cvkIndexUrl));
  const constituencyName = Object.fromEntries(index.constituencies.map((c) => [c.slug, c.name]));
  const rows = parseAllCandidatesTable(must(cvkTableUrl));
  const listPages = new Map<string, CvkListPage>();
  for (const l of index.lists) listPages.set(l.slug, parseListPage(must(cvkListUrl(l.slug))));

  const curated = readJson<Record<string, CuratedList>>(join(DATA_DIR, "curated", "lists.json"), {});
  const previous = readJson<Candidate[]>(join(DATA_DIR, "candidates.json"), []);
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
    const lines = positions.map((p) => (p.role ? `${p.workplace}, ${p.role}` : p.workplace));
    const { tier, flags } = deriveTier(lines.length ? lines : positionsRaw, rules);
    const birthYear = profile?.birth_year ?? row.birth_year;
    const age = ageOf(birthYear);
    const headline = positions[0] ? (positions[0].role ? `${positions[0].role}, ${positions[0].workplace}` : positions[0].workplace) : positionsRaw[0] ?? null;

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
      history: {
        tier,
        flags,
        provisional: true,
        saeima_terms: [],
        committees: [],
        minister_roles: [],
        municipal_role: flags.includes("municipal")
          ? /priekssedetaj|\bmer[se]\b|vicemer/i.test(nameKey(lines.join(" | ")))
            ? "mayor"
            : "councillor"
          : null,
      },
      tags: [],
      links: {
        cvk: url,
        cvk_en: cvkCandidateUrlEn(row.path),
        cvk_list: cvkListUrl(row.list_slug),
      },
      sources: {
        cvk: { url, fetched_at: cachedEntry(url)?.fetched_at ?? cachedEntry(cvkTableUrl)?.fetched_at ?? null, updated_at: profile?.updated_at ?? null },
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
        top_tags: [] as { tag: string; count: number }[],
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
    tags: c.tags.slice(0, 3).map((t) => t.tag),
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
    },
    constituencies: index.constituencies,
    tiers: rules.labels,
    tier_order: rules.order,
    tags: {} as Record<string, { lv: string; en: string }>,
    publish_kgb: PUBLISH_KGB,
    excluded_fields: EXCLUDED_FIELDS,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, "lists.json"), JSON.stringify(lists, null, 1));
  writeFileSync(join(DATA_DIR, "candidates.json"), JSON.stringify(candidates, null, 1));
  writeFileSync(join(DATA_DIR, "candidates.index.json"), JSON.stringify(indexRows, null, 1));
  writeFileSync(join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 1));
  const tierSummary = rules.order.map((t) => `${t}=${active.filter((c) => c.history.tier === t).length}`).join(" ");
  console.log(`lists=${lists.length} candidates=${candidates.length} active=${active.length} with_profile=${withProfile}`);
  console.log(`tiers: ${tierSummary}`);
}

main();
