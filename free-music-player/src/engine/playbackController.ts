/**
 * PlaybackController — audio playback state machine with event system.
 *
 * Manages play/pause/resume/seek/volume state and provides a lightweight
 * pub/sub mechanism so UI components can react to playback changes.
 *
 * @module engine/playbackController
 */

import type { Track } from '@/types';

/** All events the playback controller can emit. */
export type PlaybackEvent =
  | "trackChange"
  | "play"
  | "pause"
  | "progress"
  | "duration"
  | "volume"
  | "loading"
  | "error";

/** Callback signature for event subscriptions. */
export type PlaybackCallback<T = unknown> = (data: T) => void;

/** Immutable snapshot of the current playback state. */
export interface PlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Debounce helper — returns a function that delays `fn` by `ms`. */
function debounce<F extends (...args: unknown[]) => void>(
  fn: F,
  ms: number,
): F {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as unknown as F;
}

// ---------------------------------------------------------------------------
// PlaybackController
// ---------------------------------------------------------------------------

/**
 * Audio playback state machine with an event-driven interface.
 *
 * Features:
 * - Play / pause / resume / seek / volume / mute controls
 * - Lightweight pub/sub event system
 * - Debounced progress updates to avoid flooding subscribers
 * - Typed event payloads — no `any` usage
 */
export class PlaybackController {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** Currently-loaded track (or `null` when nothing is loaded). */
  private currentTrack: Track | null = null;

  /** Whether audio is currently playing. */
  private isPlaying = false;

  /** Current playback position in seconds. */
  private progress = 0;

  /** Total duration of the current track in seconds. */
  private duration = 0;

  /** Output volume, 0.0 – 1.0. */
  private volume = 1;

  /** Whether the output is muted. */
  private isMuted = false;

  /** Volume saved before muting so it can be restored on unmute. */
  private previousVolume = 1;

  /** `true` while the audio element is buffering / loading. */
  private isLoading = false;

  // -----------------------------------------------------------------------
  // Event system
  // -----------------------------------------------------------------------

  /**
   * Map of event name → set of registered callbacks.
   * Uses a `Set` so `off()` removes in O(1).
   */
  private listeners: Map<PlaybackEvent, Set<PlaybackCallback>> = new Map();

  /**
   * Subscribe to a playback event.
   *
   * @param event    - Event name to listen for.
   * @param callback - Function invoked when the event fires.
   */
  on<T = unknown>(event: PlaybackEvent, callback: PlaybackCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.add(callback as PlaybackCallback);
    }
  }

  /**
   * Unsubscribe from a playback event.
   *
   * @param event    - Event name.
   * @param callback - The exact function reference originally passed to `on()`.
   */
  off<T = unknown>(event: PlaybackEvent, callback: PlaybackCallback<T>): void {
    this.listeners.get(event)?.delete(callback as PlaybackCallback);
  }

  /**
   * Emit an event to all registered listeners.
   *
   * Errors thrown inside a callback are caught and logged so they cannot
   * break other subscribers.
   */
  private emit<T = unknown>(event: PlaybackEvent, data: T): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch (err: unknown) {
        console.error(`[PlaybackController] Error in "${event}" listener:`, err);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  /**
   * Start playing a new track.
   *
   * Resets progress, sets loading state, and emits `trackChange`, `play`,
   * and `loading` events.
   *
   * @param track - Track to begin playing.
   */
  play(track: Track): void {
    this.currentTrack = track;
    this.progress = 0;
    this.duration = track.duration ?? 0;
    this.isPlaying = true;
    this.isLoading = true;

    this.emit<Track>("trackChange", track);
    this.emit<boolean>("play", true);
    this.emit<boolean>("loading", true);
    this.emit<number>("duration", this.duration);
  }

  /**
   * Pause playback.
   */
  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.emit<boolean>("pause", true);
  }

  /**
   * Resume playback after a pause.
   */
  resume(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.emit<boolean>("play", true);
  }

  /**
   * Toggle between play and pause.
   */
  togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  /**
   * Seek to an absolute position within the track.
   *
   * @param time - Target position in seconds.
   */
  seek(time: number): void {
    this.progress = Math.max(0, Math.min(time, this.duration));
    this.debouncedProgressEmit(this.progress);
  }

  // -----------------------------------------------------------------------
  // Volume
  // -----------------------------------------------------------------------

  /**
   * Set the output volume.
   *
   * @param volume - Volume level between 0 (silent) and 1 (full).
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.previousVolume = this.volume; // Always save the latest volume
    // Unmute when volume is explicitly set to a non-zero value.
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.emit<number>("volume", this.isMuted ? 0 : this.volume);
  }

  /**
   * Toggle mute on / off.
   */
  toggleMute(): void {
    if (this.isMuted) {
      // Unmute — restore previous volume
      this.isMuted = false;
      this.emit<number>("volume", this.volume);
    } else {
      // Mute — save current volume and set to 0
      this.previousVolume = this.volume;
      this.isMuted = true;
      this.emit<number>("volume", 0);
    }
  }

  // -----------------------------------------------------------------------
  // Audio-element callbacks
  // -----------------------------------------------------------------------

  /**
   * Update the current playback progress.
   *
   * This is typically called from the `timeupdate` handler of an
   * `HTMLAudioElement`. Updates are debounced to avoid flooding.
   *
   * @param time - Current playback position in seconds.
   */
  setProgress(time: number): void {
    this.progress = time;
    this.debouncedProgressEmit(time);
  }

  /**
   * Update the total duration of the current track.
   *
   * @param dur - Duration in seconds.
   */
  setDuration(dur: number): void {
    this.duration = dur;
    this.emit<number>("duration", dur);
  }

  /**
   * Set the loading / buffering state.
   *
   * @param loading - `true` when the audio element is buffering.
   */
  setLoading(loading: boolean): void {
    if (this.isLoading === loading) return;
    this.isLoading = loading;
    this.emit<boolean>("loading", loading);
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /**
   * Return a full snapshot of the current playback state.
   *
   * The returned object is a shallow copy.
   */
  getState(): PlaybackState {
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      progress: this.progress,
      duration: this.duration,
      volume: this.isMuted ? 0 : this.volume,
      isMuted: this.isMuted,
      isLoading: this.isLoading,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Debounced version of the progress emit — fires at most once every
   * 250 ms to avoid overwhelming subscribers during rapid time updates.
   */
  private debouncedProgressEmit = debounce((time: unknown) => {
    this.emit<number>("progress", time as number);
  }, 250);
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Singleton `PlaybackController` instance. */
export const playbackController = new PlaybackController();
