// Parsers for dati.cvk.lv/SV2026 pages. Pure functions: HTML string in, data out.
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { foldText } from "./names.ts";

export type CvkListSummary = { no: number; slug: string; name: string; candidates_count: number };
export type CvkConstituency = { slug: string; name: string };
export type CvkIndex = { lists: CvkListSummary[]; constituencies: CvkConstituency[] };

export type CvkTableRow = {
  id: number;
  slug: string;
  path: string;
  name: string;
  list_name: string;
  list_slug: string;
  constituency_slug: string;
  constituency: string;
  position: number;
  birth_year: number | null;
  workplace_raw: string;
};

export type CvkListCandidate = Omit<CvkTableRow, "list_name" | "list_slug">;

export type StatRow = { label: string; count: number; percent: number | null };

export type CvkListPage = {
  no: number | null;
  name: string | null;
  programme: { text: string; paragraphs: string[]; sections: { title: string | null; paragraphs: string[] }[] };
  stats: {
    candidates_count: number | null;
    gender: StatRow[];
    education: StatRow[];
    foreign_citizenship: StatRow[];
    ethnicity: StatRow[];
    other: Record<string, StatRow[]>;
  };
  candidates: CvkListCandidate[];
};

export type CvkCandidatePage = {
  name: string;
  list_no: number | null;
  list_name: string | null;
  list_slug: string | null;
  constituency_slug: string | null;
  birth_year: number | null;
  gender: string | null;
  foreign_citizenship: string | null;
  residence: string | null;
  ethnicity: string | null;
  education_level: string | null;
  marital_status: string | null;
  education: { institution: string; year: number | null; degree: string }[];
  positions: { workplace: string; role: string }[];
  kgb_no_collaboration: boolean | null;
  updated_at: string | null;
};

const clean = (s: string): string => s.replace(/\s+/g, " ").trim();
const toInt = (s: string): number | null => {
  const m = clean(s).match(/\d+/);
  return m ? Number(m[0]) : null;
};

function segments(href: string | undefined): string[] {
  return (href ?? "").split("/").filter((s) => s && s !== "..");
}

/** Text of an element where <br> becomes a newline; blank lines dropped. */
function textWithBreaks($: CheerioAPI, el: unknown): string {
  const html = $(el as never).html() ?? "";
  const frag = cheerio.load(`<div>${html.replace(/<br\s*\/?>/gi, "\n")}</div>`);
  return frag("div")
    .text()
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .join("\n");
}

function idAndSlug(href: string | undefined): { id: number; slug: string; path: string } | null {
  const last = segments(href).pop();
  const m = last?.match(/^(\d+)-(.+)$/);
  return m ? { id: Number(m[1]), slug: m[2], path: last as string } : null;
}

/** /SV2026/kandidatu-saraksti/ - the 14 lists and 5 constituencies. */
export function parseIndex(html: string): CvkIndex {
  const $ = cheerio.load(html);
  const lists: CvkListSummary[] = [];
  let table = $("#uxCandidateListTable");
  if (table.length === 0) {
    table = $("table").filter((_, t) => /Kandidātu saraksti/.test($(t).find("th").text()));
  }
  table.find("tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;
    const a = $(tds[1]).find("a");
    const slug = segments(a.attr("href")).pop() ?? "";
    lists.push({
      no: toInt($(tds[0]).text()) ?? lists.length + 1,
      slug,
      name: clean(a.text()),
      candidates_count: toInt($(tds[2]).text()) ?? 0,
    });
  });
  const constituencies: CvkConstituency[] = [];
  $(".locations a").each((_, a) => {
    const slug = segments($(a).attr("href")).pop();
    if (slug) constituencies.push({ slug, name: clean($(a).text()) });
  });
  return { lists, constituencies };
}

/** /SV2026/kandidati/ - every candidate, one row each. */
export function parseAllCandidatesTable(html: string): CvkTableRow[] {
  const $ = cheerio.load(html);
  const rows: CvkTableRow[] = [];
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 6) return;
    const who = idAndSlug($(tds[0]).find("a").attr("href"));
    if (!who) return;
    const listSegs = segments($(tds[1]).find("a").attr("href"));
    rows.push({
      ...who,
      name: clean($(tds[0]).text()),
      list_name: clean($(tds[1]).text()),
      list_slug: listSegs[listSegs.length - 1] ?? "",
      constituency_slug: listSegs[listSegs.length - 2] ?? "",
      constituency: clean($(tds[2]).text()),
      position: toInt($(tds[3]).text()) ?? 0,
      birth_year: toInt($(tds[4]).text()),
      // The CVK cell is the first declared workplace; a rare literal newline is
      // a line wrap inside one entry, so it collapses to a space.
      workplace_raw: clean(textWithBreaks($, tds[5]).replace(/\n/g, " ")),
    });
  });
  return rows;
}

const STAT_KEYS: Record<string, keyof CvkListPage["stats"]> = {
  dzimums: "gender",
  izglitiba: "education",
  "arvalstu pilsonibas valsts": "foreign_citizenship",
  tautiba: "ethnicity",
};

function parseStatTable($: CheerioAPI, table: unknown): StatRow[] {
  const rows: StatRow[] = [];
  $(table as never)
    .find("tbody tr")
    .each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const pct = clean($(tds[2]).text()).replace("%", "").replace(",", ".");
      rows.push({
        label: clean($(tds[0]).text()),
        count: toInt($(tds[1]).text()) ?? 0,
        percent: pct ? Number(pct) : null,
      });
    });
  return rows;
}

function isHeading(p: string): boolean {
  if (p.length > 90 || /[.!?:;]$/.test(p)) return false;
  const letters = p.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 4 && letters === letters.toUpperCase()) return true;
  return /^\d+[.)]\s+\S/.test(p) && p.split(" ").length <= 8;
}

/** /SV2026/kandidatu-saraksti/<slug> - programme, statistics, candidates. */
export function parseListPage(html: string): CvkListPage {
  const $ = cheerio.load(html);

  let no: number | null = null;
  let name: string | null = null;
  $("main h1, main h2, main h3, main h4, main h5, main h6").each((_, h) => {
    if (name) return;
    const m = clean($(h).text()).match(/^(\d+)\.\s*(.+)$/);
    if (m) {
      no = Number(m[1]);
      name = m[2];
    }
  });

  // Programmes are free text with <br/> only. A run of two or more <br/> is a
  // paragraph break; lists that use single <br/> throughout get one paragraph
  // per line instead. Single breaks inside a paragraph survive as "\n".
  const progHtml = $("#prog-tab-pane .text-lg").first().html() ?? "";
  const byDouble = progHtml.split(/(?:<br\s*\/?>\s*){2,}/i);
  const chunks = byDouble.length >= 3 ? byDouble : progHtml.split(/<br\s*\/?>/i);
  const paragraphs = chunks
    .map((chunk) =>
      cheerio
        .load(`<div>${chunk.replace(/<br\s*\/?>/gi, "\n")}</div>`)("div")
        .text()
        .split("\n")
        .map(clean)
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);
  const sections: CvkListPage["programme"]["sections"] = [];
  for (const p of paragraphs) {
    if (isHeading(p)) sections.push({ title: p, paragraphs: [] });
    else if (sections.length === 0) sections.push({ title: null, paragraphs: [p] });
    else sections[sections.length - 1].paragraphs.push(p);
  }

  const stats: CvkListPage["stats"] = {
    candidates_count: null,
    gender: [],
    education: [],
    foreign_citizenship: [],
    ethnicity: [],
    other: {},
  };
  const countText = $("#statistics-tab-pane blockquote").text();
  stats.candidates_count = toInt(countText);
  $("#statistics-tab-pane table").each((_, table) => {
    const head = foldText(clean($(table).find("th").first().text()));
    const key = STAT_KEYS[head];
    const rows = parseStatTable($, table);
    if (key && key !== "other" && key !== "candidates_count") stats[key] = rows;
    else stats.other[$(table).attr("id") ?? head] = rows;
  });

  const candidates: CvkListCandidate[] = [];
  $("#can-tab-pane table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 5) return;
    const who = idAndSlug($(tds[0]).find("a").attr("href"));
    if (!who) return;
    candidates.push({
      ...who,
      name: clean($(tds[0]).text()),
      constituency_slug: segments($(tds[1]).find("a").attr("href")).pop() ?? "",
      constituency: clean($(tds[1]).text()),
      position: toInt($(tds[2]).text()) ?? 0,
      birth_year: toInt($(tds[3]).text()),
      workplace_raw: clean(textWithBreaks($, tds[4]).replace(/\n/g, " ")),
    });
  });

  return {
    no,
    name,
    programme: { text: paragraphs.join("\n\n"), paragraphs, sections },
    stats,
    candidates,
  };
}

const FACT_KEYS: Record<string, keyof CvkCandidatePage> = {
  "dzimsanas gads": "birth_year",
  dzimums: "gender",
  "arvalsts pilsoniba": "foreign_citizenship",
  dzivesvieta: "residence",
  tautiba: "ethnicity",
  "augstaka ieguta izglitibas pakape": "education_level",
  "gimenes stavoklis": "marital_status",
};

/** /SV2026/kandidati/<id>-<slug> - the candidate's own declaration. */
export function parseCandidatePage(html: string): CvkCandidatePage {
  const $ = cheerio.load(html);
  const out: CvkCandidatePage = {
    name: clean($("main h2").first().text()),
    list_no: null,
    list_name: null,
    list_slug: null,
    constituency_slug: null,
    birth_year: null,
    gender: null,
    foreign_citizenship: null,
    residence: null,
    ethnicity: null,
    education_level: null,
    marital_status: null,
    education: [],
    positions: [],
    kgb_no_collaboration: null,
    updated_at: null,
  };

  const listLink = $("main h6 a").first();
  const lm = clean(listLink.text()).match(/^(\d+)\.\s*(.+)$/);
  if (lm) {
    out.list_no = Number(lm[1]);
    out.list_name = lm[2];
  }
  const segs = segments(listLink.attr("href"));
  out.list_slug = segs[segs.length - 1] ?? null;
  out.constituency_slug = segs[segs.length - 2] ?? null;

  $("main blockquote p").each((_, p) => {
    const label = foldText(clean($(p).find("strong").text()).replace(/:$/, ""));
    const key = FACT_KEYS[label];
    if (!key) return;
    const value = clean($(p).find("em").text());
    if (key === "birth_year") out.birth_year = toInt(value);
    else (out as Record<string, unknown>)[key] = value && value !== "-" ? value : null;
  });

  $("#uxEducationTable tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;
    out.education.push({
      institution: clean($(tds[0]).text()),
      year: toInt($(tds[1]).text()),
      degree: clean($(tds[2]).text()),
    });
  });

  $("#uxEmploymentTable tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    out.positions.push({ workplace: clean($(tds[0]).text()), role: clean($(tds[1]).text()) });
  });

  $("main blockquote").each((_, bq) => {
    const text = clean($(bq).text());
    if (!/kandid[aā]ts ir nor[aā]d[iī]jis/i.test(text)) return;
    if (/\bnav sadarboj/i.test(text)) out.kgb_no_collaboration = true;
    else if (/\bir sadarboj/i.test(text)) out.kgb_no_collaboration = false;
  });

  const um = $("main").text().match(/atjaunin[aā]jums veikts:\s*(\d{2})\.(\d{2})\.(\d{4})\.?\s*plkst\.?\s*(\d{1,2}):(\d{2})/);
  if (um) out.updated_at = `${um[3]}-${um[2]}-${um[1]}T${um[4].padStart(2, "0")}:${um[5]}`;

  return out;
}
