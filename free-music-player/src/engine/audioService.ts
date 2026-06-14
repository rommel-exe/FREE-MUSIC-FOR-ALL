/**
 * AudioService — the only module that touches HTMLAudioElement.
 *
 * Dumb executor. Receives commands, emits events. Never decides what
 * track to play, never manages queue, never touches Zustand.
 *
 * Owns two Audio elements for gapless playback.
 *
 * @module engine/audioService
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioServiceCallbacks {
  onTimeUpdate: (time: number) => void;
  onEnded: () => void;
  onLoadedMetadata: (duration: number) => void;
  onError: (errorCode?: number) => void;
  onWaiting: () => void;
  onCanPlay: () => void;
}

// ---------------------------------------------------------------------------
// AudioService
// ---------------------------------------------------------------------------

export class AudioService {
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  private activeIndex = 0;

  /** The videoId that is currently loaded into the active element. */
  loadedVideoId: string | null = null;
  /** The videoId that is preloaded into the standby element. */
  preloadedVideoId: string | null = null;

  callbacks: AudioServiceCallbacks | null = null;

  constructor() {
    this.audioA = new Audio();
    this.audioB = new Audio();
    this.setupElement(this.audioA);
    this.setupElement(this.audioB);
  }

  // ── Audio element accessors ──────────────────────────────────────

  get active(): HTMLAudioElement {
    return this.activeIndex === 0 ? this.audioA : this.audioB;
  }

  get standby(): HTMLAudioElement {
    return this.activeIndex === 0 ? this.audioB : this.audioA;
  }

  // ── Commands (called by MediaEngine only) ────────────────────────

  /** Load a URL into the active element (pauses both, resets to element A). */
  load(url: string, videoId: string): void {
    // Hard stop both elements - prevent any audio overlap
    this.audioA.pause(); this.audioA.src = ''; this.audioA.currentTime = 0;
    this.audioB.pause(); this.audioB.src = ''; this.audioB.currentTime = 0;
    this.activeIndex = 0;
    this.audioA.src = url;
    this.loadedVideoId = videoId;
    this.preloadedVideoId = null;
    this.audioA.load();
  }

  /** Preload a URL into the standby element for gapless switching. */
  preload(url: string, videoId: string): void {
    this.standby.src = url;
    this.preloadedVideoId = videoId;
    this.standby.load();
  }

  /**
   * Swap active/standby elements.
   * If the standby is ready (readyState >= 3), the swap is seamless.
   * Caller must call play() after swap if playback should continue.
   */
  swapActive(): void {
    const prev = this.active;
    prev.pause();
    this.activeIndex = 1 - this.activeIndex;
    this.loadedVideoId = this.preloadedVideoId;
    this.preloadedVideoId = null;
  }

  /** Returns true if standby is loaded and has enough data to play. */
  get isStandbyReady(): boolean {
    return this.standby.readyState >= 3 && this.preloadedVideoId !== null;
  }

  play(): void {
    this.active.play().catch(() => {});
  }

  pause(): void {
    this.active.pause();
  }

  seek(time: number): void {
    this.active.currentTime = time;
  }

  setVolume(vol: number): void {
    this.audioA.volume = vol;
    this.audioB.volume = vol;
  }

  /** Cleanup both elements (on app unmount). */
  destroy(): void {
    this.audioA.pause(); this.audioA.src = '';
    this.audioB.pause(); this.audioB.src = '';
  }

  // ── Private setup ────────────────────────────────────────────────

  private setupElement(el: HTMLAudioElement): void {
    el.preload = 'auto';

    el.addEventListener('timeupdate', () => {
      if (el !== this.active) return;
      this.callbacks?.onTimeUpdate(el.currentTime);
    });

    el.addEventListener('ended', () => {
      if (el !== this.active) return;
      this.callbacks?.onEnded();
    });

    el.addEventListener('loadedmetadata', () => {
      if (el !== this.active) return;
      if (el.duration > 0 && Number.isFinite(el.duration)) {
        this.callbacks?.onLoadedMetadata(el.duration);
      }
    });

    el.addEventListener('error', () => {
      if (el !== this.active) return;
      this.callbacks?.onError(el.error?.code);
    });

    el.addEventListener('waiting', () => {
      if (el !== this.active) return;
      this.callbacks?.onWaiting();
    });

    el.addEventListener('canplay', () => {
      if (el !== this.active) return;
      this.callbacks?.onCanPlay();
    });

    el.addEventListener('playing', () => {
      if (el !== this.active) return;
      // Reset error counts on successful play
    });
  }
}
