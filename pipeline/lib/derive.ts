// Derived fields: experience tier, age. Rules live in ../rules/*.json.
import { readFileSync } from "node:fs";
import { foldText } from "./names.ts";
import type { Position } from "./types.ts";

export const ELECTION_YEAR = 2026;

export type Block = { any: string[]; none?: string[] };
export type TierRule = { line?: Block; role?: Block };
export type TierRules = {
  order: string[];
  labels: Record<string, { lv: string; en: string }>;
  rules: Record<string, TierRule>;
};

type CompiledBlock = { any: RegExp[]; none: RegExp[] };
type Compiled = { name: string; line: CompiledBlock | null; role: CompiledBlock | null }[];

export function loadTierRules(): TierRules {
  return JSON.parse(readFileSync(new URL("../rules/tiers.json", import.meta.url), "utf8")) as TierRules;
}

const compiledCache = new WeakMap<TierRules, Compiled>();

function compileBlock(b: Block | undefined): CompiledBlock | null {
  return b ? { any: b.any.map((p) => new RegExp(p, "i")), none: (b.none ?? []).map((p) => new RegExp(p, "i")) } : null;
}

function compile(rules: TierRules): Compiled {
  let c = compiledCache.get(rules);
  if (!c) {
    c = Object.entries(rules.rules).map(([name, r]) => ({ name, line: compileBlock(r.line), role: compileBlock(r.role) }));
    compiledCache.set(rules, c);
  }
  return c;
}

const passes = (b: CompiledBlock | null, text: string): boolean =>
  b !== null && text.length > 0 && b.any.some((re) => re.test(text)) && !b.none.some((re) => re.test(text));

/**
 * Apply tier rules to declared positions. A rule fires when one position
 * passes the rule's `line` block (on "workplace, role") or its `role` block
 * (on the role alone). The tier is the highest-precedence rule that fired;
 * `flags` keeps every rule that fired.
 */
export function deriveTier(positions: Position[], rules: TierRules): { tier: string; flags: string[] } {
  const flags = new Set<string>();
  for (const p of positions) {
    const role = foldText(p.role ?? "");
    const line = foldText(p.role ? `${p.workplace}, ${p.role}` : p.workplace);
    for (const rule of compile(rules)) {
      if (passes(rule.line, line) || passes(rule.role, role)) flags.add(rule.name);
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
