import { test } from "node:test";
import assert from "node:assert/strict";
import { ageBand, ageOf, deriveTier, loadTierRules, median } from "../pipeline/lib/derive.ts";

const rules = loadTierRules();
const tier = (...lines: string[]): string => deriveTier(lines, rules).tier;

test("tier precedence: minister above sitting MP above municipal", () => {
  assert.equal(tier("Valsts kanceleja, LR Ārlietu ministre"), "minister");
  assert.equal(tier("Ministru kabinets, Ministru prezidents"), "minister");
  assert.equal(tier("Latvijas Republikas Saeima, Deputāts"), "sitting_mp");
  assert.equal(tier("LR Saeima, 14.Saeimas deputāte"), "sitting_mp");
  assert.equal(tier("Latvijas Republikas Saeima, Deputāts", "Rīgas dome, deputāts"), "sitting_mp");
  assert.equal(tier("Rīgas valstspilsētas pašvaldība, Rīgas domes deputāte"), "municipal");
  assert.equal(tier("Limbažu novada dome, domes priekšsēdētājs"), "municipal");
});

test("staff roles do not count as MPs or ministers", () => {
  assert.equal(tier("Latvijas Republikas Saeima, Deputāta palīgs"), "newcomer");
  assert.equal(tier("Saeimas frakcija, konsultants"), "newcomer");
  assert.equal(tier("Ārlietu ministrija, Parlamentārais sekretārs"), "civil_service");
  assert.equal(tier("Satiksmes ministrija, Ministra ārštata padomnieks"), "civil_service");
});

test("former MP phrasing in workplace text", () => {
  assert.equal(tier("Bijušais Saeimas deputāts"), "former_mp");
});

test("flags keep every rule that fired", () => {
  const r = deriveTier(["Latvijas Republikas Saeima, Deputāte", "Ekonomikas ministrija, valsts sekretāra vietniece"], rules);
  assert.equal(r.tier, "sitting_mp");
  assert.ok(r.flags.includes("civil_service"));
});

test("age helpers", () => {
  assert.equal(ageOf(2002), 24);
  assert.equal(ageOf(null), null);
  assert.equal(ageBand(24), "<30");
  assert.equal(ageBand(45), "40-49");
  assert.equal(ageBand(60), "60+");
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});
