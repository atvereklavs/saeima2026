// URL helpers for dati.cvk.lv/SV2026, shared by the fetch and build stages.
export const CVK_BASE = "https://dati.cvk.lv/SV2026/";
export const cvkIndexUrl = `${CVK_BASE}kandidatu-saraksti/`;
export const cvkTableUrl = `${CVK_BASE}kandidati/`;
export const cvkListUrl = (slug: string): string => `${CVK_BASE}kandidatu-saraksti/${slug}`;
export const cvkListUrlEn = (slug: string): string => `${CVK_BASE}en/kandidatu-saraksti/${slug}`;
export const cvkCandidateUrl = (path: string): string => `${CVK_BASE}kandidati/${path}`;
export const cvkCandidateUrlEn = (path: string): string => `${CVK_BASE}en/kandidati/${path}`;
