// Shared record types for the committed dataset (data/*.json). The pipeline
// writes them, the Astro site reads them.

export type Position = { workplace: string; role: string };
export type Education = { institution: string; year: number | null; degree: string };
export type StatRow = { label: string; count: number; percent: number | null };
export type Tag = { tag: string; score: number };
export type Source = { url: string; fetched_at: string | null; updated_at?: string | null };

export type Committee = {
  name: string;
  kind: "committee" | "subcommittee" | "delegation";
  from: string | null;
  to: string | null;
  term: number | null;
  source: string;
};

export type MinisterRole = { role: string; from: string | null; to: string | null; source: string };

export type History = {
  tier: string;
  flags: string[];
  /** true when no official source (Delna, Saeima, Wikidata) matched; tier comes from CVK text only */
  provisional: boolean;
  sitting_mp: boolean;
  mandate_status_14: string | null;
  faction_14: string | null;
  elected_from_14: string | null;
  saeima_terms: number[];
  terms_count: number;
  committees: Committee[];
  minister_roles: MinisterRole[];
  municipal_role: "councillor" | "mayor" | null;
  sources: { delna_14: boolean; delna_13: boolean; titania: Record<string, string>; wikidata: string | null };
};

export type Candidate = {
  id: number;
  slug: string;
  name: string;
  name_key: string;
  status: "active" | "withdrawn";
  withdrawn_at: string | null;
  list_slug: string;
  list_no: number;
  constituency: string;
  constituency_name: string;
  position: number;
  birth_year: number | null;
  age: number | null;
  age_band: string | null;
  gender: string | null;
  residence: string | null;
  education_level: string | null;
  education: Education[];
  positions: Position[];
  positions_raw: string[];
  headline_role: string | null;
  has_profile: boolean;
  kgb_no_collaboration?: boolean | null;
  history: History;
  tags: Tag[];
  links: Record<string, string>;
  sources: Record<string, Source>;
  photo: null | { url: string; credit: string; licence: string };
};

export type IndexRow = {
  id: number;
  slug: string;
  name: string;
  list_no: number;
  constituency: string;
  position: number;
  birth_year: number | null;
  age_band: string | null;
  tier: string;
  tags: string[];
  headline_role: string | null;
  status: "active" | "withdrawn";
};

export type ProgrammeSection = { title: string | null; paragraphs: string[] };

export type ListRecord = {
  slug: string;
  no: number;
  name: string;
  short_name: string | null;
  candidates_count: number;
  programme: { text: string; paragraphs: string[]; sections: ProgrammeSection[] };
  stats: { candidates_count: number | null; gender: StatRow[]; education: StatRow[]; foreign_citizenship: StatRow[] };
  knab: null | { reg_no: string; founded_at: string; public_id: string };
  curated: {
    pm_candidate: string | null;
    coalition: string | null;
    seats_14: number | null;
    wikipedia_lv: string | null;
    wikipedia_en: string | null;
  };
  leads_by_constituency: Record<string, string>;
  aggregates: {
    tier_counts: Record<string, number>;
    experience_share: number;
    public_office_share: number;
    avg_age: number | null;
    median_age: number | null;
    women_pct: number | null;
    higher_ed_pct: number | null;
    minister_count: number;
    sitting_mp_count: number;
    former_mp_count: number;
    newcomer_share: number;
    person_terms: number;
    committees_distinct: number;
    riga_share: number;
    constituencies_fielded: number;
    debates_count: number;
    education_mix: StatRow[];
    top_tags: { tag: string; count: number }[];
    by_constituency: Record<string, number[]>;
  };
  links: Record<string, string>;
  sources: Record<string, Source>;
  debates: null | unknown;
  position_vector: null | Record<string, number>;
};

export type Label = { lv: string; en: string };

export type Meta = {
  built_at: string;
  election_date: string;
  cvk_index_fetched_at: string | null;
  cvk_last_updated: string | null;
  counts: { lists: number; candidates: number; active: number; withdrawn: number; with_profile: number };
  constituencies: { slug: string; name: string }[];
  tiers: Record<string, Label>;
  tier_order: string[];
  tags: Record<string, Label>;
  publish_kgb: boolean;
  excluded_fields: readonly string[];
};
