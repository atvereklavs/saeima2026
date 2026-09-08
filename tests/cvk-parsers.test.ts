import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAllCandidatesTable, parseCandidatePage, parseIndex, parseListPage } from "../pipeline/lib/cvk-parsers.ts";

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("parseIndex: 14 lists with numbers, slugs, counts and 5 constituencies", () => {
  const { lists, constituencies } = parseIndex(fixture("cvk-index.html"));
  assert.equal(lists.length, 14);
  assert.deepEqual(lists[0], {
    no: 1,
    slug: "suverena-vara--apvieniba-jaunlatviesi",
    name: "SUVERĒNĀ VARA / APVIENĪBA JAUNLATVIEŠI",
    candidates_count: 124,
  });
  assert.equal(lists[8].slug, "jauna-vienotiba");
  assert.equal(lists[8].candidates_count, 125);
  assert.equal(lists.reduce((n, l) => n + l.candidates_count, 0), 1428);
  assert.deepEqual(
    constituencies.map((c) => c.slug),
    ["riga", "vidzeme", "latgale", "kurzeme", "zemgale"],
  );
  assert.equal(constituencies[0].name, "Rīga");
});

test("parseAllCandidatesTable: rows carry id, slug, list, constituency, position, year, workplace", () => {
  const rows = parseAllCandidatesTable(fixture("cvk-table-10rows.html"));
  assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], {
    id: 78870,
    slug: "loreta-abakoka",
    path: "78870-loreta-abakoka",
    name: "Loreta Abakoka",
    list_name: "Jaunā VIENOTĪBA",
    list_slug: "jauna-vienotiba",
    constituency_slug: "zemgale",
    constituency: "Zemgale",
    position: 18,
    birth_year: 2002,
    workplace_raw: "Latvijas Republikas Saeima, Deputāta palīgs",
  });
  const hyphenated = rows.find((r) => r.name.includes("-"));
  assert.ok(hyphenated, "fixture includes a hyphenated name");
  const wrapped = rows.find((r) => r.id === 80020);
  assert.ok(wrapped, "fixture includes the one cell with a literal line wrap");
  assert.equal(wrapped!.workplace_raw, "Dienvidkurzemes novada pašvaldība, Ugunsdzēsības dienesta vadītājs");
});

test("parseListPage: programme, statistics and 125 candidates for Jaunā VIENOTĪBA", () => {
  const page = parseListPage(fixture("cvk-list.html"));
  assert.equal(page.no, 9);
  assert.equal(page.name, "Jaunā VIENOTĪBA");
  assert.equal(page.candidates.length, 125);
  assert.equal(page.candidates[0].name, "Baiba Braže");
  assert.equal(page.candidates[0].constituency_slug, "riga");
  assert.equal(page.candidates[0].position, 1);
  assert.equal(page.candidates[0].workplace_raw, "Valsts kanceleja, LR Ārlietu ministre");
  assert.ok(page.programme.paragraphs.length >= 5);
  assert.equal(page.programme.paragraphs[0], "STIPRA LATVIJA DROŠĀ EIROPĀ");
  assert.equal(page.programme.sections[0].title, "STIPRA LATVIJA DROŠĀ EIROPĀ");
  assert.ok(page.programme.sections.some((s) => s.title === "APSOLĪJUMI"));
  assert.ok(page.programme.sections.some((s) => /^1\.\s/.test(s.title ?? "")));
  assert.equal(page.stats.candidates_count, 125);
  assert.deepEqual(page.stats.gender, [
    { label: "Sieviete", count: 50, percent: 40 },
    { label: "Vīrietis", count: 75, percent: 60 },
  ]);
  assert.equal(page.stats.education[0].label, "Augstākā");
  assert.equal(page.stats.education[0].count, 118);
  assert.ok(page.stats.foreign_citizenship.length >= 1);
  assert.ok(page.stats.ethnicity.length >= 1);
});

test("parseCandidatePage: facts, education, positions, KGB statement, update stamp", () => {
  const c = parseCandidatePage(fixture("cvk-candidate.html"));
  assert.equal(c.name, "Loreta Abakoka");
  assert.equal(c.list_no, 9);
  assert.equal(c.list_name, "Jaunā VIENOTĪBA");
  assert.equal(c.list_slug, "jauna-vienotiba");
  assert.equal(c.constituency_slug, "zemgale");
  assert.equal(c.birth_year, 2002);
  assert.equal(c.gender, "Sieviete");
  assert.equal(c.foreign_citizenship, null);
  assert.equal(c.residence, "Rīga");
  assert.equal(c.ethnicity, "Latvietis / latviete");
  assert.equal(c.education_level, "Augstākā");
  assert.equal(c.marital_status, "Nav norādīts");
  assert.deepEqual(c.education, [
    { institution: "Rīgas Stradiņa universitāte", year: 2024, degree: "Sociālo zinātņu bakalaura grāds politoloģijā" },
  ]);
  assert.equal(c.positions.length, 3);
  assert.deepEqual(c.positions[0], { workplace: "Latvijas Republikas Saeima", role: "Deputāta palīgs" });
  assert.equal(c.kgb_no_collaboration, true);
  assert.equal(c.updated_at, "2026-08-27T14:37");
});
