/**
 * QueueEngine — pure queue data structure. No playback decisions.
 *
 * Manages an ordered queue of tracks with mutation operations.
 * Navigation (next/previous) is owned by MediaEngine.
 *
 * @module engine/queueEngine
 */

import type { Track } from '@/types';

export type RepeatMode = "off" | "all" | "one";

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

export class QueueEngine {
  private queue: Track[] = [];
  private queueIndex = -1;
  private queueHistory: Track[] = [];
  private repeatMode: RepeatMode = "off";
  private shuffleEnabled = false;
  private autoDedup = true;

  // -----------------------------------------------------------------------
  // Queue setup
  // -----------------------------------------------------------------------

  setQueue(tracks: Track[], startIndex = 0): void {
    this.queue = [...tracks];
    this.queueIndex = this.clampIndex(startIndex);
  }

  // -----------------------------------------------------------------------
  // Current track
  // -----------------------------------------------------------------------

  getCurrentTrack(): Track | null {
    if (this.queue.length === 0 || this.queueIndex < 0) return null;
    return this.queue[this.queueIndex] ?? null;
  }

  // -----------------------------------------------------------------------
  // Queue mutation
  // -----------------------------------------------------------------------

  add(track: Track): void {
    if (this.autoDedup && this.queue.some((t) => t.id === track.id)) return;
    this.queue.push({ ...track });
  }

  playNext(track: Track): void {
    const insertAt = this.queueIndex >= 0 ? this.queueIndex + 1 : this.queue.length;
    this.queue.splice(insertAt, 0, { ...track });
  }

  remove(index: number): void {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    if (this.queue.length === 0) {
      this.queueIndex = -1;
    } else if (index < this.queueIndex) {
      this.queueIndex -= 1;
    } else if (index === this.queueIndex) {
      this.queueIndex = Math.min(this.queueIndex, this.queue.length - 1);
    }
  }

  reorder(from: number, to: number): void {
    if (from === to || from < 0 || from >= this.queue.length || to < 0 || to >= this.queue.length) return;
    const [moved] = this.queue.splice(from, 1);
    this.queue.splice(to, 0, moved);
    if (from === this.queueIndex) {
      this.queueIndex = to;
    } else if (from < this.queueIndex && to >= this.queueIndex) {
      this.queueIndex -= 1;
    } else if (from > this.queueIndex && to <= this.queueIndex) {
      this.queueIndex += 1;
    }
  }

  clear(): void {
    this.queue = [];
    this.queueIndex = -1;
  }

  // -----------------------------------------------------------------------
  // Shuffle & Repeat
  // -----------------------------------------------------------------------

  setShuffle(enabled: boolean): void {
    this.shuffleEnabled = enabled;
    if (!enabled || this.queue.length <= 1) return;

    const currentTrack = this.getCurrentTrack();
    const remaining = this.queue.filter((_, i) => i !== this.queueIndex);
    this.fisherYates(remaining);
    this.queue = currentTrack ? [currentTrack, ...remaining] : remaining;
    this.queueIndex = currentTrack ? 0 : -1;
  }

  setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
  }

  // -----------------------------------------------------------------------
  // Dedup
  // -----------------------------------------------------------------------

  setAutoDedup(enabled: boolean): void {
    this.autoDedup = enabled;
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  recordHistory(track: Track): void {
    this.queueHistory.unshift({ ...track });
    if (this.queueHistory.length > HISTORY_LIMIT) {
      this.queueHistory.length = HISTORY_LIMIT;
    }
  }

  getHistory(): Track[] {
    return [...this.queueHistory];
  }

  clearHistory(): void {
    this.queueHistory = [];
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

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

  get queueLength(): number {
    return this.queue.length;
  }

  get currentIndex(): number {
    return this.queueIndex;
  }

  /** Get track at index without side effects. Used by MediaEngine for navigation. */
  getTrackAt(index: number): Track | null {
    if (index < 0 || index >= this.queue.length) return null;
    return this.queue[index] ?? null;
  }

  /** Set the queue index directly (used by MediaEngine for navigation). */
  setIndex(index: number): void {
    this.queueIndex = this.clampIndex(index);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private clampIndex(index: number): number {
    if (this.queue.length === 0) return -1;
    return Math.max(0, Math.min(index, this.queue.length - 1));
  }

  private fisherYates(arr: Track[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

/** Singleton QueueEngine instance. */
export const queueEngine = new QueueEngine();
