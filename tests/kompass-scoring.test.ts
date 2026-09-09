import { test } from "node:test";
import assert from "node:assert/strict";
import { agreement, rank, scoreList, type Answer } from "../src/lib/kompass.ts";

const A = (value: -2 | 0 | 2, important = false): Answer => ({ value, important });

test("agreement spans identical to opposite", () => {
  assert.equal(agreement(2, 2), 1);
  assert.equal(agreement(2, -2), 0);
  assert.equal(agreement(2, -1), 0.25);
  assert.equal(agreement(0, 1), 0.75);
});

test("worked example from the design", () => {
  // Four answered statements exercise the math; with fewer than five answers
  // the result stays unranked, so the score only appears once a fifth is added.
  const answers = { s1: A(2), s2: A(2, true), s3: A(-2), s4: A(0) };
  const r = scoreList(answers, { s1: 2, s2: -1, s3: null, s4: 1 }, "x");
  assert.equal(r.matchRaw, 56.25);
  assert.equal(r.coverage, 0.8);
  assert.equal(r.coveredAxes, 3);
  assert.equal(r.answeredAxes, 4);
  assert.equal(r.unranked, true);
  const withFifth = scoreList({ ...answers, s5: A(0) }, { s1: 2, s2: -1, s3: null, s4: 1, s5: 0 }, "x");
  assert.equal(withFifth.unranked, false);
  assert.equal(withFifth.score, Math.round(withFifth.matchRaw * (0.5 + 0.5 * withFifth.coverage)));
});

test("a silent programme is unranked, not a winner by default", () => {
  const answers = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`s${i}`, A(2)]));
  const allNull = scoreList(answers, {}, "silent");
  assert.equal(allNull.unranked, true);
  assert.equal(allNull.score, null);
});

test("coverage exactly at the boundary ranks; just below does not", () => {
  const answers = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`s${i}`, A(2)]));
  const half = scoreList(answers, { s0: 2, s1: 2, s2: 2 }, "half");
  assert.equal(half.coverage, 0.5);
  assert.equal(half.unranked, false);
  const below = scoreList(answers, { s0: 2, s1: 2 }, "below");
  assert.equal(below.unranked, true);
});

test("fewer than five answered statements gives no ranking", () => {
  const answers = { s1: A(2), s2: A(2), s3: A(2), s4: A(2) };
  const r = scoreList(answers, { s1: 2, s2: 2, s3: 2, s4: 2 }, "x");
  assert.equal(r.unranked, true);
});

test("importance doubles an axis' pull", () => {
  const base = { s1: A(2), s2: A(2), s3: A(2), s4: A(2), s5: A(2) };
  const plain = scoreList(base, { s1: -2, s2: 2, s3: 2, s4: 2, s5: 2 }, "x");
  const weighted = scoreList({ ...base, s1: A(2, true) }, { s1: -2, s2: 2, s3: 2, s4: 2, s5: 2 }, "x");
  assert.ok(weighted.matchRaw < plain.matchRaw);
});

test("neutral answers count toward coverage, skipped statements do not exist", () => {
  const answers = { s1: A(0), s2: A(0), s3: A(0), s4: A(0), s5: A(0) };
  const r = scoreList(answers, { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 }, "x");
  assert.equal(r.score, 100);
});

test("rank orders by score, breaks ties by coverage then list number", () => {
  const answers = { s1: A(2), s2: A(2), s3: A(2), s4: A(2), s5: A(2), s6: A(2) };
  const full = { s1: 2, s2: 2, s3: 2, s4: 2, s5: 2, s6: 2 };
  const partial = { s1: 2, s2: 2, s3: 2, s4: 2, s5: 2, s6: null };
  const out = rank(answers, [
    { slug: "b", no: 2, stances: full },
    { slug: "a", no: 1, stances: full },
    { slug: "c", no: 3, stances: partial },
    { slug: "silent", no: 4, stances: {} },
  ]);
  assert.deepEqual(out.map((r) => r.slug), ["a", "b", "c", "silent"]);
  assert.equal(out[3].unranked, true);
});
