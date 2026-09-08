// Assemble a candidate's record in government from the matched sources.
import { readCached } from "./http.ts";
import { deriveTier, type TierRules } from "./derive.ts";
import { parseDeputyPage } from "./saeima-parsers.ts";
import { saeimaDeputyUrl } from "./sources.ts";
import { foldText } from "./names.ts";
import type { Committee, History, MinisterRole, Position } from "./types.ts";
import type { CandidateMatch } from "../match.ts";

const MINISTER_ROLE = /\bministr[se]\b|ministru prezident/i;

export function buildHistory(m: CandidateMatch | undefined, positions: Position[], rules: TierRules): History {
  const cvk = deriveTier(positions, rules);
  const flags = new Set(cvk.flags);
  const terms = new Set<number>();
  const committees: Committee[] = [];
  const ministerRoles: MinisterRole[] = [];
  const sources: History["sources"] = { delna_14: false, delna_13: false, titania: {}, wikidata: null };
  let sitting = false;
  let mandateStatus: string | null = null;
  let faction14: string | null = null;
  let electedFrom14: string | null = null;

  if (m?.delna14) {
    sources.delna_14 = true;
    terms.add(14);
    mandateStatus = m.delna14.mandate_status;
    faction14 = m.delna14.faction;
    electedFrom14 = m.delna14.elected_from;
    sitting = !/^bijus/i.test(foldText(mandateStatus ?? ""));
  }
  if (m?.delna13) {
    sources.delna_13 = true;
    terms.add(13);
  }
  for (const [termStr, t] of Object.entries(m?.titania ?? {})) {
    const term = Number(termStr);
    terms.add(term);
    sources.titania[termStr] = t.unid;
    if (term === 14) {
      if (!m?.delna14) sitting = true;
      faction14 ??= t.group || t.faction || null;
    }
    const html = readCached(saeimaDeputyUrl(term, t.unid));
    if (html) {
      for (const r of parseDeputyPage(html)) {
        if (r.kind !== "committee" && r.kind !== "subcommittee" && r.kind !== "delegation") continue;
        if (committees.some((c) => c.name === r.str && c.term === term && c.from === r.from)) continue;
        committees.push({ name: r.str, kind: r.kind, from: r.from, to: r.to, term, source: "saeima" });
      }
    }
  }
  if (m?.wikidata) {
    sources.wikidata = m.wikidata.qid;
    for (const t of m.wikidata.terms) terms.add(t);
    for (const r of m.wikidata.minister_roles) ministerRoles.push({ ...r, source: "wikidata" });
  }
  if (flags.has("minister")) {
    for (const p of positions) {
      if (!MINISTER_ROLE.test(foldText(p.role))) continue;
      // The declared role alone can be as terse as "Ministrs"; keep the
      // workplace so the timeline says which ministry.
      const label = foldText(p.role).includes("ministrij") || !p.workplace ? p.role : `${p.role}, ${p.workplace}`;
      if (!ministerRoles.some((r) => r.source === "cvk" && r.role === label)) {
        ministerRoles.push({ role: label, from: null, to: null, source: "cvk" });
      }
    }
  }

  const official = sources.delna_14 || sources.delna_13 || Object.keys(sources.titania).length > 0 || sources.wikidata !== null;
  if (ministerRoles.length) flags.add("minister");
  if (sitting) flags.add("sitting_mp");
  if (terms.size && !sitting) flags.add("former_mp");
  if (!sitting && !official && !terms.size) flags.delete("former_mp");

  let tier: string;
  if (ministerRoles.length) tier = "minister";
  else if (sitting || (!official && cvk.tier === "sitting_mp")) tier = "sitting_mp";
  else if (terms.size || cvk.tier === "former_mp") tier = "former_mp";
  else if (cvk.tier === "municipal" || cvk.tier === "civil_service") tier = cvk.tier;
  else tier = "newcomer";

  const municipalText = foldText(positions.map((p) => `${p.workplace}, ${p.role}`).join(" | "));
  const municipal_role: History["municipal_role"] = flags.has("municipal")
    ? /priekssedetaj|\bmer[se]\b|vicemer/.test(municipalText)
      ? "mayor"
      : "councillor"
    : null;

  committees.sort((a, b) => b.term - a.term || (b.from ?? "").localeCompare(a.from ?? ""));
  return {
    tier,
    flags: [...flags],
    provisional: !official,
    sitting_mp: sitting,
    mandate_status_14: mandateStatus,
    faction_14: faction14,
    elected_from_14: electedFrom14,
    saeima_terms: [...terms].sort((a, b) => b - a),
    terms_count: terms.size,
    committees,
    minister_roles: ministerRoles,
    municipal_role,
    sources,
  };
}
