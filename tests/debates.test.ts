// Validation for the curated debates file - the gate for every new entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Rec = Record<string, unknown>;
const debates = JSON.parse(readFileSync(new URL("../data/curated/debates.json", import.meta.url), "utf8")) as Rec;
const lists = JSON.parse(readFileSync(new URL("../data/lists.json", import.meta.url), "utf8")) as Rec[];
const slugs = new Set(lists.map((l) => l.slug as string));
const events = (debates.events ?? []) as Rec[];
const KINDS = new Set(["debate", "interview", "series", "article"]);
const editorial = (s: string): boolean => !s.includes("—");

test("events have unique ids, valid dates and https sources", () => {
  const ids = new Set<string>();
  for (const ev of events) {
    assert.match(ev.id as string, /^[a-z0-9-]+$/, `id ${ev.id}`);
    assert.ok(!ids.has(ev.id as string), `duplicate id ${ev.id}`);
    ids.add(ev.id as string);
    assert.match(ev.date as string, /^\d{4}-\d{2}-\d{2}$/, `date ${ev.date}`);
    assert.ok(!Number.isNaN(Date.parse(ev.date as string)));
    assert.ok((ev.date as string) <= "2026-10-03", `event ${ev.id} after election day`);
    assert.ok(KINDS.has(ev.kind as string), `kind ${ev.kind}`);
    const src = ev.source as Rec;
    assert.ok((src.name as string).length > 0);
    assert.match(src.url as string, /^https:\/\//, `source url of ${ev.id}`);
    if (ev.video_url) assert.match(ev.video_url as string, /^https:\/\//);
    const title = ev.title as Rec;
    assert.ok((title.lv as string).length > 0 && (title.en as string).length > 0, `title of ${ev.id}`);
    assert.ok(editorial(title.lv as string) && editorial(title.en as string), `em dash in title of ${ev.id}`);
  }
});

test("insights point at known lists and carry bilingual summaries", () => {
  for (const ev of events) {
    for (const ins of (ev.insights ?? []) as Rec[]) {
      assert.ok(slugs.has(ins.list as string), `unknown list ${ins.list} in ${ev.id}`);
      const sum = ins.summary as Rec;
      assert.ok((sum.lv as string).length > 0 && (sum.en as string).length > 0, `summary in ${ev.id}/${ins.list}`);
      assert.ok(editorial(sum.lv as string) && editorial(sum.en as string), `em dash in ${ev.id}/${ins.list}`);
      if (ins.source_url) assert.match(ins.source_url as string, /^https:\/\//);
    }
  }
});

test("a list never appears twice in one event", () => {
  for (const ev of events) {
    const seen = new Set<string>();
    for (const ins of (ev.insights ?? []) as Rec[]) {
      assert.ok(!seen.has(ins.list as string), `${ins.list} twice in ${ev.id}`);
      seen.add(ins.list as string);
    }
  }
});

test("file is well-formed even if events were empty", () => {
  assert.ok(Array.isArray(events));
  assert.equal(debates.version, 1);
});
