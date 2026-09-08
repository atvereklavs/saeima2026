// UI labels in both languages. Data values (names, workplaces, programmes)
// stay in Latvian as published by the CVK.
export type Locale = "lv" | "en";
export const locales: Locale[] = ["lv", "en"];

export const withLocale = (locale: Locale, path: string): string => (locale === "en" ? `/en${path}` : path);

/** Same page in the other language. */
export function switchLocalePath(locale: Locale, pathname: string): string {
  if (locale === "en") return pathname.replace(/^\/en(\/|$)/, "/") || "/";
  return `/en${pathname === "/" ? "/" : pathname}`;
}

type Entry = { lv: string; en: string };

export const L = {
  "site.name": { lv: "Saeima 2026", en: "Saeima 2026" },
  "site.tagline": {
    lv: "15. Saeimas vēlēšanu kandidāti pēc pieredzes, stiprajām pusēm un darba valsts pārvaldē",
    en: "15th Saeima election candidates by experience, strengths and record in government",
  },
  "nav.lists": { lv: "Saraksti", en: "Lists" },
  "nav.candidates": { lv: "Kandidāti", en: "Candidates" },
  "nav.compare": { lv: "Salīdzināt", en: "Compare" },
  "nav.about": { lv: "Par vietni", en: "About" },
  "election.day": { lv: "Vēlēšanu diena", en: "Election day" },
  "election.days_left": { lv: "dienas līdz vēlēšanām", en: "days to the election" },
  "election.date_long": { lv: "sestdiena, 2026. gada 3. oktobris", en: "Saturday, 3 October 2026" },
  "overview.heading": { lv: "14 kandidātu saraksti, 1428 kandidāti", en: "14 candidate lists, 1,428 candidates" },
  "overview.intro": {
    lv: "Šī vietne rāda, ko kandidāti paši ir deklarējuši CVK: izglītību, darbavietas un amatus, kā arī to, kuriem jau ir darba pieredze Saeimā, valdībā vai pašvaldībā. Finanšu datus atstājam KNAB un Delnai.",
    en: "This site shows what candidates themselves declared to the Central Election Commission: education, workplaces and positions, and who already has a record in the Saeima, the government or a municipality. Financial data is left to KNAB and Delna.",
  },
  "overview.how": { lv: "Kā lasīt", en: "How to read this" },
  "overview.how_text": {
    lv: "Pieredzes līmenis ir noteikts automātiski pēc kandidāta norādītajām darbavietām, tāpēc tas ir orientējošs. Katra kandidāta lapā ir saite uz CVK pirmavotu.",
    en: "The experience tier is derived automatically from the workplaces each candidate declared, so treat it as indicative. Every candidate page links to the CVK source.",
  },
  "list.candidates": { lv: "kandidāti", en: "candidates" },
  "list.lead": { lv: "Saraksta līderis", en: "List leader" },
  "list.leads": { lv: "Līderi pa apgabaliem", en: "Leaders by constituency" },
  "list.pm_candidate": { lv: "Ministru prezidenta kandidāts", en: "PM candidate" },
  "list.experience_share": { lv: "ar Saeimas vai valdības pieredzi", en: "with Saeima or government experience" },
  "list.public_office_share": { lv: "ar amatu valsts vai pašvaldības pārvaldē", en: "with any public office" },
  "list.avg_age": { lv: "vidējais vecums", en: "average age" },
  "list.median_age": { lv: "mediānais vecums", en: "median age" },
  "list.programme": { lv: "Priekšvēlēšanu programma", en: "Election programme" },
  "list.programme_note": {
    lv: "Programmas teksts CVK iesniegtajā redakcijā (līdz 4000 zīmēm).",
    en: "Programme text as submitted to the CVK (up to 4,000 characters), in Latvian.",
  },
  "list.stats": { lv: "CVK statistika par sarakstu", en: "CVK statistics for the list" },
  "list.experience_profile": { lv: "Pieredzes profils", en: "Experience profile" },
  "list.by_constituency": { lv: "Kandidāti pa vēlēšanu apgabaliem", en: "Candidates by constituency" },
  "list.coalition.government": { lv: "Valdošā koalīcija", en: "Governing coalition" },
  "list.coalition.opposition": { lv: "Opozīcija", en: "Opposition" },
  "list.coalition.extra_parliamentary": { lv: "Nav pārstāvēta 14. Saeimā", en: "Not in the 14th Saeima" },
  "list.seats_14": { lv: "vietas 14. Saeimā", en: "seats in the 14th Saeima" },
  "list.open": { lv: "Atvērt sarakstu", en: "Open list" },
  "list.source": { lv: "Saraksts CVK vietnē", en: "List on the CVK site" },
  "stat.gender": { lv: "Dzimums", en: "Gender" },
  "stat.education": { lv: "Izglītība", en: "Education" },
  "stat.foreign_citizenship": { lv: "Ārvalstu pilsonība", en: "Foreign citizenship" },
  "stat.count": { lv: "Skaits", en: "Count" },
  "stat.percent": { lv: "Procenti", en: "Percent" },
  "candidate.position": { lv: "Nr. sarakstā", en: "List position" },
  "candidate.constituency": { lv: "Vēlēšanu apgabals", en: "Constituency" },
  "candidate.list": { lv: "Saraksts", en: "List" },
  "candidate.birth_year": { lv: "Dzimšanas gads", en: "Year of birth" },
  "candidate.age": { lv: "Vecums", en: "Age" },
  "candidate.residence": { lv: "Dzīvesvieta", en: "Residence" },
  "candidate.education_level": { lv: "Izglītības pakāpe", en: "Education level" },
  "candidate.education": { lv: "Izglītība", en: "Education" },
  "candidate.institution": { lv: "Izglītības iestāde", en: "Institution" },
  "candidate.year": { lv: "Gads", en: "Year" },
  "candidate.degree": { lv: "Grāds, kvalifikācija", en: "Degree, qualification" },
  "candidate.positions": { lv: "Darbavietas un amati", en: "Workplaces and positions" },
  "candidate.workplace": { lv: "Darbavieta", en: "Workplace" },
  "candidate.role": { lv: "Amats", en: "Position" },
  "candidate.history": { lv: "Darbs valsts pārvaldē", en: "Record in government" },
  "candidate.tier": { lv: "Pieredzes līmenis", en: "Experience tier" },
  "candidate.flags": { lv: "Atpazītās pazīmes", en: "Signals found" },
  "candidate.provisional": {
    lv: "Noteikts automātiski pēc kandidāta CVK norādītajām darbavietām.",
    en: "Derived automatically from the workplaces the candidate declared to the CVK.",
  },
  "list.tier_note": {
    lv: "Līmeņi balstās oficiālajos Saeimas, Delnas un Wikidata ierakstos, kur tādi ir (atzīme \"Apstiprināts oficiālajos avotos\"), pārējiem - kandidāta CVK norādītajās darbavietās.",
    en: "Tiers rest on official Saeima, Delna and Wikidata records where they exist (badge \"Confirmed in official sources\"); for the rest, on the workplaces declared to the CVK.",
  },
  "candidate.kgb": { lv: "Deklarācija par sadarbību ar drošības dienestiem", en: "Declaration on security-service collaboration" },
  "candidate.kgb_no": {
    lv: "Kandidāts deklarējis, ka nav sadarbojies ar PSRS, Latvijas PSR vai ārvalstu drošības dienestiem.",
    en: "The candidate declared no collaboration with USSR, Latvian SSR or foreign security services.",
  },
  "candidate.kgb_yes": {
    lv: "Kandidāts deklarējis sadarbību ar PSRS, Latvijas PSR vai ārvalstu drošības dienestiem.",
    en: "The candidate declared collaboration with USSR, Latvian SSR or foreign security services.",
  },
  "candidate.sources": { lv: "Avoti", en: "Sources" },
  "candidate.cvk_source": { lv: "Kandidāta sniegtā informācija CVK vietnē", en: "The candidate's own declaration on the CVK site" },
  "candidate.cvk_note": {
    lv: "Informācija publicēta kandidāta sniegtajā redakcijā uz saraksta iesniegšanas dienu; par tās patiesumu atbild kandidāts.",
    en: "Information as supplied by the candidate on the day the list was submitted; the candidate is responsible for its accuracy.",
  },
  "candidate.updated": { lv: "CVK ieraksts atjaunināts", en: "CVK record updated" },
  "candidate.withdrawn": { lv: "Kandidāts svītrots no saraksta", en: "Candidate removed from the list" },
  "candidate.no_profile": {
    lv: "Detalizētais profils vēl nav ielādēts; rādīta informācija no CVK kopsavilkuma tabulas.",
    en: "The detailed profile is not loaded yet; showing the CVK summary row.",
  },
  "candidate.tags": { lv: "Jomas", en: "Areas" },
  "candidate.in_list": { lv: "sarakstā", en: "on the list" },
  "candidate.terms": { lv: "Saeimas sasaukumi", en: "Saeima terms" },
  "candidate.committees": { lv: "Komisijas un delegācijas", en: "Committees and delegations" },
  "candidate.minister_roles": { lv: "Ministra amati", en: "Ministerial posts" },
  "candidate.faction": { lv: "Frakcija 14. Saeimā", en: "Faction in the 14th Saeima" },
  "candidate.mandate": { lv: "Mandāta statuss", en: "Mandate status" },
  "candidate.elected_from": { lv: "Ievēlēts no saraksta", en: "Elected from the list of" },
  "candidate.official": { lv: "Apstiprināts oficiālajos avotos", en: "Confirmed in official sources" },
  "candidate.no_official": {
    lv: "Oficiālajos avotos (Saeima, Delna, Wikidata) ieraksts par šo kandidātu nav atrasts.",
    en: "No record of this candidate was found in the official sources (Saeima, Delna, Wikidata).",
  },
  "candidate.term_n": { lv: "{n}. Saeima", en: "{n}th Saeima" },
  "candidate.since": { lv: "no", en: "from" },
  "candidate.until": { lv: "līdz", en: "to" },
  "candidate.current": { lv: "pašlaik", en: "current" },
  "kind.committee": { lv: "komisija", en: "committee" },
  "kind.subcommittee": { lv: "apakškomisija", en: "subcommittee" },
  "kind.delegation": { lv: "delegācija", en: "delegation" },
  "link.saeima": { lv: "Saeimas deputāta lapa", en: "Saeima deputy page" },
  "link.delna": { lv: "Deputāti uz Delnas (deklarācijas, ziedojumi)", en: "Deputāti uz Delnas (declarations, donations)" },
  "link.polistats": { lv: "Polistats balsojumu statistika", en: "Polistats voting statistics" },
  "link.wikipedia_lv": { lv: "Vikipēdija (LV)", en: "Wikipedia (LV)" },
  "link.wikipedia_en": { lv: "Vikipēdija (EN)", en: "Wikipedia (EN)" },
  "link.wikidata": { lv: "Wikidata", en: "Wikidata" },
  "source.saeima": { lv: "Saeima", en: "Saeima" },
  "source.delna": { lv: "Delna", en: "Delna" },
  "source.wikidata": { lv: "Wikidata", en: "Wikidata" },
  "source.cvk": { lv: "CVK", en: "CVK" },
  "explorer.heading": { lv: "Visi kandidāti", en: "All candidates" },
  "explorer.search": { lv: "Meklēt vārdu vai amatu", en: "Search a name or role" },
  "explorer.all": { lv: "Visi", en: "All" },
  "explorer.results": { lv: "kandidāti", en: "candidates" },
  "explorer.reset": { lv: "Notīrīt filtrus", en: "Clear filters" },
  "explorer.sort": { lv: "Kārtot", en: "Sort" },
  "explorer.sort.list": { lv: "pēc saraksta", en: "by list" },
  "explorer.sort.name": { lv: "pēc vārda", en: "by name" },
  "explorer.sort.age_asc": { lv: "jaunākie vispirms", en: "youngest first" },
  "explorer.sort.age_desc": { lv: "vecākie vispirms", en: "oldest first" },
  "explorer.more": { lv: "Rādīt vairāk", en: "Show more" },
  "explorer.role": { lv: "Darbavieta, amats", en: "Workplace, position" },
  "list.founded": { lv: "Dibināta", en: "Founded" },
  "list.age_row": { lv: "Vecums (vid. / med.)", en: "Age (avg / median)" },
  "list.person_terms": { lv: "Saeimas sasaukumi kopā", en: "Saeima terms combined" },
  "list.mp_counts": { lv: "Ministri / dep. tagad / agrāk", en: "Ministers / MPs now / former" },
  "list.riga_share": { lv: "Dzīvo Rīgā", en: "Living in Rīga" },
  "list.committees_distinct": { lv: "Pārstāvētās komisijas", en: "Committees represented" },
  "list.debates_count": { lv: "Debatēs un intervijās", en: "In debates and interviews" },
  "list.constituencies": { lv: "apgabalos", en: "constituencies" },
  "compare.view_cards": { lv: "Kartes", en: "Cards" },
  "compare.view_table": { lv: "Tabula", en: "Table" },
  "compare.sort_hint": { lv: "Klikšķini uz kolonnas, lai kārtotu", en: "Click a column to sort" },
  "compare.heading": { lv: "Salīdzināt sarakstus", en: "Compare lists" },
  "compare.pick": { lv: "Izvēlies 2 līdz 4 sarakstus", en: "Pick 2 to 4 lists" },
  "compare.women": { lv: "sievietes", en: "women" },
  "compare.higher_ed": { lv: "ar augstāko izglītību", en: "with higher education" },
  "compare.tiers": { lv: "Pieredzes līmeņi", en: "Experience tiers" },
  "footer.data_as_of": { lv: "CVK dati uz", en: "CVK data as of" },
  "footer.built": { lv: "Vietne uzbūvēta", en: "Site built" },
  "footer.source": { lv: "Avots: Centrālā vēlēšanu komisija, dati.cvk.lv", en: "Source: Central Election Commission, dati.cvk.lv" },
  "footer.code": { lv: "Kods un datu kopa GitHub", en: "Code and dataset on GitHub" },
  "notfound.heading": { lv: "Lapa nav atrasta", en: "Page not found" },
  "notfound.back": { lv: "Uz sākumu", en: "Back to the start" },
} satisfies Record<string, Entry>;

export type LabelKey = keyof typeof L;

export function t(locale: Locale, key: LabelKey): string {
  return L[key][locale];
}

/** Pre-translate a set of keys for a client island. */
export function labelsFor(locale: Locale, keys: LabelKey[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, L[k][locale]]));
}
