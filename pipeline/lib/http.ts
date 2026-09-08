// Cached, polite HTTP fetcher for the data pipeline.
//
// Every fetched body is written to .cache/raw/<host>/<path> (atomic tmp+rename)
// and recorded in .cache/fetchlog.json with a sha256 and timestamp. Re-running
// a stage with the file already on disk costs nothing; pass { refresh: true }
// to hit the network again. Requests are single-threaded and spaced by
// SAEIMA2026_SPACING_MS (default 350 ms). 403/429 stop the run on purpose.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const CACHE_ROOT = process.env.SAEIMA2026_CACHE ?? join(process.cwd(), ".cache");
const RAW_DIR = join(CACHE_ROOT, "raw");
const LOG_PATH = join(CACHE_ROOT, "fetchlog.json");
const MIN_SPACING_MS = Number(process.env.SAEIMA2026_SPACING_MS ?? 350);
const TIMEOUT_MS = 30_000;
const CONTACT = process.env.SAEIMA2026_CONTACT ?? "";
export const USER_AGENT = `saeima2026-dashboard/0.1 (+https://github.com/atvereklavs/saeima2026${
  CONTACT ? `; mailto:${CONTACT}` : ""
})`;

export type FetchLogEntry = {
  path: string;
  sha256: string;
  fetched_at: string;
  status: number;
  bytes: number;
};

export type FetchResult = {
  text: string;
  status: number;
  fromCache: boolean;
  fetchedAt: string | null;
  path: string;
};

export type FetchOptions = {
  refresh?: boolean;
  accept?: string;
  /** Return { status: 404, text: "" } instead of throwing on 404. */
  allowNotFound?: boolean;
  /** Cache under .cache/raw/<cacheKey> instead of a path derived from the URL (for long query URLs). */
  cacheKey?: string;
};

export class FatalFetchError extends Error {}

let logCache: Record<string, FetchLogEntry> | null = null;

function log(): Record<string, FetchLogEntry> {
  if (!logCache) {
    logCache = existsSync(LOG_PATH)
      ? (JSON.parse(readFileSync(LOG_PATH, "utf8")) as Record<string, FetchLogEntry>)
      : {};
  }
  return logCache;
}

function saveLog(): void {
  // Merge over whatever is on disk so two pipeline stages running side by
  // side do not clobber each other's entries.
  const onDisk = existsSync(LOG_PATH)
    ? (JSON.parse(readFileSync(LOG_PATH, "utf8")) as Record<string, FetchLogEntry>)
    : {};
  logCache = { ...onDisk, ...log() };
  atomicWrite(LOG_PATH, JSON.stringify(logCache, null, 1));
}

export function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Deterministic on-disk location for a URL's raw body. */
export function cachePathFor(url: string): string {
  const u = new URL(url);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index";
  if (u.search) p += `__${u.search.slice(1)}`;
  const safe = p
    .split("/")
    .map((seg) => seg.replace(/[^A-Za-z0-9._-]/g, "_"))
    .join("/");
  const withExt = /\.[a-z0-9]{2,5}$/i.test(safe) ? safe : `${safe}.html`;
  return join(RAW_DIR, u.host, withExt);
}

/** Read a cached body without touching the network; null when absent. */
export function readCached(url: string, cacheKey?: string): string | null {
  const p = cacheKey ? join(RAW_DIR, cacheKey) : cachePathFor(url);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export function cachedEntry(url: string): FetchLogEntry | null {
  return log()[url] ?? null;
}

let lastRequestAt = 0;

async function pace(): Promise<void> {
  const wait = lastRequestAt + MIN_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

export async function fetchCached(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const path = opts.cacheKey ? join(RAW_DIR, opts.cacheKey) : cachePathFor(url);
  if (!opts.refresh && existsSync(path)) {
    const entry = log()[url];
    return {
      text: readFileSync(path, "utf8"),
      status: entry?.status ?? 200,
      fromCache: true,
      fetchedAt: entry?.fetched_at ?? null,
      path,
    };
  }

  let attempt = 0;
  for (;;) {
    attempt += 1;
    await pace();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }

    if (res.status === 403 || res.status === 429) {
      throw new FatalFetchError(`HTTP ${res.status} for ${url} - stopping so we stay polite`);
    }
    if (res.status >= 500) {
      if (attempt >= 4) throw new Error(`HTTP ${res.status} for ${url} after ${attempt} attempts`);
      await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }
    if (res.status === 404 && opts.allowNotFound) {
      const fetchedAt = new Date().toISOString();
      log()[url] = { path: relative(CACHE_ROOT, path), sha256: "", fetched_at: fetchedAt, status: 404, bytes: 0 };
      saveLog();
      return { text: "", status: 404, fromCache: false, fetchedAt, path };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const text = await res.text();
    atomicWrite(path, text);
    const fetchedAt = new Date().toISOString();
    log()[url] = {
      path: relative(CACHE_ROOT, path),
      sha256: sha256(text),
      fetched_at: fetchedAt,
      status: res.status,
      bytes: Buffer.byteLength(text),
    };
    saveLog();
    return { text, status: res.status, fromCache: false, fetchedAt, path };
  }
}
