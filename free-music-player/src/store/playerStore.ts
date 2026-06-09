/**
 * playerStore (Zustand) — UI mirror of MediaEngine state.
 *
 * This store NEVER decides anything. It reflects MediaEngine state
 * and forwards all actions to MediaEngine.
 *
 * The ONLY exception is `isFullPlayerOpen` which is pure UI state.
 *
 * @module store/playerStore
 */

import { create } from 'zustand';
import type { Track } from '@/types';
import { mediaEngine } from '@/engine/mediaEngine';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  queueIndex: number;
  queueHistory: Track[];
  isFullPlayerOpen: boolean;
  isMuted: boolean;
  isLoading: boolean;
  autoDedup: boolean;
  lyricsOffset: number;
  autoSyncEnabled: boolean;
  autoSyncConfidence: number;
  audioUrl: string | null;
  audioVideoId: string | null;

  // Actions (all delegate to MediaEngine)
  playTrack: (track: Track) => void;
  playTracks: (tracks: Track[], startIndex?: number) => void;
  playFromQueue: (index: number) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  prefetchTracks: (tracks: Track[]) => void;
  setFullPlayerOpen: (open: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setLoading: (loading: boolean) => void;
  toggleAutoDedup: () => void;
  adjustLyricsOffset: (delta: number) => void;
  resetLyricsOffset: () => void;
  setLyricsOffset: (offset: number) => void;
  toggleAutoSync: () => void;
  setAutoSyncConfidence: (confidence: number) => void;
  restoreSession: () => Promise<void>;
  saveSession: () => void;
}

// Mirror MediaEngine state into Zustand - only update changed fields to prevent unnecessary re-renders
function syncFromEngine(set: (partial: Partial<PlayerState>) => void, get: () => PlayerState) {
  const s = mediaEngine.getState();
  const current = get();
  
  // Only update fields that actually changed
  const updates: Partial<PlayerState> = {};
  
  if (current.currentTrack?.id !== s.currentTrack?.id) updates.currentTrack = s.currentTrack;
  if (current.isPlaying !== s.isPlaying) updates.isPlaying = s.isPlaying;
  if (current.progress !== s.progress) updates.progress = s.progress;
  if (current.duration !== s.duration) updates.duration = s.duration;
  if (current.volume !== s.volume) updates.volume = s.volume;
  if (current.isMuted !== s.isMuted) updates.isMuted = s.isMuted;
  if (current.isLoading !== s.isLoading) updates.isLoading = s.isLoading;
  if (current.queue.length !== s.queue.length || current.queue.some((t, i) => t.id !== s.queue[i]?.id)) {
    updates.queue = s.queue;
    updates.queueIndex = s.queueIndex;
    updates.queueHistory = s.queueHistory;
  }
  if (current.isShuffle !== s.isShuffle) updates.isShuffle = s.isShuffle;
  if (current.repeatMode !== s.repeatMode) updates.repeatMode = s.repeatMode;
  if (current.autoDedup !== s.autoDedup) updates.autoDedup = s.autoDedup;
  if (current.lyricsOffset !== s.lyricsOffset) updates.lyricsOffset = s.lyricsOffset;
  if (current.autoSyncEnabled !== s.autoSyncEnabled) updates.autoSyncEnabled = s.autoSyncEnabled;
  if (current.autoSyncConfidence !== s.autoSyncConfidence) updates.autoSyncConfidence = s.autoSyncConfidence;
  if (current.audioUrl !== s.audioUrl) updates.audioUrl = s.audioUrl;
  if (current.audioVideoId !== s.audioVideoId) updates.audioVideoId = s.audioVideoId;
  
  if (Object.keys(updates).length > 0) {
    set(updates);
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  // Subscribe to MediaEngine state changes
  mediaEngine.subscribe(() => {
    syncFromEngine(set, get);
  });

  return {
    // ── Initial state ──────────────────────────────────────────────
    currentTrack: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    volume: 0.8,
    isShuffle: false,
    repeatMode: 'off',
    queue: [],
    queueIndex: -1,
    queueHistory: [],
    isFullPlayerOpen: false,
    isMuted: false,
    isLoading: false,
    audioUrl: null,
    audioVideoId: null,
    autoDedup: true,
    lyricsOffset: 0,
    autoSyncEnabled: true,
    autoSyncConfidence: 0,

    // ── Actions (all delegate to MediaEngine) ──────────────────────

    playTrack: (track) => {
      mediaEngine.playTrack(track);
    },

    playTracks: (tracks, startIndex = 0) => {
      mediaEngine.playTracks(tracks, startIndex);
    },

    playFromQueue: (index) => {
      mediaEngine.playFromQueue(index);
    },

    togglePlay: () => {
      mediaEngine.togglePlay();
    },

    pause: () => {
      mediaEngine.pause();
    },

    resume: () => {
      mediaEngine.resume();
    },

    seek: (time) => {
      mediaEngine.seek(time);
    },

    setVolume: (volume) => {
      mediaEngine.setVolume(volume);
    },

    toggleMute: () => {
      mediaEngine.toggleMute();
    },

    toggleShuffle: () => {
      mediaEngine.toggleShuffle();
    },

    cycleRepeat: () => {
      mediaEngine.cycleRepeat();
    },

    nextTrack: () => {
      mediaEngine.nextTrack();
    },

    previousTrack: () => {
      mediaEngine.previousTrack();
    },

    addToQueue: (track) => {
      mediaEngine.addToQueue(track);
    },

    playNext: (track) => {
      mediaEngine.playNextInQueue(track);
    },

    removeFromQueue: (index) => {
      mediaEngine.removeFromQueue(index);
    },

    reorderQueue: (fromIndex, toIndex) => {
      mediaEngine.reorderQueue(fromIndex, toIndex);
    },

    clearQueue: () => {
      mediaEngine.clearQueue();
    },

    prefetchTracks: (tracks) => {
      mediaEngine.prefetchTracks(tracks);
    },

    setFullPlayerOpen: (open) => {
      set({ isFullPlayerOpen: open });
    },

    // These were called by the old AudioPlayer — now handled by MediaEngine.
    // Keep as no-ops so UI code doesn't break.
    setProgress: () => {},
    setDuration: () => {},
    setLoading: () => {},

    toggleAutoDedup: () => {
      mediaEngine.toggleAutoDedup();
    },

    adjustLyricsOffset: (delta) => {
      mediaEngine.adjustLyricsOffset(delta);
    },

    resetLyricsOffset: () => {
      mediaEngine.resetLyricsOffset();
    },

    setLyricsOffset: (offset) => {
      mediaEngine.setLyricsOffset(offset);
    },

    toggleAutoSync: () => {
      mediaEngine.toggleAutoSync();
    },

    setAutoSyncConfidence: (confidence) => {
      mediaEngine.setAutoSyncConfidence(confidence);
    },

    restoreSession: async () => {
      await mediaEngine.restoreSession();
    },

    saveSession: () => {
      // Session saving is handled internally by MediaEngine.
    },
  };
});
