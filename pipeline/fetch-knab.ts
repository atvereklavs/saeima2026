// Stage 3d: KNAB party registry (names, registration numbers, founding dates).
//   node pipeline/fetch-knab.ts [--refresh]
import { fetchCached } from "./lib/http.ts";
import { KNAB_PARTIES_URL } from "./lib/sources.ts";

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  const r = await fetchCached(KNAB_PARTIES_URL, { refresh, accept: "application/json" });
  const parsed = JSON.parse(r.text) as { data?: unknown[] } | unknown[];
  const items = Array.isArray(parsed) ? parsed : (parsed as { parties?: unknown[] }).parties ?? Object.values(parsed)[0];
  if ((items as unknown[]).length < 100) throw new Error(`only ${(items as unknown[]).length} parties - pagination limit ignored?`);
  console.log(`knab parties: ${(items as unknown[]).length} (${r.fromCache ? "cache" : "fetched"})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
