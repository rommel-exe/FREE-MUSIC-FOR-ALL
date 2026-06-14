/**
 * MediaEngine — single source of truth for all playback state and decisions.
 *
 * Architecture:
 *   UI (React/Zustand) → sends commands → MediaEngine
 *   MediaEngine → commands → AudioService (dumb executor)
 *   AudioService → emits events → MediaEngine (updates state)
 *   MediaEngine → emits state → playerStore (Zustand mirror)
 *
 * NEVER import this directly into UI components.
 * ALWAYS go through playerStore (read) or playerStore actions (write).
 *
 * @module engine/mediaEngine
 */

import type { Track } from '@/types';
import type { RepeatMode } from './queueEngine';
import { queueEngine } from './queueEngine';
import { AudioService } from './audioService';
import { mediaResolver } from '@/services/mediaResolver';
import { prefetchEngine } from '@/engine/prefetchEngine';
import { recommendationEngine } from '@/engine/recommendationEngine';
import { ipc } from '@/utils/ipc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngineState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;

  queue: Track[];
  queueIndex: number;
  queueHistory: Track[];
  isShuffle: boolean;
  repeatMode: RepeatMode;
  autoDedup: boolean;

  lyricsOffset: number;
  autoSyncEnabled: boolean;
  autoSyncConfidence: number;

  /** Current resolved audio URL (for lyrics alignment etc.). */
  audioUrl: string | null;
  /** YouTube ID matching the current audioUrl. */
  audioVideoId: string | null;
}

type Listener = (state: EngineState) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_WINDOW_MS = 10_000;
const PRELOAD_WINDOW_SEC = 30;

// Start preloading next track immediately when track starts playing
const PRELOAD_IMMEDIATE = true;

// ---------------------------------------------------------------------------
// MediaEngine
// ---------------------------------------------------------------------------

export class MediaEngine {
  // ── Subsystems ────────────────────────────────────────────────────
  private audio: AudioService;
  private listeners = new Set<Listener>();

  // ── State ─────────────────────────────────────────────────────────
  private _currentTrack: Track | null = null;
  private _isPlaying = false;
  private _progress = 0;
  private _duration = 0;
  private _volume = 0.8;
  private _isMuted = false;
  private _isLoading = false;

  private _lyricsOffset = 0;
  private _autoSyncEnabled = true;
  private _autoSyncConfidence = 0;

  // ── Current audio URL (for lyrics alignment etc.) ─────────────
  private _audioUrl: string | null = null;
  private _audioVideoId: string | null = null;

  // ── Circuit breaker ──────────────────────────────────────────────
  private errorCount = 0;
  private errorWindow = 0;
  private playStartTime = 0;

  // ── Track change guard ────────────────────────────────────────────
  private playGen = 0;
  private currentVideoId: string | null = null;

  // ── Progress throttling ──────────────────────────────────────────
  private lastProgressEmit = 0;
  private readonly PROGRESS_EMIT_INTERVAL_MS = 500; // Throttle to 2fps for UI

  // ── Prefetch/preload tracking ─────────────────────────────────────
  private _lastPrefetchTime = 0;
  private _preloadTriggered = false;

  /** Prevents stacked nextTrack()/previousTrack() calls from rapid error handling. */
  private _navigationInFlight = false;

  /** Tracks retry count per videoId for audio load/recovery. */
  private _retryCounts = new Map<string, number>();
  private readonly MAX_AUDIO_RETRIES = 2;

  constructor() {
    this.audio = new AudioService();
    this.setupAudioCallbacks();
  }

  // ===================================================================
  // Subscriptions
  // ===================================================================

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): EngineState {
    return {
      currentTrack: this._currentTrack,
      isPlaying: this._isPlaying,
      progress: this._progress,
      duration: this._duration,
      volume: this._isMuted ? 0 : this._volume,
      isMuted: this._isMuted,
      isLoading: this._isLoading,

      queue: queueEngine.getState().queue,
      queueIndex: queueEngine.currentIndex,
      queueHistory: queueEngine.getHistory(),
      isShuffle: queueEngine.getState().shuffle,
      repeatMode: queueEngine.getState().repeatMode,
      autoDedup: queueEngine.getState().autoDedup,

      lyricsOffset: this._lyricsOffset,
      autoSyncEnabled: this._autoSyncEnabled,
      autoSyncConfidence: this._autoSyncConfidence,

      audioUrl: this._audioUrl,
      audioVideoId: this._audioVideoId,
    };
  }

  private emit(): void {
    const state = this.getState();
    for (const fn of this.listeners) {
      try { fn(state); } catch { /* noop */ }
    }
  }

  // ===================================================================
  // Audio callbacks (called by AudioService only)
  // ===================================================================

  private setupAudioCallbacks(): void {
    this.audio.callbacks = {
      onTimeUpdate: (time) => {
        this._progress = time;

        // Throttle progress emits to avoid massive re-renders (2fps max)
        const now = Date.now();
        if (now - this.lastProgressEmit >= this.PROGRESS_EMIT_INTERVAL_MS) {
          this.lastProgressEmit = now;
          this.emit();
        }

        // Adaptive prefetch on progress (throttled to avoid excessive calls)
        const qs = queueEngine.getState();
        if (qs.queue.length > 0 && qs.queueIndex >= 0 && this._duration > 0) {
          // Only run prefetchOnProgress every 2 seconds, not every tick
          if (!this._lastPrefetchTime || now - this._lastPrefetchTime >= 2000) {
            this._lastPrefetchTime = now;
            prefetchEngine.prefetchOnProgress(qs.queue, qs.queueIndex, time, this._duration);
          }
        }

        // Preload next track immediately when track starts (if not already preloaded)
        // Also preload near end as fallback
        const remaining = this._duration - time;
        if (PRELOAD_IMMEDIATE && time < 2 && !this._preloadTriggered) {
          this._preloadTriggered = true;
          this.preloadNext();
        } else if (remaining <= PRELOAD_WINDOW_SEC && remaining > 0) {
          this.preloadNext();
        }
      },

      onEnded: () => {
        const playedMs = Date.now() - this.playStartTime;
        // Only auto-advance if the track that ended is still the current track
        // (prevents unwanted skipping when user manually changed tracks)
        if (playedMs > 2000 && this._currentTrack?.youtubeId === this.currentVideoId) {
          this.nextTrack();
        } else if (playedMs <= 2000) {
          console.warn('[MediaEngine] Premature ended event (played', playedMs, 'ms)');
        }
      },

      onLoadedMetadata: (duration) => {
        this._duration = duration;
        this._isLoading = false;
        this.emit();
      },

      onError: (errorCode) => {
        console.error('[MediaEngine] Audio error, code:', errorCode);

        // MEDIA_ERR_ABORTED (1) — user or browser aborted load, usually benign
        if (errorCode === 1) {
          this._isLoading = false;
          this.emit();
          return;
        }

        this._isLoading = false;
        this.emit();

        const errorVideoId = this.currentVideoId;
        if (!errorVideoId) return;

        // SRC_NOT_SUPPORTED (4) — URL is permanently dead, skip immediately
        if (errorCode === 4) {
          setTimeout(() => {
            if (this.currentVideoId === errorVideoId) {
              this._retryCounts.delete(errorVideoId);
              this.nextTrack();
            }
          }, 500);
          return;
        }

        // Retryable errors (NETWORK=2, DECODE=3) — retry the current track
        const retryCount = this._retryCounts.get(errorVideoId) ?? 0;
        if (retryCount < this.MAX_AUDIO_RETRIES) {
          this._retryCounts.set(errorVideoId, retryCount + 1);
          const delay = 2000 * (retryCount + 1); // 2s, 4s backoff
          console.log(`[MediaEngine] Audio error, retrying track (attempt ${retryCount + 1}/${this.MAX_AUDIO_RETRIES})`);

          setTimeout(() => {
            if (this.currentVideoId === errorVideoId && this._currentTrack) {
              this._isLoading = true;
              this.emit();
              // Clear cached source so we get a fresh URL from the resolver
              prefetchEngine.clearSource(errorVideoId);
              this.resolveAndPlay(this._currentTrack, this.playGen);
            }
          }, delay);
          return;
        }

        // All retries exhausted — skip to next track
        console.warn('[MediaEngine] All retries exhausted for track, skipping');
        const now = Date.now();
        if (now - this.errorWindow > CIRCUIT_BREAKER_WINDOW_MS) this.errorCount = 0;
        this.errorWindow = now;
        this.errorCount++;

        setTimeout(() => {
          if (this.currentVideoId === errorVideoId) {
            this._retryCounts.delete(errorVideoId);
            this.nextTrack();
          }
        }, 500);
      },

      onWaiting: () => {
        this._isLoading = true;
        this.emit();
      },

      onCanPlay: () => {
        this._isLoading = false;
        this.errorCount = 0;
        this.emit();
      },
    };
  }

  // ===================================================================
  // Playback controls
  // ===================================================================

  playTrack(track: Track): void {
    const gen = ++this.playGen;
    this.currentVideoId = track.youtubeId ?? null;

    // Update queue state
    queueEngine.setQueue([track], 0);

    this._currentTrack = track;
    this._progress = 0;
    this._duration = track.duration ?? 0;
    this._isPlaying = true;
    this._isLoading = true;
    this._preloadTriggered = false;

    // IMMEDIATELY pause current audio so old track doesn't keep playing
    // during async resolution.
    this.audio.pause();

    this.emit();

    this.resolveAndPlay(track, gen);
    recommendationEngine.recordPlay(track);
    this.prefetchCurrent();
    this.saveSession();
  }

  playTracks(tracks: Track[], startIndex = 0): void {
    if (tracks.length === 0) return;
    const gen = ++this.playGen;
    queueEngine.setQueue(tracks, startIndex);

    const track = queueEngine.getCurrentTrack();
    if (!track) return;

    this.currentVideoId = track.youtubeId ?? null;
    this._currentTrack = track;
    this._progress = 0;
    this._duration = track.duration ?? 0;
    this._isPlaying = true;
    this._isLoading = true;
    this._preloadTriggered = false;

    // IMMEDIATELY pause current audio so old track doesn't keep playing
    // during async resolution.
    this.audio.pause();

    this.emit();

    this.resolveAndPlay(track, gen);
    recommendationEngine.recordPlay(track);
    prefetchEngine.prefetch(tracks, startIndex);
    this.saveSession();
  }

  playFromQueue(index: number): void {
    const track = queueEngine.getTrackAt(index);
    if (!track) return;

    queueEngine.setIndex(index);
    this.playTrackInternal(track, ++this.playGen);
  }

  togglePlay(): void {
    if (this._isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  pause(): void {
    this._isPlaying = false;
    this.audio.pause();
    this.emit();
    this.saveSession();
  }

  resume(): void {
    if (this._isPlaying) return;

    // If nothing loaded, re-load current track
    if (!this.audio.active.src) {
      if (this._currentTrack?.youtubeId) {
        this._isLoading = true;
        this.emit();
        this.resolveAndPlay(this._currentTrack, ++this.playGen);
        return;
      }
      // Current track has no youtubeId — skip to next playable track
      this.nextTrack();
      return;
    }

    this._isPlaying = true;
    this.audio.play();
    this.emit();
    this.saveSession();
  }

  seek(time: number): void {
    const clamped = Math.max(0, Math.min(time, this._duration));
    this._progress = clamped;
    this.audio.seek(clamped);
    this.emit();
  }

  // ===================================================================
  // Volume
  // ===================================================================

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._volume > 0 && this._isMuted) {
      this._isMuted = false;
    }
    this.audio.setVolume(this._volume);
    this.emit();
    this.saveSession();
  }

  toggleMute(): void {
    this._isMuted = !this._isMuted;
    this.audio.setVolume(this._isMuted ? 0 : this._volume);
    this.emit();
    this.saveSession();
  }

  // ===================================================================
  // Navigation
  // ===================================================================

  nextTrack(): void {
    if (this._navigationInFlight) return;
    this._navigationInFlight = true;
    try {
      const qs = queueEngine.getState();

      // Repeat-one: restart the current track
      if (qs.repeatMode === 'one' && this._currentTrack) {
        this.seek(0);
        return;
      }

      const nextIndex = qs.queueIndex + 1;

      if (nextIndex >= qs.queue.length) {
        if (qs.repeatMode === 'all') {
          queueEngine.setIndex(0);
        } else {
          // End of queue — stop
          this._isPlaying = false;
          this._currentTrack = null;
          this.currentVideoId = null;
          this.audio.pause();
          this.emit();
          this.saveSession();
          return;
        }
      } else {
        queueEngine.setIndex(nextIndex);
      }

      const next = queueEngine.getCurrentTrack();
      if (next) {
        queueEngine.recordHistory(next);
        this.playTrackInternal(next, ++this.playGen);
        recommendationEngine.recordPlay(next);
        prefetchEngine.prefetch(qs.queue, queueEngine.currentIndex);
        this.saveSession();
      }
    } finally {
      this._navigationInFlight = false;
    }
  }

  previousTrack(): void {
    if (this._navigationInFlight) return;
    this._navigationInFlight = true;
    try {
      const qs = queueEngine.getState();
      const prevIndex = qs.queueIndex - 1;

      if (prevIndex < 0) {
        queueEngine.setIndex(qs.queue.length - 1);
      } else {
        queueEngine.setIndex(prevIndex);
      }

      const prev = queueEngine.getCurrentTrack();
      if (prev) {
        queueEngine.recordHistory(prev);
        this.playTrackInternal(prev, ++this.playGen);
        recommendationEngine.recordPlay(prev);
        this.saveSession();
      }
    } finally {
      this._navigationInFlight = false;
    }
  }

  // ===================================================================
  // Queue management
  // ===================================================================

  addToQueue(track: Track): void {
    queueEngine.add(track);
    this.emit();
  }

  playNextInQueue(track: Track): void {
    queueEngine.playNext(track);
    this.emit();
  }

  removeFromQueue(index: number): void {
    queueEngine.remove(index);
    this.emit();
  }

  reorderQueue(from: number, to: number): void {
    queueEngine.reorder(from, to);
    this.emit();
  }

  clearQueue(): void {
    queueEngine.clear();
    this._currentTrack = null;
    this._isPlaying = false;
    this.currentVideoId = null;
    this.audio.pause();
    this.emit();
    this.saveSession();
  }

  // ===================================================================
  // Shuffle & Repeat
  // ===================================================================

  toggleShuffle(): void {
    const qs = queueEngine.getState();
    queueEngine.setShuffle(!qs.shuffle);
    this.emit();
    this.saveSession();
  }

  cycleRepeat(): void {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const current = queueEngine.getState().repeatMode;
    const next = modes[(modes.indexOf(current) + 1) % 3];
    queueEngine.setRepeatMode(next);
    this.emit();
    this.saveSession();
  }

  toggleAutoDedup(): void {
    const qs = queueEngine.getState();
    queueEngine.setAutoDedup(!qs.autoDedup);
    this.emit();
    this.saveSession();
  }

  // ===================================================================
  // Lyrics
  // ===================================================================

  adjustLyricsOffset(delta: number): void {
    this._lyricsOffset += delta;
    this.emit();
  }

  resetLyricsOffset(): void {
    this._lyricsOffset = 0;
    this.emit();
  }

  setLyricsOffset(offset: number): void {
    this._lyricsOffset = offset;
    this.emit();
  }

  toggleAutoSync(): void {
    this._autoSyncEnabled = !this._autoSyncEnabled;
    this.emit();
  }

  setAutoSyncConfidence(confidence: number): void {
    this._autoSyncConfidence = Math.max(0, Math.min(1, confidence));
    this.emit();
  }

  // ===================================================================
  // Session persistence
  // ===================================================================

  async restoreSession(): Promise<void> {
    try {
      const session = await ipc.settings.getSession();
      if (!session) return;

      queueEngine.setAutoDedup(session.autoDedup ?? true);
      queueEngine.setRepeatMode(session.repeatMode ?? 'off');
      if (session.queue?.length) {
        queueEngine.setQueue(session.queue, session.queueIndex ?? 0);
      }
      this._volume = session.volume ?? 0.8;
      this.emit();

      if (session.currentTrack && session.wasPlaying) {
        this.playTrack(session.currentTrack);
      }
    } catch (err) {
      console.error('[MediaEngine] Failed to restore session:', err);
    }
  }

  private sessionSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  private saveSession(): void {
    if (this.sessionSaveTimeout) clearTimeout(this.sessionSaveTimeout);
    this.sessionSaveTimeout = setTimeout(() => {
      ipc.settings.saveSession({
        currentTrack: this._currentTrack,
        wasPlaying: this._isPlaying,
        volume: this._volume,
        isShuffle: queueEngine.getState().shuffle,
        repeatMode: queueEngine.getState().repeatMode,
        queue: queueEngine.getState().queue,
        queueIndex: queueEngine.currentIndex,
        queueHistory: queueEngine.getHistory(),
        autoDedup: queueEngine.getState().autoDedup,
      }).catch(() => {});
    }, 1000);
  }

  // ===================================================================
  // Internal: track playback
  // ===================================================================

  private playTrackInternal(track: Track, gen: number): void {
    // Clear retry counts for any previous track
    this._retryCounts.clear();

    this.currentVideoId = track.youtubeId ?? null;
    this._currentTrack = track;
    this._progress = 0;
    this._duration = track.duration ?? 0;
    this._isPlaying = true;
    this._isLoading = true;
    this._preloadTriggered = false; // Reset for new track

    // IMMEDIATELY pause current audio so old track doesn't keep playing
    // during async resolution. This fixes the 10s delay when switching tracks.
    this.audio.pause();

    this.emit();

    this.resolveAndPlay(track, gen);
  }

  /**
   * Pre-resolve tracks in the background so they play instantly on click.
   * Uses batch IPC to resolve multiple videoIds in parallel on the main process.
   * Results are cached in both main process and local PrefetchEngine.
   */
  prefetchTracks(tracks: Track[]): void {
    const videoIds = tracks
      .map((t) => t.youtubeId)
      .filter((id): id is string => !!id && !prefetchEngine.has(id));

    if (videoIds.length === 0) return;

    // Fire-and-forget batch prefetch on the main process
    ipc.stream.prefetchBatch(videoIds).then((results) => {
      // After resolution, each resolved track needs its full MediaSource
      // We can't cache locally without the audio URL, but the main process
      // has it cached now so the next resolve() is instant.
      for (const { videoId, ok } of results) {
        if (!ok) continue;
        // Mark as pending-resolved in local cache — resolveAndPlay will
        // fall through to mediaResolver.resolve which hits main process cache
      }
    }).catch(() => {});
  }

  private async resolveAndPlay(track: Track, gen: number): Promise<void> {
    const videoId = track.youtubeId;
    if (!videoId) {
      console.warn('[MediaEngine] Cannot play track without youtubeId:', track.title, track.artist);
      // Clean up the loading/playing state set by playTrack() / playTracks() —
      // otherwise the play button gets stuck in "loading" forever.
      this._isLoading = false;
      this._isPlaying = false;
      this.currentVideoId = null;
      this.emit();
      // Auto-skip to the next track that has a youtubeId
      setTimeout(() => this.nextTrack(), 100);
      return;
    }

    // If same track is already loaded and playing, just restart it (prevents double-play)
    if (this.audio.loadedVideoId === videoId && this._isPlaying && this.audio.active.src) {
      this.audio.seek(0);
      this._progress = 0;
      this._isLoading = false;
      this.playStartTime = Date.now();
      this.emit();
      return;
    }

    // Check if standby has this track preloaded (gapless)
    if (this.audio.preloadedVideoId === videoId && this.audio.isStandbyReady) {
      this.audio.swapActive();
      this._audioVideoId = videoId;
      this._isLoading = false;
      this.emit();
      this.audio.play();
      this.playStartTime = Date.now();
      setTimeout(() => { this.errorCount = 0; }, 5000);
      return;
    }

    let source = prefetchEngine.getSource(videoId);
    if (!source) {
      source = await mediaResolver.resolve(videoId, {
        artist: track.artist,
        title: track.title,
        expectedDuration: track.duration,
        trackId: track.id,
      });
    }

    // Check if track changed while resolving
    if (gen !== this.playGen || this.currentVideoId !== videoId) return;

    if (!source) {
      console.error('[MediaEngine] Failed to resolve media for:', videoId);

      // Retry resolution with backoff before giving up
      const retryCount = this._retryCounts.get(videoId) ?? 0;
      if (retryCount < this.MAX_AUDIO_RETRIES) {
        this._retryCounts.set(videoId, retryCount + 1);
        const delay = 2000 * (retryCount + 1); // 2s, 4s backoff
        console.log(`[MediaEngine] Retrying resolution (attempt ${retryCount + 1}/${this.MAX_AUDIO_RETRIES})`);

        setTimeout(() => {
          if (this.currentVideoId === videoId) {
            this._isLoading = true;
            this.emit();
            this.resolveAndPlay(track, gen);
          }
        }, delay);
        return;
      }

      // All retries exhausted — give up and skip
      console.warn('[MediaEngine] All resolution retries exhausted, skipping');
      this._isLoading = false;
      this._isPlaying = false;
      this.emit();

      const now = Date.now();
      if (now - this.errorWindow > CIRCUIT_BREAKER_WINDOW_MS) this.errorCount = 0;
      this.errorWindow = now;
      this.errorCount++;

      setTimeout(() => {
        if (this._currentTrack?.youtubeId === videoId) {
          this._retryCounts.delete(videoId);
          this.nextTrack();
        }
      }, 500);
      return;
    }

    // Cache resolved source locally so next play of this track skips IPC entirely
    prefetchEngine.setSource(videoId, source);

    this._audioUrl = source.audioUrl;
    this._audioVideoId = videoId;
    this.audio.load(source.audioUrl, videoId);
    this._isLoading = false;
    this.emit();

    if (this._isPlaying) {
      this.audio.play();
      this.playStartTime = Date.now();
      setTimeout(() => { this.errorCount = 0; }, 5000);
    }
  }

  private preloadNext(): void {
    const qs = queueEngine.getState();
    const nextTrack = qs.queue[qs.queueIndex + 1];
    if (!nextTrack?.youtubeId) return;
    if (nextTrack.youtubeId === this.audio.preloadedVideoId) return;

    const source = prefetchEngine.getSource(nextTrack.youtubeId);
    if (!source) {
      // Fire and forget — resolve for the next track
      mediaResolver.resolve(nextTrack.youtubeId, {
        artist: nextTrack.artist,
        title: nextTrack.title,
        expectedDuration: nextTrack.duration,
        trackId: nextTrack.id,
      }).then((resolved) => {
        if (resolved && this.audio.preloadedVideoId !== nextTrack.youtubeId) {
          this.audio.preload(resolved.audioUrl, nextTrack.youtubeId!);
        }
      }).catch(() => {});
      return;
    }

    this.audio.preload(source.audioUrl, nextTrack.youtubeId);
  }

  private prefetchCurrent(): void {
    const qs = queueEngine.getState();
    if (qs.queue.length > 0 && qs.queueIndex >= 0) {
      prefetchEngine.prefetch(qs.queue, qs.queueIndex);
    }
  }
}

/** Singleton MediaEngine instance. */
export const mediaEngine = new MediaEngine();
