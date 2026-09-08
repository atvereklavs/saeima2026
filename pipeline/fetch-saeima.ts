// Stage 3b: titania.saeima.lv deputy directories (12th-14th Saeima) and, once
// match.ts has produced .cache/raw/saeima-matched-unids.json, the individual
// deputy pages for matched candidates only.
//   node pipeline/fetch-saeima.ts                  the three directory views
//   node pipeline/fetch-saeima.ts --deputy-pages   ... plus matched deputy pages
//   --refresh                                      re-fetch the views
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE_ROOT, fetchCached } from "./lib/http.ts";
import { parseDeputiesView } from "./lib/saeima-parsers.ts";
import { SAEIMA_MATCHED_UNIDS, SAEIMA_TERMS, saeimaDeputiesViewUrl, saeimaDeputyUrl } from "./lib/sources.ts";

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const refresh = args.has("--refresh");
  for (const term of SAEIMA_TERMS) {
    const r = await fetchCached(saeimaDeputiesViewUrl(term), { refresh });
    const refs = parseDeputiesView(r.text);
    if (refs.length < 90) throw new Error(`saeima ${term}: only ${refs.length} deputies parsed - markup changed?`);
    console.log(`saeima ${term}: ${refs.length} deputies (${r.fromCache ? "cache" : "fetched"})`);
  }
  if (!args.has("--deputy-pages")) return;

  const listPath = join(CACHE_ROOT, "raw", SAEIMA_MATCHED_UNIDS);
  if (!existsSync(listPath)) throw new Error(`${listPath} missing - run pipeline/match.ts first`);
  const wanted = JSON.parse(readFileSync(listPath, "utf8")) as { term: number; unid: string }[];
  let fetched = 0;
  let cached = 0;
  for (const { term, unid } of wanted) {
    const r = await fetchCached(saeimaDeputyUrl(term, unid), { allowNotFound: true });
    if (r.fromCache) cached += 1;
    else fetched += 1;
  }
  console.log(`deputy pages: ${wanted.length} wanted, fetched ${fetched}, from cache ${cached}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
