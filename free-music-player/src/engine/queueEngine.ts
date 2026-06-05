/**
 * QueueEngine — Spotify-like queue management engine.
 *
 * Manages an ordered queue of tracks with navigation (next/previous),
 * shuffle, repeat modes, deduplication, and play history tracking.
 *
 * @module engine/queueEngine
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { Track } from '@/types';

/** Supported repeat modes. */
export type RepeatMode = "off" | "all" | "one";

/** Immutable snapshot of the current queue state. */
export interface QueueState {
  queue: Track[];
  queueIndex: number;
  currentTrack: Track | null;
  history: Track[];
  repeatMode: RepeatMode;
  shuffle: boolean;
  autoDedup: boolean;
}

/** Maximum number of entries kept in the play history. */
const HISTORY_LIMIT = 50;

// ---------------------------------------------------------------------------
// QueueEngine
// ---------------------------------------------------------------------------

/**
 * Spotify-like queue engine.
 *
 * Features:
 * - Ordered queue with index-based navigation
 * - Repeat modes: off, all, one
 * - Fisher-Yates shuffle that preserves the current track at position 0
 * - Optional auto-deduplication when adding tracks
 * - Play history (last 50 tracks)
 */
export class QueueEngine {
  /** Ordered list of tracks in the queue. */
  private queue: Track[] = [];

  /** Index of the currently-playing track inside `queue`. */
  private queueIndex = -1;

  /** Recently-played tracks (most-recent first, capped at 50). */
  private queueHistory: Track[] = [];

  /** Current repeat mode. */
  private repeatMode: RepeatMode = "off";

  /** Whether shuffle is enabled. */
  private shuffleEnabled = false;

  /** When true, newly-added tracks that already exist in the queue are skipped. */
  private autoDedup = true;

  // -----------------------------------------------------------------------
  // Queue setup
  // -----------------------------------------------------------------------

  /**
   * Replace the entire queue and optionally start playing from a given index.
   *
   * @param tracks  - Tracks to populate the queue with.
   * @param startIndex - Index to begin playback from (defaults to 0).
   */
  setQueue(tracks: Track[], startIndex = 0): void {
    this.queue = [...tracks];
    this.queueIndex = this.clampIndex(startIndex);
  }

  // -----------------------------------------------------------------------
  // Current track
  // -----------------------------------------------------------------------

  /**
   * Return the track at the current queue index, or `null` if the queue is
   * empty or the index is invalid.
   */
  getCurrentTrack(): Track | null {
    if (this.queue.length === 0 || this.queueIndex < 0) {
      return null;
    }
    return this.queue[this.queueIndex] ?? null;
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------

  /**
   * Advance to the next track.
   *
   * Behaviour depends on the current repeat mode:
   * - **"one"**: restarts the current track (returns the same track).
   * - **"all"**: wraps around to the beginning when at the end.
   * - **"off"**: returns `null` when there is no next track.
   *
   * @returns The next `Track` or `null` when playback should stop.
   */
  next(): Track | null {
    if (this.queue.length === 0) return null;

    // Repeat-one: stay on the same track.
    if (this.repeatMode === "one") {
      return this.getCurrentTrack();
    }

    const nextIndex = this.queueIndex + 1;

    // End of queue reached.
    if (nextIndex >= this.queue.length) {
      if (this.repeatMode === "all") {
        this.queueIndex = 0;
      } else {
        // repeat off — stop
        return null;
      }
    } else {
      this.queueIndex = nextIndex;
    }

    return this.recordAndReturn(this.getCurrentTrack());
  }

  /**
   * Go to the previous track.
   *
   * If the current track has been playing for more than 3 seconds the
   * playback restarts from the beginning instead of going backwards.
   *
   * @param currentElapsed - How many seconds the current track has been
   *                         playing for (used to decide restart vs back).
   * @returns The previous `Track` or the current one if restarted.
   */
  previous(currentElapsed = 0): Track | null {
    if (this.queue.length === 0) return null;

    // Restart current track if more than 3 s have elapsed.
    if (currentElapsed > 3) {
      return this.getCurrentTrack();
    }

    const prevIndex = this.queueIndex - 1;

    if (prevIndex < 0) {
      if (this.repeatMode === "all") {
        this.queueIndex = this.queue.length - 1;
      } else {
        // Stay at the start.
        return this.getCurrentTrack();
      }
    } else {
      this.queueIndex = prevIndex;
    }

    return this.recordAndReturn(this.getCurrentTrack());
  }

  // -----------------------------------------------------------------------
  // Queue mutation
  // -----------------------------------------------------------------------

  /**
   * Append a track to the end of the queue.
   *
   * When `autoDedup` is enabled the track is only added if no track with the
   * same `id` already exists in the queue.
   *
   * @param track - Track to add.
   */
  add(track: Track): void {
    if (this.autoDedup && this.queue.some((t) => t.id === track.id)) {
      return;
    }
    this.queue.push({ ...track });
  }

  /**
   * Insert a track immediately after the current playing track.
   *
   * The track is always inserted regardless of the dedup setting (it is an
   * explicit user action). If no track is playing, the track is appended.
   *
   * @param track - Track to insert.
   */
  playNext(track: Track): void {
    const insertAt =
      this.queueIndex >= 0 ? this.queueIndex + 1 : this.queue.length;
    this.queue.splice(insertAt, 0, { ...track });
  }

  /**
   * Remove a track from the queue by its position index.
   *
   * Adjusts the current `queueIndex` to keep the same track playing (or
   * moves to the next one if the current track is removed).
   *
   * @param index - Zero-based position to remove.
   */
  remove(index: number): void {
    if (index < 0 || index >= this.queue.length) return;

    this.queue.splice(index, 1);

    if (this.queue.length === 0) {
      this.queueIndex = -1;
    } else if (index < this.queueIndex) {
      // Removed a track before the current one — shift index back.
      this.queueIndex -= 1;
    } else if (index === this.queueIndex) {
      // Removed the current track — clamp so we don't overshoot.
      this.queueIndex = Math.min(this.queueIndex, this.queue.length - 1);
    }
    // index > queueIndex → no adjustment needed.
  }

  /**
   * Reorder a track within the queue (drag-and-drop style).
   *
   * The currently-playing track index is adjusted so that playback continuity
   * is maintained.
   *
   * @param from - Source index.
   * @param to   - Destination index.
   */
  reorder(from: number, to: number): void {
    if (
      from === to ||
      from < 0 ||
      from >= this.queue.length ||
      to < 0 ||
      to >= this.queue.length
    ) {
      return;
    }

    const [moved] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, moved);

    // Adjust queueIndex to follow the currently-playing track.
    if (from === this.queueIndex) {
      this.queueIndex = to;
    } else if (from < this.queueIndex && to >= this.queueIndex) {
      this.queueIndex -= 1;
    } else if (from > this.queueIndex && to <= this.queueIndex) {
      this.queueIndex += 1;
    }
  }

  /**
   * Clear the entire queue and reset the index.
   */
  clear(): void {
    this.queue = [];
    this.queueIndex = -1;
  }

  // -----------------------------------------------------------------------
  // Shuffle & Repeat
  // -----------------------------------------------------------------------

  /**
   * Toggle shuffle on or off.
   *
   * When enabling shuffle the current track is moved to position 0 and the
   * rest of the queue is randomised using the Fisher-Yates algorithm.
   * When disabling, the queue is left in its current order.
   *
   * @param enabled - `true` to enable shuffle, `false` to disable.
   */
  shuffle(enabled: boolean): void {
    this.shuffleEnabled = enabled;

    if (!enabled || this.queue.length <= 1) return;

    const currentTrack = this.getCurrentTrack();

    // Separate the current track so it always ends up at index 0.
    const remaining = this.queue.filter(
      (_, i) => i !== this.queueIndex,
    );

    this.fisherYates(remaining);

    this.queue = currentTrack ? [currentTrack, ...remaining] : remaining;
    this.queueIndex = currentTrack ? 0 : -1;
  }

  /**
   * Set the repeat mode.
   *
   * @param mode - One of `'off'`, `'all'`, or `'one'`.
   */
  setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
  }

  // -----------------------------------------------------------------------
  // Dedup
  // -----------------------------------------------------------------------

  /**
   * Enable or disable automatic deduplication when adding tracks.
   *
   * @param enabled - `true` to prevent duplicate tracks in the queue.
   */
  setAutoDedup(enabled: boolean): void {
    this.autoDedup = enabled;
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /**
   * Return a full snapshot of the current queue state.
   *
   * The returned object is a shallow copy — mutations will not affect the
   * engine.
   */
  getState(): QueueState {
    return {
      queue: [...this.queue],
      queueIndex: this.queueIndex,
      currentTrack: this.getCurrentTrack(),
      history: [...this.queueHistory],
      repeatMode: this.repeatMode,
      shuffle: this.shuffleEnabled,
      autoDedup: this.autoDedup,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Push a track onto the play history (most-recent first) and cap the list
   * at `HISTORY_LIMIT` entries.
   */
  private recordHistory(track: Track): void {
    this.queueHistory.unshift({ ...track });
    if (this.queueHistory.length > HISTORY_LIMIT) {
      this.queueHistory.length = HISTORY_LIMIT;
    }
  }

  /**
   * Record the given track in history and return it.
   * Returns `null` if the track is `null`.
   */
  private recordAndReturn(track: Track | null): Track | null {
    if (track) {
      this.recordHistory(track);
    }
    return track;
  }

  /**
   * Clamp an index to valid bounds within the current queue.
   */
  private clampIndex(index: number): number {
    if (this.queue.length === 0) return -1;
    return Math.max(0, Math.min(index, this.queue.length - 1));
  }

  /**
   * In-place Fisher-Yates (Knuth) shuffle.
   *
   * @see https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
   */
  private fisherYates(arr: Track[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Singleton `QueueEngine` instance. */
export const queueEngine = new QueueEngine();
