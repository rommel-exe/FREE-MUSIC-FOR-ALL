/**
 * PrefetchEngine — Pre-resolves MediaSources for upcoming tracks.
 *
 * Delegates to the `mediaResolver` service (which talks to the electron
 * MediaResolver through IPC). Maintains a local cache of resolved
 * MediaSources so that when the player advances to the next track the
 * audio URL is already available.
 */

import type { Track, MediaSource } from '@/types';
import { mediaResolver } from '@/services/mediaResolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrefetchEntry {
  /** The resolved MediaSource (or null while pending). */
  source: MediaSource | null;
  /** Whether the promise has resolved. */
  resolved: boolean;
}

// ---------------------------------------------------------------------------
// PrefetchEngine
// ---------------------------------------------------------------------------

export class PrefetchEngine {
  /** videoId → PrefetchEntry */
  private cache = new Map<string, PrefetchEntry>();

  /** Number of prefetches currently in flight. */
  private inFlight = 0;

  /** Maximum concurrent prefetch requests. */
  private readonly maxConcurrent = 2;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Prefetch MediaSources for upcoming tracks.
   *
   * Starting from `currentIndex + 1`, up to `count` tracks (default 2)
   * will have their MediaSources resolved in advance. Already-cached
   * entries are skipped and concurrency is capped at 2.
   *
   * @param tracks       - Ordered list of tracks (e.g. the current queue).
   * @param currentIndex - Index of the currently playing track.
   * @param count        - How many upcoming tracks to prefetch (default 2).
   */
  prefetch(tracks: Track[], currentIndex: number, count = 2): void {
    const start = currentIndex + 1;
    const end = Math.min(start + count, tracks.length);

    for (let i = start; i < end; i++) {
      const track = tracks[i];
      if (!track?.youtubeId) continue;

      this.enqueue(track.youtubeId);
    }
  }

  /**
   * Get a previously prefetched MediaSource.
   *
   * @param videoId - YouTube video ID.
   * @returns       - The resolved MediaSource, or `null` if not cached.
   */
  getSource(videoId: string): MediaSource | null {
    const entry = this.cache.get(videoId);
    if (!entry || !entry.resolved) return null;
    return entry.source;
  }

  /**
   * Clear all prefetched sources and reset state.
   */
  clear(): void {
    this.cache.clear();
    this.inFlight = 0;
  }

  /**
   * Number of entries currently cached (resolved or pending).
   */
  get size(): number {
    return this.cache.size;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Enqueue a single video ID for prefetching.
   * Skips if already cached or at concurrency limit.
   */
  private enqueue(videoId: string): void {
    // Already cached (pending or resolved)
    if (this.cache.has(videoId)) return;

    // At concurrency limit — skip silently
    if (this.inFlight >= this.maxConcurrent) return;

    const entry: PrefetchEntry = {
      source: null,
      resolved: false,
    };

    this.cache.set(videoId, entry);
    this.fetchSource(videoId, entry);
  }

  /**
   * Fetch the MediaSource for a single video ID via mediaResolver.
   * Updates the entry in-place as the promise settles.
   */
  private async fetchSource(videoId: string, entry: PrefetchEntry): Promise<void> {
    this.inFlight++;

    try {
      const source = await mediaResolver.resolve(videoId);
      entry.source = source;
      entry.resolved = true;
    } catch (err) {
      console.warn(`[PrefetchEngine] error for ${videoId}:`, err);
      entry.source = null;
      entry.resolved = true;
    } finally {
      this.inFlight--;
    }
  }
}

/** Singleton instance of the prefetch engine. */
export const prefetchEngine = new PrefetchEngine();
