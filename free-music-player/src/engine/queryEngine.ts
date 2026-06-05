/**
 * QueryEngine — Search query engine with caching, ranking, and debounce.
 *
 * Normalises queries, checks an in-memory TTL cache, calls the IPC YouTube
 * search bridge, ranks results by title match / duration / channel / popularity,
 * and returns scored `Track[]` results.
 */

import type { Track, SearchResult } from '@/types';
import { ipc } from '@/utils/ipc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CacheEntry {
  tracks: Track[];
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Ranking helpers (pure functions, no external deps)
// ---------------------------------------------------------------------------

/**
 * Score how well a result title matches the user query.
 *
 * | Condition                       | Points |
 * |---------------------------------|--------|
 * | Exact match (case-insensitive)  |   40   |
 * | Title contains query            |   30   |
 * | Query contains title            |   20   |
 * | Any word overlap                |   10   |
 * | No overlap                      |    0   |
 */
function titleMatchScore(title: string, query: string): number {
  const t = title.toLowerCase();
  const q = query.toLowerCase();

  if (t === q) return 40;
  if (t.includes(q)) return 30;
  if (q.includes(t)) return 20;

  // partial word overlap
  const queryWords = q.split(/\s+/).filter(Boolean);
  const titleWords = t.split(/\s+/).filter(Boolean);
  const overlap = queryWords.filter((w) => titleWords.includes(w)).length;
  if (overlap > 0) return Math.min(10 + overlap * 2, 18);

  return 0;
}

/**
 * Score a result based on its duration (seconds).
 *
 * 2–8 min → 25 pts, 1–2 / 8–10 min → 15 pts,
 * 30 s–1 min / 10–15 min → 8 pts, <30 s or >15 min → 0 pts.
 */
function durationScore(durationSec: number): number {
  if (durationSec < 30) return 0;
  if (durationSec < 60) return 8;
  if (durationSec < 120) return 15;
  if (durationSec <= 480) return 25; // 2–8 min
  if (durationSec <= 600) return 15;
  if (durationSec <= 900) return 8;
  return 0; // >15 min
}

/**
 * Bonus for "topic" channels (auto-generated / official music channels).
 *
 * Channel detected via thumbnail URL pattern or title heuristic.
 */
function channelScore(result: { title: string; artist: string }): number {
  const title = result.title.toLowerCase();
  if (title.includes(' - topic') || title.includes('vevo')) return 20;
  // Artist name often appears as channel — treat as quality signal
  if (result.artist && result.artist.length > 0) return 10;
  return 0;
}

/**
 * Popularity proxy — use playCount when available.
 */
function popularityScore(result: { playCount?: number }): number {
  if (!result.playCount) return 0;
  const v = result.playCount;
  if (v > 1_000_000) return 15;
  if (v > 100_000) return 12;
  if (v > 10_000) return 8;
  if (v > 1_000) return 4;
  return 0;
}

/** Total ranking score for a search result. */
function rankScore(result: { title: string; artist: string; duration: number; playCount?: number }, query: string): number {
  const titleScore_ = titleMatchScore(result.title, query);
  const durScore = durationScore(result.duration);
  const chanScore = channelScore(result);
  const popScore = popularityScore(result);
  return titleScore_ + durScore + chanScore + popScore;
}

// ---------------------------------------------------------------------------
// QueryEngine
// ---------------------------------------------------------------------------

export class QueryEngine {
  /** Default debounce delay in ms. */
  private debounceMs = 150;

  /** In-memory cache keyed by normalised query string. */
  private cache = new Map<string, CacheEntry>();

  /** Cache time-to-live in milliseconds (55 minutes). */
  private readonly cacheTtlMs = 55 * 60 * 1000;

  /** Current pending search (for abort support). */
  private pendingController: AbortController | null = null;

  /** Debounce timer id. */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Set the debounce delay in milliseconds (default 150).
   * @param ms - Milliseconds to wait before firing search.
   */
  setDebounceMs(ms: number): void {
    this.debounceMs = Math.max(0, ms);
  }

  /**
   * Search YouTube for tracks matching `query`.
   *
   * Results are cached for 55 minutes and ranked by title match, duration,
   * channel quality, and popularity. Previous in-flight searches are aborted
   * when a new search starts.
   *
   * @param query  - Free-text search string.
   * @param limit  - Maximum number of results (default 10).
   * @returns      - Ranked array of `Track` objects.
   */
  async search(query: string, limit: number = 10): Promise<Track[]> {
    const normalised = this.normalise(query);

    // Abort any in-flight search
    this.abortPending();

    // Fast-path: empty query
    if (!normalised) return [];

    // Check cache
    const cached = this.getFromCache(normalised);
    if (cached) return cached;

    // Perform search (with debounce when called rapidly)
    return this.executeSearch(normalised, limit);
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /** Normalise a query string for caching / comparison. */
  private normalise(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /** Abort the previous pending search if one exists. */
  private abortPending(): void {
    if (this.pendingController) {
      this.pendingController.abort();
      this.pendingController = null;
    }
  }

  /** Retrieve cached results if still valid, otherwise remove stale entry. */
  private getFromCache(key: string): Track[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.tracks;
  }

  /** Store results in the in-memory cache. */
  private setCache(key: string, tracks: Track[]): void {
    // Evict oldest entry when cache grows beyond 200
    if (this.cache.size > 200) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      tracks,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  /**
   * Execute the actual YouTube search, rank results, and cache them.
   *
   * Uses a debounce wrapper so rapid successive calls only fire once.
   */
  private async executeSearch(query: string, limit: number): Promise<Track[]> {
    // Debounce: if a timer is already pending, wait for it
    if (this.debounceMs > 0) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      await new Promise<void>((resolve) => {
        this.debounceTimer = setTimeout(resolve, this.debounceMs);
      });
    }

    const controller = new AbortController();
    this.pendingController = controller;

    try {
      const results: SearchResult[] = await ipc.search.searchYouTube(query, limit * 2);

      // If we were aborted, return empty — the newer call will take over
      if (controller.signal.aborted) return [];

      const ranked = results
        .map((r) => this.searchResultToTrack(r))
        .sort((a, b) => {
          // Sort by score descending — recompute inline to avoid storing
          const scoreA =
            titleMatchScore(a.title, query) +
            durationScore(a.duration) +
            channelScore(a) +
            popularityScore(a);
          const scoreB =
            titleMatchScore(b.title, query) +
            durationScore(b.duration) +
            channelScore(b) +
            popularityScore(b);
          return scoreB - scoreA;
        })
        .slice(0, limit);

      this.setCache(query, ranked);
      return ranked;
    } catch (err) {
      // AbortError is expected when a newer search supersedes this one
      if (err instanceof DOMException && err.name === 'AbortError') return [];
      console.error('[QueryEngine] search failed:', err);
      return [];
    } finally {
      if (this.pendingController === controller) {
        this.pendingController = null;
      }
    }
  }

  /** Convert a raw `SearchResult` to the app's `Track` shape. */
  private searchResultToTrack(result: SearchResult): Track {
    return {
      id: result.id,
      youtubeId: result.id,
      title: result.title,
      artist: result.artist,
      album: '',
      duration: result.duration,
      thumbnail: result.thumbnail,
      path: '',
      source: 'youtube',
      isFavorite: false,
      playCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

/** Singleton instance of the query engine. */
export const queryEngine = new QueryEngine();
