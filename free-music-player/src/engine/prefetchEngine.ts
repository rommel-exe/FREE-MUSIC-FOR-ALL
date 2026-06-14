/**
 * PrefetchEngine — Pre-resolves MediaSources for upcoming tracks
 * with adaptive, progress-triggered prefetching.
 *
 * Delegates to the `mediaResolver` service (which talks to the electron
 * MediaResolver through IPC). Maintains a local cache of resolved
 * MediaSources so that when the player advances to the next track the
 * audio URL is already available.
 */

import type { Track, MediaSource } from '@/types';
import { mediaResolver } from '@/services/mediaResolver';
import { ipc } from '@/utils/ipc';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum concurrent prefetch requests. */
const MAX_CONCURRENT = 4;

/** Default number of upcoming tracks to prefetch on track change. */
const DEFAULT_PREFETCH_COUNT = 5;

/**
 * When the current track's remaining time (in seconds) drops below this
 * threshold, an additional burst of prefetches is triggered.
 */
const NEAR_END_THRESHOLD_SEC = 45;

/** How many additional tracks to burst-fetch when near the end. */
const NEAR_END_BURST_COUNT = 3;

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
  /** videoId -> PrefetchEntry */
  private cache = new Map<string, PrefetchEntry>();

  /** Number of prefetches currently in flight. */
  private inFlight = 0;

  /** Maximum concurrent prefetch requests. */
  private readonly maxConcurrent = MAX_CONCURRENT;

  /** Set of videoIds that have already triggered the near-end burst. */
  private nearEndTriggered = new Set<string>();

  /** The videoId of the most-recently-tracked "current track" for dedup. */
  private lastTrackVideoId: string | null = null;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Prefetch MediaSources for upcoming tracks.
   *
   * Starting from `currentIndex + 1`, up to `count` tracks will have their
   * MediaSources resolved in advance. Already-cached entries are skipped
   * and concurrency is capped at `maxConcurrent`.
   *
   * @param tracks       - Ordered list of tracks (e.g. the current queue).
   * @param currentIndex - Index of the currently playing track.
   * @param count        - How many upcoming tracks to prefetch (default 5).
   */
  prefetch(tracks: Track[], currentIndex: number, count = DEFAULT_PREFETCH_COUNT): void {
    const start = currentIndex + 1;
    const end = Math.min(start + count, tracks.length);

    // Collect videoIds that need prefetching
    const videoIds: string[] = [];
    for (let i = start; i < end; i++) {
      const track = tracks[i];
      if (!track?.youtubeId) continue;
      if (!this.cache.has(track.youtubeId)) {
        videoIds.push(track.youtubeId);
      }
    }

    // Use batch prefetch for multiple tracks (single IPC round-trip)
    if (videoIds.length > 1) {
      this.prefetchBatch(videoIds);
    } else if (videoIds.length === 1) {
      this.enqueue(videoIds[0]);
    }
  }

  /**
   * Batch prefetch multiple videoIds via single IPC call.
   * Runs on main process in parallel, avoiding N IPC round-trips.
   */
  private async prefetchBatch(videoIds: string[]): Promise<void> {
    try {
      const results = await ipc.stream.prefetchBatch(videoIds);
      for (const { videoId, ok } of results) {
        if (ok) {
          // Mark as resolved in local cache (actual source will be fetched on demand)
          const entry = this.cache.get(videoId);
          if (entry) {
            entry.resolved = true;
          }
        }
      }
    } catch (err) {
      console.warn('[PrefetchEngine] batch prefetch failed:', err);
      // Fallback to individual prefetch
      for (const videoId of videoIds) {
        this.enqueue(videoId);
      }
    }
  }

  /**
   * Adaptive prefetch triggered by playback progress.
   *
   * Call this on every progress tick (e.g. from the 100ms progress poller).
   * When the current track is within ~45s of finishing, an extra burst of
   * prefetches fires to ensure upcoming tracks are resolved well in advance.
   *
   * This is a no-op the rest of the time, so it's safe to call frequently.
   *
   * @param tracks        - Ordered list of tracks (the current queue).
   * @param currentIndex  - Index of the currently playing track.
   * @param currentTime   - Current playback position in seconds.
   * @param duration      - Total duration of the current track in seconds.
   */
  prefetchOnProgress(
    tracks: Track[],
    currentIndex: number,
    currentTime: number,
    duration: number,
  ): void {
    const currentTrack = tracks[currentIndex];
    if (!currentTrack?.youtubeId) return;

    // Track if a new track started playing since the last call
    if (currentTrack.youtubeId !== this.lastTrackVideoId) {
      this.nearEndTriggered.clear();
      this.lastTrackVideoId = currentTrack.youtubeId;
      // Fire an immediate prefetch for the next batch on track change
      this.prefetch(tracks, currentIndex, DEFAULT_PREFETCH_COUNT);
      return;
    }

    // Only act when duration is known and we're near the end
    if (duration <= 0 || currentTime <= 0) return;

    const remaining = duration - currentTime;

    // Has the near-end burst already fired for this track?
    if (this.nearEndTriggered.has(currentTrack.youtubeId)) return;

    if (remaining <= NEAR_END_THRESHOLD_SEC) {
      this.nearEndTriggered.add(currentTrack.youtubeId);
      // Burst-prefetch additional tracks ahead
      const additionalStart = currentIndex + 1 + DEFAULT_PREFETCH_COUNT;
      this.prefetch(tracks, additionalStart - 1, NEAR_END_BURST_COUNT);
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
    if (entry.source && entry.source.expiresAt < Date.now()) {
        this.cache.delete(videoId);
        return null;
    }
    return entry.source;
  }

  /**
   * Manually store a resolved source (used after a successful resolve
   * so the next play of the same track skips IPC entirely).
   */
  setSource(videoId: string, source: MediaSource): void {
    this.cache.set(videoId, { source, resolved: true });
  }

  /**
   * Remove a cached source for a videoId (used to force re-resolution on retry).
   */
  clearSource(videoId: string): void {
    this.cache.delete(videoId);
  }

  /**
   * Check if a videoId already has a cached entry (resolved or pending).
   */
  has(videoId: string): boolean {
    return this.cache.has(videoId);
  }

  /**
   * Clear all prefetched sources and reset state.
   */
  clear(): void {
    this.cache.clear();
    this.inFlight = 0;
    this.nearEndTriggered.clear();
    this.lastTrackVideoId = null;
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
    if (this.cache.has(videoId)) return;
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
