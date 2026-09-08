// Name normalisation shared by the matching step and the search index.

/** Remove combining marks: "Kalniņa-Lukaševica" -> "Kalnina-Lukasevica". */
export function stripDiacritics(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}+/gu, "");
}

/** Lowercase, diacritic-free, punctuation-free, single-spaced key. */
export function nameKey(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Order-insensitive key: "Aldis Adamovičs" and "Adamovičs Aldis" collide. */
export function tokenKey(s: string): string {
  return nameKey(s).split(" ").filter(Boolean).sort().join(" ");
}

/** "Adamovičs, Aldis" -> "Aldis Adamovičs"; other strings pass through trimmed. */
export function flipSurnameFirst(s: string): string {
  const m = s.match(/^\s*([^,]+),\s*(.+?)\s*$/);
  return m ? `${m[2]} ${m[1].trim()}` : s.trim();
}

/** Fold arbitrary text for accent-insensitive substring search. */
export function foldText(s: string): string {
  return stripDiacritics(s).toLowerCase();
}
