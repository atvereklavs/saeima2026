// Validation for the compass positions file - every stance must be evidenced
// by a verbatim quote from that list's own CVK programme.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Rec = Record<string, unknown>;
const positions = JSON.parse(readFileSync(new URL("../data/curated/positions.json", import.meta.url), "utf8")) as Rec;
const lists = JSON.parse(readFileSync(new URL("../data/lists.json", import.meta.url), "utf8")) as Rec[];
const programmes = new Map(lists.map((l) => [l.slug as string, ((l.programme as Rec).text as string)]));
const statements = positions.statements as Rec[];
const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

test("8-16 statements with unique kebab-case ids and bilingual wording", () => {
  assert.ok(statements.length >= 8 && statements.length <= 16, `${statements.length} statements`);
  const ids = new Set<string>();
  for (const s of statements) {
    assert.match(s.id as string, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(s.id as string), `duplicate ${s.id}`);
    ids.add(s.id as string);
    for (const field of ["statement", "topic"] as const) {
      const v = s[field] as Rec;
      assert.ok((v.lv as string).length > 0 && (v.en as string).length > 0, `${s.id} ${field}`);
      assert.ok(!(v.lv as string).includes("—") && !(v.en as string).includes("—"), `em dash in ${s.id} ${field}`);
    }
  }
});

test("every statement names all 14 lists explicitly", () => {
  const slugs = [...programmes.keys()].sort();
  for (const s of statements) {
    assert.deepEqual(Object.keys(s.stances as Rec).sort(), slugs, `stances of ${s.id}`);
  }
});

test("scores are -2..2 and every non-null stance quotes its programme verbatim", () => {
  for (const s of statements) {
    for (const [slug, stance] of Object.entries(s.stances as Rec)) {
      if (stance === null) continue;
      const st = stance as Rec;
      assert.ok(Number.isInteger(st.score) && (st.score as number) >= -2 && (st.score as number) <= 2, `${s.id}/${slug} score ${st.score}`);
      const quote = st.quote as string;
      assert.ok(quote && quote.length >= 15, `${s.id}/${slug} quote too short`);
      assert.ok(norm(programmes.get(slug)!).includes(norm(quote)), `${s.id}/${slug}: quote not found verbatim in programme`);
    }
  }
});

test("every list has at least 6 evidenced stances", () => {
  for (const slug of programmes.keys()) {
    const n = statements.filter((s) => (s.stances as Rec)[slug] !== null).length;
    assert.ok(n >= 6, `${slug} has only ${n} stances`);
  }
});
