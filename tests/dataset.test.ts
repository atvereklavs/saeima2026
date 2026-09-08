// Invariants over the committed dataset in data/. These run against whatever
// the last pipeline build produced, so they catch regressions in the real data,
// not just in the parsers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string): unknown => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
type Rec = Record<string, unknown>;
const lists = read("lists.json") as Rec[];
const candidates = read("candidates.json") as Rec[];
const meta = read("meta.json") as Rec;

test("14 lists, numbered 1-14, each with candidates", () => {
  assert.equal(lists.length, 14);
  assert.deepEqual(lists.map((l) => l.no).sort((a, b) => (a as number) - (b as number)), Array.from({ length: 14 }, (_, i) => i + 1));
  for (const l of lists) assert.ok((l.candidates_count as number) >= 50, `${l.slug} has ${l.candidates_count}`);
});

test("every active candidate belongs to a known list and constituency", () => {
  const slugs = new Set(lists.map((l) => l.slug));
  const cons = new Set((meta.constituencies as Rec[]).map((c) => c.slug));
  const active = candidates.filter((c) => c.status === "active");
  assert.equal(active.length, (meta.counts as Rec).active);
  for (const c of active) {
    assert.ok(slugs.has(c.list_slug as string), `candidate ${c.id} list ${c.list_slug}`);
    assert.ok(cons.has(c.constituency as string), `candidate ${c.id} constituency ${c.constituency}`);
  }
});

test("privacy: excluded fields never appear on any candidate", () => {
  const excluded = meta.excluded_fields as string[];
  assert.ok(excluded.includes("ethnicity") && excluded.includes("marital_status"));
  for (const c of candidates) for (const f of excluded) assert.ok(!(f in c), `candidate ${c.id} leaks ${f}`);
});

test("official history is internally consistent", () => {
  for (const c of candidates) {
    const h = c.history as Rec;
    const terms = h.saeima_terms as number[];
    assert.equal(h.terms_count, terms.length);
    if ((h.sitting_mp as boolean) === true) assert.ok(terms.includes(14), `candidate ${c.id} sitting but no 14th term`);
    if (!h.provisional) {
      const src = h.sources as Rec;
      assert.ok(src.delna_14 || src.delna_13 || Object.keys(src.titania as Rec).length > 0 || src.wikidata, `candidate ${c.id} non-provisional without a source`);
    }
    for (const com of h.committees as Rec[]) assert.ok(terms.includes(com.term as number), `candidate ${c.id} committee term ${com.term} not in terms`);
  }
});

test("every candidate links back to its CVK source", () => {
  for (const c of candidates) {
    const links = c.links as Rec;
    assert.match(links.cvk as string, /^https:\/\/dati\.cvk\.lv\/SV2026\/kandidati\//);
    const sources = c.sources as Rec;
    assert.ok((sources.cvk as Rec).url, `candidate ${c.id} missing cvk source url`);
  }
});

test("counts in meta line up with the dataset", () => {
  const counts = meta.counts as Rec;
  assert.equal(candidates.length, counts.candidates);
  assert.equal(candidates.filter((c) => (c.history as Rec).provisional === false).length, counts.with_official_history);
});
