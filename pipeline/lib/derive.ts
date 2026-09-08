// Derived fields: experience tier, age. Rules live in ../rules/*.json.
import { readFileSync } from "node:fs";
import { foldText } from "./names.ts";

export const ELECTION_YEAR = 2026;

export type TierRule = { any: string[]; none?: string[] };
export type TierRules = {
  order: string[];
  labels: Record<string, { lv: string; en: string }>;
  rules: Record<string, TierRule>;
};

type Compiled = { name: string; any: RegExp[]; none: RegExp[] }[];

export function loadTierRules(): TierRules {
  return JSON.parse(readFileSync(new URL("../rules/tiers.json", import.meta.url), "utf8")) as TierRules;
}

const compiledCache = new WeakMap<TierRules, Compiled>();

function compile(rules: TierRules): Compiled {
  let c = compiledCache.get(rules);
  if (!c) {
    c = Object.entries(rules.rules).map(([name, r]) => ({
      name,
      any: r.any.map((p) => new RegExp(p, "i")),
      none: (r.none ?? []).map((p) => new RegExp(p, "i")),
    }));
    compiledCache.set(rules, c);
  }
  return c;
}

/**
 * Apply tier rules to position lines ("Workplace, Role"). A rule fires when one
 * line satisfies `any` and none of `none`. The tier is the highest-precedence
 * rule that fired; `flags` keeps every rule that fired.
 */
export function deriveTier(lines: string[], rules: TierRules): { tier: string; flags: string[] } {
  const flags = new Set<string>();
  for (const line of lines) {
    const t = foldText(line);
    for (const rule of compile(rules)) {
      if (rule.any.some((re) => re.test(t)) && !rule.none.some((re) => re.test(t))) flags.add(rule.name);
    }
  }
  const tier = rules.order.find((n) => flags.has(n)) ?? "newcomer";
  return { tier, flags: [...flags] };
}

export function ageOf(birthYear: number | null): number | null {
  return birthYear ? ELECTION_YEAR - birthYear : null;
}

export function ageBand(age: number | null): string | null {
  if (age === null) return null;
  if (age < 30) return "<30";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  if (age < 60) return "50-59";
  return "60+";
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}
