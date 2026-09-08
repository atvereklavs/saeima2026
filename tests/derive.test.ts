import { test } from "node:test";
import assert from "node:assert/strict";
import { ageBand, ageOf, deriveTier, loadTierRules, median } from "../pipeline/lib/derive.ts";

const rules = loadTierRules();
const pos = (workplace: string, role = ""): { workplace: string; role: string } => ({ workplace, role });
const tier = (...positions: { workplace: string; role: string }[]): string => deriveTier(positions, rules).tier;

test("ministers are recognised from the role, whatever the workplace says", () => {
  assert.equal(tier(pos("Valsts kanceleja", "LR Ārlietu ministre")), "minister");
  assert.equal(tier(pos("Zemkopības ministrija", "Ministrs")), "minister");
  assert.equal(tier(pos("Latvijas Republikas Iekšlietu ministrija", "Iekšlietu ministrs")), "minister");
  assert.equal(tier(pos("Latvijas Republikas Ministru kabinets", "Ministru prezidents")), "minister");
  assert.equal(tier(pos("Ministru kabinets", "Klimata un enerģētikas ministrs")), "minister");
});

test("minister staff are public administration, not ministers", () => {
  assert.equal(tier(pos("Valsts kanceleja", "Ministru prezidenta padomnieks")), "civil_service");
  assert.equal(tier(pos("Ārlietu ministrija", "Parlamentārais sekretārs")), "civil_service");
  assert.equal(tier(pos("Satiksmes ministrija", "Ministra ārštata padomnieks")), "civil_service");
  assert.equal(tier(pos("Ekonomikas ministrija", "Ministra palīgs")), "civil_service");
  assert.equal(tier(pos("Aizsardzības ministrija", "vecākā eksperte")), "civil_service");
});

test("sitting MPs, the Speaker, and precedence over municipal", () => {
  assert.equal(tier(pos("Latvijas Republikas Saeima", "Deputāts")), "sitting_mp");
  assert.equal(tier(pos("LR Saeima", "14.Saeimas deputāte")), "sitting_mp");
  assert.equal(tier(pos("Latvijas Republikas Saeima", "Saeimas priekšsēdētāja")), "sitting_mp");
  assert.equal(tier(pos("Latvijas Republikas Saeima", "Deputāts"), pos("Rīgas dome", "deputāts")), "sitting_mp");
});

test("Saeima staff are not MPs", () => {
  assert.equal(tier(pos("Latvijas Republikas Saeima", "Deputāta palīgs")), "newcomer");
  assert.equal(tier(pos("Latvijas Republikas Saeima", "Frakcijas JAUNĀ VIENOTĪBA vecākais konsultants")), "newcomer");
  assert.equal(tier(pos("Latvijas Republikas Saeima", "Saeimas priekšsēdētāja biroja vadītājs")), "newcomer");
  assert.equal(tier(pos("Latvijas Republikas Saeima", "Vadošais tulks")), "newcomer");
});

test("municipal councillors and leaders versus municipal employees", () => {
  assert.equal(tier(pos("Rīgas valstspilsētas pašvaldība", "Rīgas domes deputāte")), "municipal");
  assert.equal(tier(pos("Limbažu novada dome", "domes priekšsēdētājs")), "municipal");
  assert.equal(tier(pos("Saldus novada pašvaldība", "projektu vadītāja")), "newcomer");
  assert.equal(tier(pos("Talsu novada pašvaldība", "Izpilddirektora vietnieks administratīvajos un finanšu jautājumos")), "civil_service");
  assert.equal(tier(pos("Jelgavas novada pašvaldība", "Juridiskā departamenta vadītājs")), "civil_service");
});

test("former MP phrasing in the declaration", () => {
  assert.equal(tier(pos("Bijušais Saeimas deputāts")), "former_mp");
});

test("flags keep every rule that fired", () => {
  const r = deriveTier([pos("Latvijas Republikas Saeima", "Deputāte"), pos("Ekonomikas ministrija", "valsts sekretāra vietniece")], rules);
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
