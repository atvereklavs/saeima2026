// Election-compass scoring. Pure module: no imports, unit-tested directly.
//
// Answers: agree +2, neutral 0, disagree -2; a skipped statement is absent.
// A list's stance per statement is -2..+2, or null when its programme is
// silent. Silence dilutes the match through the coverage factor instead of
// counting as disagreement.

export type Answer = { value: -2 | 0 | 2; important: boolean };
export type Stance = number | null;

export type ListResult = {
  slug: string;
  /** 0-100, or null when unranked */
  score: number | null;
  matchRaw: number;
  coverage: number;
  coveredAxes: number;
  answeredAxes: number;
  unranked: boolean;
};

export const MIN_ANSWERED = 5;
export const MIN_COVERAGE = 0.5;

export function weightOf(a: Answer): number {
  return a.important ? 2 : 1;
}

/** 0..1 agreement between a user answer and a list stance. */
export function agreement(user: number, stance: number): number {
  return 1 - Math.abs(user - stance) / 4;
}

export function scoreList(
  answers: Record<string, Answer>,
  stances: Record<string, Stance>,
  slug: string,
): ListResult {
  let coveredWeight = 0;
  let answeredWeight = 0;
  let agreementSum = 0;
  let coveredAxes = 0;
  let answeredAxes = 0;
  for (const [id, a] of Object.entries(answers)) {
    const w = weightOf(a);
    answeredWeight += w;
    answeredAxes += 1;
    const v = stances[id];
    if (v === null || v === undefined) continue;
    coveredWeight += w;
    coveredAxes += 1;
    agreementSum += w * agreement(a.value, v);
  }
  const matchRaw = coveredWeight > 0 ? (agreementSum / coveredWeight) * 100 : 0;
  const coverage = answeredWeight > 0 ? coveredWeight / answeredWeight : 0;
  const unranked = answeredAxes < MIN_ANSWERED || coverage < MIN_COVERAGE;
  const score = unranked ? null : Math.round(matchRaw * (0.5 + 0.5 * coverage));
  return { slug, score, matchRaw, coverage, coveredAxes, answeredAxes, unranked };
}

/** Ranked results: scored lists first (score desc, coverage desc, no asc), then unranked. */
export function rank(
  answers: Record<string, Answer>,
  lists: { slug: string; no: number; stances: Record<string, Stance> }[],
): ListResult[] {
  const noOf = new Map(lists.map((l) => [l.slug, l.no]));
  return lists
    .map((l) => scoreList(answers, l.stances, l.slug))
    .sort((a, b) => {
      if (a.unranked !== b.unranked) return a.unranked ? 1 : -1;
      return (b.score ?? 0) - (a.score ?? 0) || b.coverage - a.coverage || (noOf.get(a.slug) ?? 99) - (noOf.get(b.slug) ?? 99);
    });
}
