// URLs and cache keys for the secondary sources.
export const DELNA_BASE = "https://deputatiuzdelnas.lv/";
export const delnaCsvUrl = (file: "groups_14.csv" | "groups.csv"): string => `${DELNA_BASE}data/tab_b/${file}`;
export const DELNA_MPS_URL = `${DELNA_BASE}index.php?saeima=14`;

export const KNAB_PARTIES_URL = "https://info.knab.gov.lv/api/parties";
export const knabPartyUrl = (publicId: string): string => `https://info.knab.gov.lv/parties/${publicId}`;

export const SAEIMA_TERMS = [12, 13, 14] as const;
export const saeimaNsf = (term: number): string => `https://titania.saeima.lv/personal/deputati/saeima${term}_depweb_public.nsf`;
export const saeimaDeputiesViewUrl = (term: number): string => `${saeimaNsf(term)}/deputies?OpenView&lang=LV&count=1000`;
export const saeimaDeputyUrl = (term: number, unid: string): string => `${saeimaNsf(term)}/0/${unid}?OpenDocument&lang=LV`;
export const SAEIMA_MATCHED_UNIDS = "saeima-matched-unids.json";

export const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
export const WIKIDATA_KEYS = { deputies: "wikidata/saeima-deputies.json", ministers: "wikidata/latvian-ministers.json" } as const;
export const POLISTATS_DEPUTIES_URL = "https://lv.polistats.eu/en/deputies";
