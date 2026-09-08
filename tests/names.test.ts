import { test } from "node:test";
import assert from "node:assert/strict";
import { flipSurnameFirst, foldText, nameKey, stripDiacritics, tokenKey } from "../pipeline/lib/names.ts";

test("stripDiacritics handles Latvian letters", () => {
  assert.equal(stripDiacritics("Zanda Kalniņa-Lukaševica"), "Zanda Kalnina-Lukasevica");
  assert.equal(stripDiacritics("Ģirts Ļaudis Žīgurs Čakša"), "Girts Laudis Zigurs Caksa");
});

test("nameKey is lowercase, diacritic-free and hyphen-insensitive", () => {
  assert.equal(nameKey("Zanda  Kalniņa-Lukaševica "), "zanda kalnina lukasevica");
  assert.equal(nameKey("Dāvis Mārtiņš Daugavietis"), "davis martins daugavietis");
});

test("tokenKey ignores word order", () => {
  assert.equal(tokenKey("Aldis Adamovičs"), tokenKey("Adamovičs Aldis"));
});

test("flipSurnameFirst turns Delna's 'Surname, Name' into 'Name Surname'", () => {
  assert.equal(flipSurnameFirst("Adamovičs, Aldis"), "Aldis Adamovičs");
  assert.equal(flipSurnameFirst("Kalniņa-Lukaševica, Zanda"), "Zanda Kalniņa-Lukaševica");
  assert.equal(flipSurnameFirst("Agnese Krasta"), "Agnese Krasta");
});

test("foldText for accent-insensitive search", () => {
  assert.ok(foldText("Ozoliņš").includes("ozol"));
});
