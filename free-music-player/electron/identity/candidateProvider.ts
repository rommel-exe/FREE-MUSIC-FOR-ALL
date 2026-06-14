/**
 * CandidateProvider — multi-strategy YouTube Music search for the identity engine.
 *
 * Searches YouTube using several query strategies (artist+title, title only,
 * artist only, etc.) in parallel via yt-dlp, deduplicates by videoId, and
 * returns ranked candidates for downstream scoring.
 *
 * yt-dlp is used INSTEAD of ytmusic-api because YouTube actively blocks the
 * ytmusic-api library (400 errors / ECONNRESET). yt-dlp handles YouTube's
 * anti-bot measures natively and is already a project dependency.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  CandidateQuery,
  SearchStrategy,
  CandidateTrack,
  CandidateProviderResult,
} from './types';

const execFileAsync = promisify(execFile);

// ═══════════════════════════════════════════════════════════════════════════
//  yt-dlp binary detection
// ═══════════════════════════════════════════════════════════════════════════

const HARDCODED_YTDLP = '/Library/Frameworks/Python.framework/Versions/3.12/bin/yt-dlp';
let _ytdlpPath: string | null = null;

async function findYtDlp(): Promise<string> {
  if (_ytdlpPath) return _ytdlpPath;

  // Try common locations
  const candidates = [
    HARDCODED_YTDLP,
    '/opt/homebrew/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
  ];

  for (const p of candidates) {
    try {
      await execFileAsync(p, ['--version'], { timeout: 3000 });
      _ytdlpPath = p;
      return p;
    } catch {
      continue;
    }
  }

  // Try `which yt-dlp`
  try {
    const { stdout } = await execFileAsync('which', ['yt-dlp'], { timeout: 3000 });
    const p = stdout.trim();
    if (p) {
      _ytdlpPath = p;
      return p;
    }
  } catch {
    // not found via which
  }

  // Fall back to hardcoded path (will fail at exec time)
  _ytdlpPath = HARDCODED_YTDLP;
  return _ytdlpPath;
}

// ═══════════════════════════════════════════════════════════════════════════
//  yt-dlp search implementation
// ═══════════════════════════════════════════════════════════════════════════

interface YtDlpSearchResult {
  id: string;
  title: string;
  duration?: number;
  channel?: string;
  uploader?: string;
  channel_id?: string;
  view_count?: number;
  thumbnails?: Array<{ url: string; height?: number; width?: number }>;
  channel_is_verified?: boolean;
}

/**
 * Search YouTube using yt-dlp.
 *
 * Uses `--flat-playlist` so it only fetches search-result metadata (fast)
 * without extracting each video's detailed info.
 *
 * @param query - Search query string.
 * @param limit - Max results (default 15, yt-dlp max recommended is ~50).
 * @returns Array of raw yt-dlp search result objects.
 */
async function searchYtDlp(query: string, limit: number = 15): Promise<YtDlpSearchResult[]> {
  if (!query.trim()) return [];

  const ytdlp = await findYtDlp();

  try {
    const { stdout } = await execFileAsync(ytdlp, [
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      `ytsearch${limit}:${query}`,
    ], { timeout: 15_000 });

    // yt-dlp outputs one JSON object per line (NDJSON)
    const lines = stdout.trim().split('\n').filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  } catch (err) {
    console.error(`[CandidateProvider] yt-dlp search failed for "${query}":`, err);
    return [];
  }
}

/**
 * Search YouTube using yt-dlp and map results to CandidateTrack format.
 * Never throws — returns empty array on any error.
 */
export async function searchYouTube(
  query: string,
  limit: number = 25,
): Promise<CandidateTrack[]> {
  if (!query.trim()) return [];

  const results = await searchYtDlp(query, Math.min(limit, 50));
  return results.map((r, i) => mapYtDlpToCandidate(r, i));
}

// ═══════════════════════════════════════════════════════════════════════════
//  Strategy ordering (most-specific first)
// ═══════════════════════════════════════════════════════════════════════════

const STRATEGY_ORDER: SearchStrategy[] = [
  'artist_title',
  'title_only',
  'artist_only',
  'artist_duration',
  'title_duration',
];

// ═══════════════════════════════════════════════════════════════════════════
//  Helper — build a query string from track metadata
// ═══════════════════════════════════════════════════════════════════════════

/** Format seconds as `M:SS` for duration-augmented queries. */
function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Build a YouTube Music search query from optional track fields.
 *
 * Examples:
 *   buildSearchQuery('Radiohead', 'Creep', 240)  → 'Radiohead Creep'
 *   buildSearchQuery('Radiohead', undefined, 240) → 'Radiohead'
 *   buildSearchQuery(undefined, 'Creep', 240)     → 'Creep'
 *   (duration is NOT included in the base query — caller decides)
 */
export function buildSearchQuery(
  artist?: string,
  title?: string,
  duration?: number,
): string {
  const parts: string[] = [];
  if (artist) parts.push(artist.trim());
  if (title) parts.push(title.trim());
  // duration is intentionally ignored here — callers that want it append it
  // via their own strategy logic. This keeps the base query clean.
  return parts.join(' ').trim();
}

/**
 * Construct the query string for a specific search strategy.
 */
function buildStrategyQuery(
  strategy: SearchStrategy,
  artist?: string,
  title?: string,
  duration?: number,
): string {
  switch (strategy) {
    case 'artist_title':
      return buildSearchQuery(artist, title);

    case 'title_only':
      return title?.trim() || '';

    case 'artist_only':
      return artist?.trim() || '';

    case 'artist_duration': {
      if (!artist || !duration || duration <= 0) return '';
      return `${artist.trim()} ${formatDuration(duration)}`;
    }

    case 'title_duration': {
      if (!title || !duration || duration <= 0) return '';
      return `${title.trim()} ${formatDuration(duration)}`;
    }

    default:
      return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Mapping — yt-dlp result → CandidateTrack
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map a yt-dlp search result to a CandidateTrack.
 *
 * yt-dlp with `--flat-playlist --dump-json` outputs objects with fields:
 *   id, title, duration, channel, uploader, view_count, thumbnails, ...
 */
function mapYtDlpToCandidate(
  result: YtDlpSearchResult,
  position: number,
): CandidateTrack {
  return {
    videoId: result.id || '',
    title: result.title || '',
    artist: result.channel || result.uploader || '',
    duration: Math.round(result.duration ?? 0),
    channelTitle: result.channel || result.uploader || '',
    viewCount: result.view_count,
    thumbnail: result.thumbnails?.[0]?.url || '',
    nativePosition: position,
  };
}

/**
 * Map a raw API search result to a CandidateTrack.
 * Kept for backward compatibility — delegates to mapYtDlpToCandidate.
 * @deprecated Use mapYtDlpToCandidate directly for yt-dlp results.
 */
export function mapToCandidateTrack(
  result: any,
  position: number,
): CandidateTrack {
  return mapYtDlpToCandidate(result, position);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Deduplication
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Remove duplicate candidates by videoId.
 * First occurrence wins — callers should insert results from
 * higher-specificity strategies first so they are preserved.
 */
export function deduplicateCandidates(
  candidates: CandidateTrack[],
): CandidateTrack[] {
  const seen = new Set<string>();
  const unique: CandidateTrack[] = [];

  for (const c of candidates) {
    if (!c.videoId || seen.has(c.videoId)) continue;
    seen.add(c.videoId);
    unique.push(c);
  }

  return unique;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Core YouTube search (single call, external-friendly)
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
//  CandidateProvider class
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Multi-strategy candidate provider.
 *
 * Searches YouTube using multiple query strategies in parallel via yt-dlp,
 * deduplicates by videoId, and returns ranked candidates.
 */
export class CandidateProvider {
  /** Maximum number of unique candidates to return. */
  private maxCandidates: number;

  /** Maximum concurrent strategy searches. */
  private concurrency: number;

  constructor(options?: { maxCandidates?: number; concurrency?: number }) {
    this.maxCandidates = options?.maxCandidates ?? 50;
    this.concurrency = options?.concurrency ?? 3;
  }

  /**
   * Search YouTube with a specific strategy using yt-dlp.
   *
   * @param strategy - Which query strategy to use.
   * @param query    - The search query string (already built by caller).
   * @param limit    - Max results to request (default 15).
   * @returns Array of CandidateTrack, or empty array on error.
   */
  async searchByStrategy(
    strategy: SearchStrategy,
    query: string,
    limit: number = 15,
  ): Promise<CandidateTrack[]> {
    if (!query.trim()) return [];

    try {
      const results = await searchYtDlp(query, Math.min(limit, 50));
      return results.map((r, i) => mapYtDlpToCandidate(r, i));
    } catch (err) {
      console.error(
        `[CandidateProvider] searchByStrategy("${strategy}") failed for "${query}":`,
        err,
      );
      return [];
    }
  }

  /**
   * Find candidate tracks using multiple search strategies.
   *
   * Runs all applicable strategies in parallel (with concurrency control),
   * deduplicates results by videoId (first occurrence = higher specificity wins),
   * and returns up to `maxCandidates` results sorted by strategy specificity.
   */
  async findCandidates(input: CandidateQuery): Promise<CandidateProviderResult[]> {
    const { artist, title, duration, limit } = input;
    const effectiveLimit = limit ?? this.maxCandidates;

    // Build queries for every strategy (skip strategies that produce empty queries)
    const strategyQueries: Array<{ strategy: SearchStrategy; query: string }> = [];
    for (const strategy of STRATEGY_ORDER) {
      const query = buildStrategyQuery(strategy, artist, title, duration);
      if (query) {
        strategyQueries.push({ strategy, query });
      }
    }

    if (strategyQueries.length === 0) return [];

    // Run strategies in batches of `this.concurrency`
    const strategyResults: CandidateProviderResult[] = [];
    for (let i = 0; i < strategyQueries.length; i += this.concurrency) {
      const batch = strategyQueries.slice(i, i + this.concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async ({ strategy, query }) => {
          const candidates = await this.searchByStrategy(strategy, query);
          return { candidates, strategy, query };
        }),
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          strategyResults.push(r.value);
        }
      }
    }

    // Deduplicate across all strategies — insert in strategy order so
    // higher-specificity results (artist_title) are seen first.
    const allCandidates: CandidateTrack[] = [];
    for (const sr of strategyResults) {
      allCandidates.push(...sr.candidates);
    }
    const deduplicated = deduplicateCandidates(allCandidates);

    // Limit to maxCandidates
    const trimmed = deduplicated.slice(0, effectiveLimit);

    // Rebuild per-strategy result sets with only the candidates that survived
    // deduplication (preserves the CandidateProviderResult shape consumers expect).
    const survivingIds = new Set(trimmed.map((c) => c.videoId));
    const finalResults: CandidateProviderResult[] = strategyResults.map((sr) => ({
      ...sr,
      candidates: sr.candidates.filter((c) => survivingIds.has(c.videoId)),
    }));

    // Append a synthetic "combined" result with the final deduplicated list
    finalResults.push({
      candidates: trimmed,
      strategy: 'artist_title', // placeholder — the combined set
      query: buildSearchQuery(artist, title),
    });

    return finalResults;
  }
}
