# Saeima 2026

Independent, non-commercial dashboard for the Latvian 15th Saeima election
(3 October 2026): the 14 candidate lists and their 1,428 candidates, presented by
**experience, areas of work and record in government** rather than by finances
(KNAB and Delna already cover money).

Bilingual UI (Latvian default, English under `/en/`); source data stays in
Latvian as published by the Central Election Commission (CVK).

## How it works

```
pipeline/  TypeScript scripts (Node 22, no build step) that fetch public sources
           into .cache/ (gitignored) and write the normalised dataset to data/
data/      committed JSON: lists.json, candidates.json, candidates.index.json, meta.json
src/       Astro 7 static site; two React islands (candidate explorer, list compare)
tests/     node --test over saved fixture pages
```

Data flows one way: sources -> `.cache/` -> `data/` -> `dist/`. Because `data/`
is committed, a fresh clone builds without crawling, and every re-crawl is a
reviewable `git diff data/`.

## Commands

```bash
pnpm install
pnpm test                       # parsers, name keys, tier rules
pnpm pipeline:cvk               # index + 14 list pages + candidate table (16 requests)
pnpm pipeline:cvk -- --details  # ... plus every candidate page (~1,430 requests, ~9 min, resumable)
pnpm pipeline:cvk -- --refresh  # re-fetch index/lists/table; candidate pages only where the row changed
pnpm pipeline:build             # cache -> data/*.json (never touches the network)
pnpm dev                        # local dev server
pnpm build && pnpm preview      # static build + preview
pnpm deploy                     # build + `wrangler deploy` (Cloudflare Workers static assets)
```

Environment variables (all optional): `SAEIMA2026_CONTACT` (email added to the
crawler User-Agent), `SAEIMA2026_SPACING_MS` (delay between requests, default
350), `SAEIMA2026_CACHE` (cache dir, default `.cache`), `PUBLISH_KGB=0` (omit the
security-service declaration from the dataset), `SITE_URL` (public origin for
canonical links and the sitemap).

## Sources

| Source | Used for |
|---|---|
| [dati.cvk.lv/SV2026](https://dati.cvk.lv/SV2026/kandidatu-saraksti/) | lists, programmes, per-list statistics, candidates' own declarations |
| [Saeima](https://titania.saeima.lv) and [Delna](https://deputatiuzdelnas.lv) | 13th and 14th Saeima mandates, factions, committees (next slice) |
| [Wikidata](https://www.wikidata.org) (CC0) | earlier terms, ministerial posts, Wikipedia links (next slice) |
| [KNAB](https://info.knab.gov.lv/parties) | party registry facts; finances stay there |

The crawler is single-threaded, waits 350 ms between requests, retries on 5xx
and stops on 403/429. Every record carries its source URL and fetch time.

## Privacy

The CVK also publishes ethnicity, marital status and foreign citizenship. The
dataset drops those at individual level (`pipeline/build-dataset.ts`,
`EXCLUDED_FIELDS`); only the CVK's per-list aggregates are shown. The site sets
no cookies and runs no analytics.

## Experience tier

`pipeline/rules/tiers.json` holds the regex rules that turn declared workplaces
into a tier (minister, sitting MP, former MP, municipal, civil service, none).
Until official Saeima and Wikidata records are joined in, the tier is marked
provisional on every page.

## Licence

Code: MIT. Dataset: derived from public sources listed above, with attribution;
see `data/NOTICE.md`.
