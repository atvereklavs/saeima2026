// Stage 3c: Wikidata - Saeima deputies with terms, and Latvian ministers.
//   node pipeline/fetch-wikidata.ts [--refresh]
// Two narrow SPARQL queries, cached as JSON under .cache/raw/wikidata/.
import { fetchCached } from "./lib/http.ts";
import { WIKIDATA_KEYS, WIKIDATA_SPARQL } from "./lib/sources.ts";

export const QUERIES = {
  deputies: `
SELECT ?p ?pLabel ?termLabel ?start ?end ?birth ?lvwiki ?enwiki WHERE {
  ?p p:P39 ?st . ?st ps:P39 wd:Q21191589 .
  OPTIONAL { ?st pq:P2937 ?term }
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?p wdt:P569 ?birth }
  OPTIONAL { ?lvwiki schema:about ?p ; schema:isPartOf <https://lv.wikipedia.org/> }
  OPTIONAL { ?enwiki schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "lv,en". }
}`,
  ministers: `
SELECT ?p ?pLabel ?pos ?posLabel ?start ?end ?birth ?lvwiki ?enwiki WHERE {
  ?p p:P39 ?st . ?st ps:P39 ?pos .
  ?pos wdt:P279* wd:Q83307 . ?pos wdt:P17 wd:Q211 .
  OPTIONAL { ?st pq:P580 ?start }
  OPTIONAL { ?st pq:P582 ?end }
  OPTIONAL { ?p wdt:P569 ?birth }
  OPTIONAL { ?lvwiki schema:about ?p ; schema:isPartOf <https://lv.wikipedia.org/> }
  OPTIONAL { ?enwiki schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "lv,en". }
}`,
} as const;

export type SparqlRow = Record<string, string>;

export function rowsOf(json: string): SparqlRow[] {
  const parsed = JSON.parse(json) as { results: { bindings: Record<string, { value: string }>[] } };
  return parsed.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  for (const [name, query] of Object.entries(QUERIES) as [keyof typeof QUERIES, string][]) {
    const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query.trim())}`;
    const r = await fetchCached(url, { refresh, accept: "application/sparql-results+json", cacheKey: WIKIDATA_KEYS[name] });
    const rows = rowsOf(r.text);
    const people = new Set(rows.map((x) => x.p)).size;
    console.log(`wikidata ${name}: ${rows.length} rows, ${people} people (${r.fromCache ? "cache" : "fetched"})`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
