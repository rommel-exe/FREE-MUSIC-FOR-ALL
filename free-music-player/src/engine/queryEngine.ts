/**
 * QueryEngine — Search query engine with caching and debounce.
 *
 * Normalises queries, checks an in-memory TTL cache, calls the IPC YouTube
 * search bridge, and returns `Track[]` results.
 *
 * Ranking is delegated to the electron-side `rankSearchResults()` which has
 * full access to title + artist fields and content-type signals. The
 * results from IPC arrive pre-ranked — QueryEngine does NOT re-rank them.
 */

import type { Track, SearchResult } from '@/types';
import { ipc } from '@/utils/ipc';

/**
 * Minimum trust score threshold for search results.
 * Results below this score are discarded entirely.
 */
const TRUST_SCORE_THRESHOLD = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CacheEntry {
  tracks: Track[];
  expiresAt: number;
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
   * Results are cached for 55 minutes. Ranking is handled by the electron
   * side (`rankSearchResults` which is artist-aware and applies content-type
   * signals). Previous in-flight searches are aborted when a new search starts.
   *
   * @param query  - Free-text search string.
   * @param limit  - Maximum number of results (default 10).
   * @returns      - Array of `Track` objects in rank order.
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
   * Execute the actual YouTube search and cache results.
   *
   * Uses a debounce wrapper so rapid successive calls only fire once.
   * Ranking is delegated to the electron-side `rankSearchResults`.
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

      // Results from the IPC search have already passed the trust score engine
      // (search.ts computeTrustScore + score >= 80 filter). Take the top `limit`
      // results and display them immediately.
      const ranked = results
        .map((r) => this.searchResultToTrack(r))
        .slice(0, limit);

      this.setCache(query, ranked);

      // Fire-and-forget: trigger background verification (yt-dlp --dump-json)
      // so the verification cache is populated before the user clicks play.
      // This is completely invisible to the user.
      this.verifyInBackground(results.slice(0, limit)).catch(() => {});

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

  /**
   * Trigger background verification for search results.
   * Runs asynchronously so the UI is never blocked.
   * Results are cached in the SQLite verification table on the main process.
   */
  private async verifyInBackground(results: SearchResult[]): Promise<void> {
    try {
      await ipc.search.verify(results.map(r => ({ id: r.id, title: r.title, artist: r.artist })));
    } catch {
      // Background verification is best-effort — never block the UI
    }
  }
}

/** Singleton instance of the query engine. */
export const queryEngine = new QueryEngine();
