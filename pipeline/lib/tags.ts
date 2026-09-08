// Strength tags from declared education, positions and committee work.
// The taxonomy lives in ../rules/tags.json so it can be tuned without code.
import { readFileSync } from "node:fs";
import { foldText } from "./names.ts";
import type { Committee, Education, Position, Tag } from "./types.ts";

export type TagRule = { lv: string; en: string; keywords: string[]; committees?: string[]; exclude?: string[] };
export type TagRules = {
  version: number;
  threshold: number;
  weights: { education: number; position: number; committee: number };
  tags: Record<string, TagRule>;
};

export function loadTagRules(): TagRules {
  return JSON.parse(readFileSync(new URL("../rules/tags.json", import.meta.url), "utf8")) as TagRules;
}

type CompiledTag = { name: string; keywords: RegExp[]; committees: RegExp[]; exclude: RegExp[] };
const compiledCache = new WeakMap<TagRules, CompiledTag[]>();

function compile(rules: TagRules): CompiledTag[] {
  let c = compiledCache.get(rules);
  if (!c) {
    c = Object.entries(rules.tags).map(([name, r]) => ({
      name,
      keywords: r.keywords.map((p) => new RegExp(p, "i")),
      committees: (r.committees ?? []).map((p) => new RegExp(p, "i")),
      exclude: (r.exclude ?? []).map((p) => new RegExp(p, "i")),
    }));
    compiledCache.set(rules, c);
  }
  return c;
}

/**
 * Score every tag over the candidate's lines. Each education entry and each
 * declared position is one line; each committee name is one line matched only
 * against the tag's `committees` patterns. A line contributes its weight once
 * per tag; `exclude` vetoes that line for that tag.
 */
export function deriveTags(
  education: Education[],
  positions: Position[],
  committees: Committee[],
  rules: TagRules,
): Tag[] {
  const lines: { text: string; weight: number; committee: boolean }[] = [
    // Education lines carry only the degree text: studying AT a university is
    // not education expertise, but a pedagogy degree is - and working at a
    // school is caught on the position line instead.
    ...education.map((e) => ({ text: foldText(e.degree), weight: rules.weights.education, committee: false })),
    ...positions.map((p) => ({ text: foldText(p.role ? `${p.workplace}, ${p.role}` : p.workplace), weight: rules.weights.position, committee: false })),
    ...committees.map((c) => ({ text: foldText(c.name), weight: rules.weights.committee, committee: true })),
  ];
  const scores = new Map<string, number>();
  for (const tag of compile(rules)) {
    for (const line of lines) {
      const patterns = line.committee ? tag.committees : tag.keywords;
      if (!patterns.some((re) => re.test(line.text))) continue;
      if (!line.committee && tag.exclude.some((re) => re.test(line.text))) continue;
      scores.set(tag.name, (scores.get(tag.name) ?? 0) + line.weight);
    }
  }
  return [...scores.entries()]
    .filter(([, score]) => score >= rules.threshold)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, score]) => ({ tag, score }));
}
