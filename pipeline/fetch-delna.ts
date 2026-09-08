// Stage 3a: Delna's "Deputāti uz Delnas" CSVs for the 13th and 14th Saeima.
//   node pipeline/fetch-delna.ts [--refresh]
import { fetchCached } from "./lib/http.ts";
import { csvObjects } from "./lib/csv.ts";
import { delnaCsvUrl } from "./lib/sources.ts";

async function main(): Promise<void> {
  const refresh = process.argv.includes("--refresh");
  for (const file of ["groups_14.csv", "groups.csv"] as const) {
    const r = await fetchCached(delnaCsvUrl(file), { refresh, accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" });
    const rows = csvObjects(r.text);
    if (rows.length < 50) throw new Error(`${file}: only ${rows.length} rows parsed - format changed?`);
    console.log(`${file}: ${rows.length} rows, columns: ${Object.keys(rows[0]).join(" | ")} (${r.fromCache ? "cache" : "fetched"})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
