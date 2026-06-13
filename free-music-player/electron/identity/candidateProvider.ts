/**
 * CandidateProvider — multi-strategy YouTube Music search for the identity engine.
 *
 * Searches YouTube Music using several query strategies (artist+title, title only,
 * artist only, etc.) in parallel, deduplicates by videoId, and returns ranked
 * candidates for downstream scoring.
 */

import type {
  CandidateQuery,
  SearchStrategy,
  CandidateTrack,
  CandidateProviderResult,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
//  Lazy ytmusic-api singleton (same pattern as searchMatching.ts)
// ═══════════════════════════════════════════════════════════════════════════

let _ytmusicClient: any = null;

async function getYTMusic(): Promise<any> {
  if (!_ytmusicClient) {
    const mod = await import('ytmusic-api');
    const YTMusic = mod.default;
    _ytmusicClient = new YTMusic();
    await _ytmusicClient.initialize();
  }
  return _ytmusicClient;
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
//  Mapping — raw ytmusic-api result → CandidateTrack
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map a raw ytmusic-api search result to a CandidateTrack.
 *
 * Handles the various shapes the API may return (videoId vs id,
 * name vs title, duration as number vs string vs undefined).
 */
export function mapToCandidateTrack(
  result: any,
  position: number,
): CandidateTrack {
  // Duration can be a number, a string like "3:45", or undefined.
  let duration = 0;
  if (typeof result.duration === 'number') {
    duration = Math.round(result.duration);
  } else if (typeof result.duration === 'string') {
    // Parse "M:SS" or "MM:SS" or "HH:MM:SS" format
    const parts = result.duration.split(':').map(Number);
    if (parts.length === 3) {
      duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      duration = parts[0] * 60 + parts[1];
    }
    duration = Math.round(duration);
  }

  return {
    videoId: result.videoId || result.id || '',
    title: result.name || result.title || '',
    artist: result.artist?.name || '',
    duration,
    channelTitle: result.artist?.name || '',
    viewCount: undefined,
    thumbnail: result.thumbnails?.[0]?.url || '',
    nativePosition: position,
  };
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

/**
 * Search YouTube Music with a single query string.
 * Returns mapped and deduplicated candidates. Never throws.
 */
export async function searchYouTube(
  query: string,
  limit: number = 25,
): Promise<CandidateTrack[]> {
  if (!query.trim()) return [];

  try {
    const yt = await getYTMusic();
    const results = await yt.searchSongs(query);
    if (!results || !Array.isArray(results)) return [];

    return results.slice(0, limit).map((r: any, i: number) =>
      mapToCandidateTrack(r, i),
    );
  } catch (err) {
    console.error(`[CandidateProvider] searchYouTube failed for "${query}":`, err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CandidateProvider class
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Multi-strategy candidate provider.
 *
 * Searches YouTube Music using multiple query strategies in parallel,
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
   * Search YouTube Music with a specific strategy.
   *
   * @param strategy - Which query strategy to use.
   * @param query    - The search query string (already built by caller).
   * @param limit    - Max results to request from the API (default 15).
   * @returns Array of CandidateTrack, or empty array on error.
   */
  async searchByStrategy(
    strategy: SearchStrategy,
    query: string,
    limit: number = 15,
  ): Promise<CandidateTrack[]> {
    if (!query.trim()) return [];

    try {
      const yt = await getYTMusic();
      const results = await yt.searchSongs(query);
      if (!results || !Array.isArray(results)) return [];

      return results.slice(0, limit).map((r: any, i: number) =>
        mapToCandidateTrack(r, i),
      );
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
