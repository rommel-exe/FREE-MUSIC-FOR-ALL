/**
 * MusicEngine — Top-level orchestrator that composes all engine modules
 * and services into a single, unified API surface for the UI layer.
 *
 * Architecture:
 *   UI Layer (React)
 *     ↓
 *   MusicEngine (this)
 *     ↓
 *   Engines: queue, playback, prefetch, recommendation, query, cache
 *     ↓
 *   Services: mediaResolver, ytmusic (via ipc)
 *     ↓
 *   Electron IPC → MediaResolver → yt-dlp
 */

export { cacheEngine, LRUCache } from './cacheEngine';
export { rankingEngine } from './rankingEngine';
export { queryEngine, QueryEngine } from './queryEngine';
export { queueEngine, QueueEngine } from './queueEngine';
export { playbackController, PlaybackController } from './playbackController';
export { prefetchEngine, PrefetchEngine } from './prefetchEngine';
export { recommendationEngine, RecommendationEngine } from './recommendationEngine';

import { queryEngine } from './queryEngine';
import { queueEngine } from './queueEngine';
import { playbackController } from './playbackController';
import { prefetchEngine } from './prefetchEngine';
import { recommendationEngine } from './recommendationEngine';
import type { Track } from '@/types';

/**
 * Unified MusicEngine facade.
 *
 * Single entry point to all engine functionality:
 * - `search` — query YouTube with caching and ranking
 * - `queue`  — Spotify-like queue management
 * - `playback` — playback state machine
 * - `prefetch` — pre-resolve upcoming track MediaSources
 * - `recommendation` — local recommendations from listening history
 */
class MusicEngine {
  /** Search query engine with cache + ranking. */
  readonly search = queryEngine;

  /** Queue management engine. */
  readonly queue = queueEngine;

  /** Playback state machine. */
  readonly playback = playbackController;

  /** Prefetch engine for upcoming tracks. */
  readonly prefetch = prefetchEngine;

  /** Recommendation engine. */
  readonly recommendation = recommendationEngine;

  /**
   * Convenience: play a list of tracks starting from an index.
   * Sets the queue, starts playback, records the play, and triggers
   * prefetch for the next 2 tracks.
   */
  playTracks(tracks: Track[], startIndex = 0): void {
    this.queue.setQueue(tracks, startIndex);

    const current = this.queue.getCurrentTrack();
    if (current) {
      this.playback.play(current);
      this.recommendation.recordPlay(current);
      this.prefetch.prefetch(tracks, startIndex);
    }
  }

  /**
   * Convenience: play a single track (without replacing the queue).
   */
  playTrack(track: Track): void {
    this.playback.play(track);
    this.recommendation.recordPlay(track);
  }

  /**
   * Convenience: advance to next track and prefetch ahead.
   */
  nextTrack(): Track | null {
    const next = this.queue.next();
    if (next) {
      this.playback.play(next);
      this.recommendation.recordPlay(next);
      const state = this.queue.getState();
      this.prefetch.prefetch(state.queue, state.queueIndex);
    } else {
      this.playback.pause();
    }
    return next;
  }

  /**
   * Convenience: go to previous track.
   */
  previousTrack(elapsed = 0): Track | null {
    const prev = this.queue.previous(elapsed);
    if (prev) {
      this.playback.play(prev);
      this.recommendation.recordPlay(prev);
    }
    return prev;
  }
}

/** Singleton MusicEngine instance. */
export const musicEngine = new MusicEngine();
