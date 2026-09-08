// Stage 1: fetch dati.cvk.lv/SV2026 into the cache.
//
//   node pipeline/fetch-cvk.ts                 index + 14 list pages + candidate table (16 requests)
//   node pipeline/fetch-cvk.ts --details       ... plus every candidate page not yet cached (~1,430)
//   node pipeline/fetch-cvk.ts --refresh       re-fetch index/lists/table; re-fetch only candidate
//                                              pages whose table row changed since the last run
//   node pipeline/fetch-cvk.ts --refresh-all   re-fetch everything
//   --limit=N                                  cap candidate pages (for smoke tests)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_ROOT, FatalFetchError, atomicWrite, fetchCached, sha256 } from "./lib/http.ts";
import { parseAllCandidatesTable, parseIndex, type CvkTableRow } from "./lib/cvk-parsers.ts";

import { cvkCandidateUrl, cvkIndexUrl, cvkListUrl, cvkTableUrl } from "./lib/cvk-urls.ts";

const ROW_HASHES = join(CACHE_ROOT, "cvk-row-hashes.json");

function rowHash(r: CvkTableRow): string {
  return sha256([r.id, r.name, r.list_slug, r.constituency_slug, r.position, r.birth_year, r.workplace_raw].join("|"));
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const limitArg = [...args].find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
  const refreshAll = args.has("--refresh-all");
  const refresh = refreshAll || args.has("--refresh");
  const details = refreshAll || args.has("--details") || refresh;

  const index = await fetchCached(cvkIndexUrl, { refresh });
  const { lists, constituencies } = parseIndex(index.text);
  if (lists.length === 0) throw new Error("index parsed to zero lists - markup changed?");
  console.log(`index: ${lists.length} lists, ${constituencies.length} constituencies (${index.fromCache ? "cache" : "fetched"})`);

  for (const list of lists) {
    const r = await fetchCached(cvkListUrl(list.slug), { refresh });
    console.log(`  list ${String(list.no).padStart(2)} ${list.slug} (${r.fromCache ? "cache" : "fetched"})`);
  }

  const table = await fetchCached(cvkTableUrl, { refresh });
  const rows = parseAllCandidatesTable(table.text);
  const expected = lists.reduce((n, l) => n + l.candidates_count, 0);
  console.log(`table: ${rows.length} candidates (index says ${expected})`);
  if (rows.length < expected * 0.95) throw new Error(`only ${rows.length}/${expected} rows parsed - markup changed?`);

  if (!details) {
    console.log("done (no --details: candidate pages not fetched)");
    return;
  }

  const previous: Record<string, string> = existsSync(ROW_HASHES)
    ? (JSON.parse(readFileSync(ROW_HASHES, "utf8")) as Record<string, string>)
    : {};
  const current: Record<string, string> = {};
  let fetched = 0;
  let cached = 0;
  let missing = 0;
  let changed = 0;
  let n = 0;
  try {
    for (const row of rows) {
      current[row.id] = rowHash(row);
      if (n >= limit) continue;
      n += 1;
      const rowChanged = previous[row.id] !== undefined && previous[row.id] !== current[row.id];
      if (rowChanged) changed += 1;
      const r = await fetchCached(cvkCandidateUrl(row.path), {
        refresh: refreshAll || (refresh && rowChanged),
        allowNotFound: true,
      });
      if (r.status === 404) missing += 1;
      else if (r.fromCache) cached += 1;
      else fetched += 1;
      if (n % 100 === 0) console.log(`  ${n}/${Math.min(rows.length, limit)} candidate pages (fetched ${fetched}, cache ${cached}, 404 ${missing})`);
    }
  } finally {
    atomicWrite(ROW_HASHES, JSON.stringify(current, null, 1));
  }
  console.log(`candidate pages: fetched ${fetched}, from cache ${cached}, missing ${missing}, rows changed since last run ${changed}`);
}

main().catch((err) => {
  console.error(err instanceof FatalFetchError ? `FATAL: ${err.message}` : err);
  process.exit(1);
});
