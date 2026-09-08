import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveTags, loadTagRules } from "../pipeline/lib/tags.ts";
import type { Committee } from "../pipeline/lib/types.ts";

const rules = loadTagRules();
const edu = (degree: string, institution = "X"): { institution: string; year: number | null; degree: string } => ({ institution, year: null, degree });
const pos = (workplace: string, role = ""): { workplace: string; role: string } => ({ workplace, role });
const com = (name: string): Committee => ({ name, kind: "committee", from: null, to: null, term: 14, source: "saeima" });
const tags = (...args: Parameters<typeof deriveTags> extends [infer A, infer B, infer C, ...unknown[]] ? [A, B, C] : never): string[] =>
  deriveTags(args[0], args[1], args[2], rules).map((t) => t.tag);

test("a degree tags its subject, not its university", () => {
  assert.deepEqual(tags([edu("Sociālo zinātņu bakalaura grāds politoloģijā", "Rīgas Stradiņa universitāte")], [], []), []);
  assert.ok(tags([edu("skolvadības maģistrs", "Rīgas Pedagoģijas augstskola")], [], []).includes("education-science"));
});

test("law from degree and from committee", () => {
  assert.ok(tags([edu("Profesionālā maģistra grāds tiesību zinātnē, jurists", "Latvijas Universitāte")], [], []).includes("law"));
  assert.ok(tags([], [], [com("Juridiskā komisija")]).includes("law"));
});

test("board member of a company is business, of a party is not", () => {
  assert.ok(tags([], [pos('SIA "Lielupes laivas"', "Valdes loceklis")], []).includes("business"));
  assert.ok(!tags([], [pos('Politiskā partija "Vienotība"', "Valdes loceklis")], []).includes("business"));
  assert.ok(!tags([], [pos("Vienotības jaunatnes organizācija", "valdes locekle")], []).includes("business"));
});

test("teacher and school lead to education, doctor to health", () => {
  assert.ok(tags([], [pos("Valmieras Pārgaujas Valsts ģimnāzija", "direktore, skolotāja")], []).includes("education-science"));
  assert.ok(tags([], [pos('SIA "Veselības centrs"', "Ārsts")], []).includes("health"));
});

test("pārstāvis does not accidentally become a doctor", () => {
  assert.ok(!tags([], [pos("Nodibinājums X", "Pārstāvis")], []).includes("health"));
});

test("NGO work is civil society; municipal administration tags municipal-governance", () => {
  assert.ok(tags([], [pos("Biedrība Centrs MARTA", "Interešu aizstāvības nodaļas vadītāja")], []).includes("civil-society"));
  assert.ok(tags([], [pos("Ludzas novada pašvaldība", "Sporta organizators")], []).includes("municipal-governance"));
});

test("committee names weigh more than a single position line", () => {
  const scored = deriveTags([], [], [com("Budžeta un finanšu (nodokļu) komisija")], rules);
  const fin = scored.find((t) => t.tag === "finance-economy");
  assert.ok(fin && fin.score === rules.weights.committee);
});

test("defence from Zemessardze, foreign affairs from ministry work", () => {
  assert.ok(tags([], [pos("Zemessardzes 2. brigāde", "virsnieks")], []).includes("defence-security"));
  assert.ok(tags([], [pos("Ārlietu ministrija", "Parlamentārais sekretārs")], []).includes("foreign-affairs"));
});

test("no tags for an empty record", () => {
  assert.deepEqual(tags([], [], []), []);
});
