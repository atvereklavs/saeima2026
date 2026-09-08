import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isoDate, parseDeputiesView, parseDeputyPage } from "../pipeline/lib/saeima-parsers.ts";
import { csvObjects, parseCsv } from "../pipeline/lib/csv.ts";

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("parseDeputiesView reads drawDep records with unid and faction", () => {
  const refs = parseDeputiesView(fixture("titania-view.html"));
  assert.ok(refs.length >= 100, `expected ~100 deputies, got ${refs.length}`);
  const inga = refs.find((r) => r.sname === "Bērziņa" && r.name === "Inga");
  assert.ok(inga);
  assert.equal(inga!.shortStr, "JV");
  assert.equal(inga!.unid, "33EEA91F4258FD2FC22588E0002AE037");
  assert.ok(refs.some((r) => r.lst.includes("nepiederošie")), "independent deputies keep their group label");
});

test("parseDeputyPage reads mandate, faction and committee records with dates", () => {
  const recs = parseDeputyPage(fixture("titania-deputy.html"));
  const mandate = recs.find((r) => r.kind === "mandate");
  assert.ok(mandate);
  assert.equal(mandate!.from, "2022-11-01");
  assert.equal(mandate!.to, "2023-09-20");
  assert.ok(recs.some((r) => r.kind === "faction" && r.str.includes("JAUNĀ VIENOTĪBA")));
  const committees = recs.filter((r) => r.kind === "committee");
  assert.ok(committees.length >= 2);
  assert.ok(committees.some((c) => c.str === "Publisko izdevumu un revīzijas komisija"));
  assert.ok(recs.some((r) => r.kind === "subcommittee"));
  assert.ok(recs.some((r) => r.kind === "delegation"));
});

test("isoDate converts dd.mm.yyyy", () => {
  assert.equal(isoDate("23.11.2022"), "2022-11-23");
  assert.equal(isoDate(""), null);
  assert.equal(isoDate(undefined), null);
});

test("csv parser handles quotes, embedded commas and BOM", () => {
  const rows = parseCsv('﻿a,b,c\n1,"x, y","q""z"\n');
  assert.deepEqual(rows, [["a", "b", "c"], ["1", "x, y", 'q"z']]);
  const d14 = csvObjects(fixture("delna-groups14-head.csv"));
  assert.equal(d14.length, 5);
  assert.equal(d14[0]["Deputāts/e"], "Agita Zariņa-Stūre");
  assert.equal(d14[0]["Dzimšanas gads"], "1971");
  const d13 = csvObjects(fixture("delna-groups13-head.csv"));
  assert.equal(d13[0]["Deputāts/e"], "Adamovičs, Aldis");
  assert.ok(d13[0]["Darbība 13.Saeimā"].includes("saeima13_depweb_public.nsf"));
});
