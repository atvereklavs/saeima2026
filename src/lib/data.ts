// Typed access to the committed dataset. Imported by pages at build time only.
import listsJson from "../../data/lists.json";
import candidatesJson from "../../data/candidates.json";
import indexJson from "../../data/candidates.index.json";
import metaJson from "../../data/meta.json";
import type { Candidate, IndexRow, ListRecord, Meta } from "../../pipeline/lib/types.ts";
import { withLocale, type Locale } from "../i18n/labels.ts";

export const lists = listsJson as unknown as ListRecord[];
export const candidates = candidatesJson as unknown as Candidate[];
export const indexRows = indexJson as unknown as IndexRow[];
export const meta = metaJson as unknown as Meta;

export const listBySlug = new Map(lists.map((l) => [l.slug, l]));
export const listByNo = new Map(lists.map((l) => [l.no, l]));
export const candidateById = new Map(candidates.map((c) => [c.id, c]));

export const listPath = (slug: string, locale: Locale): string => withLocale(locale, `/saraksti/${slug}/`);
export const candidatePath = (c: { id: number; slug: string }, locale: Locale): string =>
  withLocale(locale, `/kandidati/${c.id}-${c.slug}/`);

export function candidatesOf(list: ListRecord): Candidate[] {
  return candidates.filter((c) => c.list_slug === list.slug && c.status === "active");
}

export function tierLabel(tier: string, locale: Locale): string {
  return meta.tiers[tier]?.[locale] ?? tier;
}

export function constituencyName(slug: string): string {
  return meta.constituencies.find((c) => c.slug === slug)?.name ?? slug;
}

/** Short display name for a list: curated short name, else a trimmed CVK name. */
export function listShortName(list: ListRecord): string {
  if (list.short_name) return list.short_name;
  return list.name.replace(/^"(.*)"$/, "$1");
}

export function formatNumber(n: number | null, locale: Locale, digits = 1): string {
  if (n === null || Number.isNaN(n)) return "-";
  return n.toLocaleString(locale === "lv" ? "lv-LV" : "en-GB", { maximumFractionDigits: digits });
}

export function formatDate(iso: string | null, locale: Locale): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(locale === "lv" ? "lv-LV" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
}
