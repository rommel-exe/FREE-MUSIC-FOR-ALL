import { create } from 'zustand';
import type { Track } from '@/types';
import { ipc } from '@/utils/ipc';
import { queueEngine } from '@/engine/queueEngine';
import { playbackController } from '@/engine/playbackController';
import { prefetchEngine } from '@/engine/prefetchEngine';
import { recommendationEngine } from '@/engine/recommendationEngine';

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
  setFullPlayerOpen: (open: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setLoading: (loading: boolean) => void;
  toggleAutoDedup: () => void;
  restoreSession: () => Promise<void>;
  saveSession: () => void;
}

// Debounced session save
let sessionSaveTimeout: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(state: PlayerState) {
  if (sessionSaveTimeout) clearTimeout(sessionSaveTimeout);
  sessionSaveTimeout = setTimeout(() => {
    ipc.settings.saveSession({
      currentTrack: state.currentTrack,
      wasPlaying: state.isPlaying,
      volume: state.volume,
      isShuffle: state.isShuffle,
      repeatMode: state.repeatMode,
      queue: state.queue,
      queueIndex: state.queueIndex,
      queueHistory: state.queueHistory,
      autoDedup: state.autoDedup,
    }).catch(() => {});
  }, 1000);
}

/** Sync engine state to the Zustand store. */
function syncFromEngine(set: (partial: Partial<PlayerState>) => void) {
  const qs = queueEngine.getState();
  const ps = playbackController.getState();
  set({
    currentTrack: ps.currentTrack ?? qs.currentTrack,
    queue: qs.queue as Track[],
    queueIndex: qs.queueIndex,
    queueHistory: qs.history as Track[],
    isShuffle: qs.shuffle,
    repeatMode: qs.repeatMode,
    autoDedup: qs.autoDedup,
    isPlaying: ps.isPlaying,
    progress: ps.progress,
    duration: ps.duration,
    volume: ps.volume,
    isMuted: ps.isMuted,
    isLoading: ps.isLoading,
  });
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
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
  autoDedup: true,

  playTrack: (track) => {
    // Set a single-track queue so next/previous are coherent
    queueEngine.setQueue([track], 0);
    playbackController.play(track);
    recommendationEngine.recordPlay(track);
    syncFromEngine(set);
    debouncedSave(get());
  },

  playFromQueue: (index: number) => {
    const track = queueEngine.jumpTo(index);
    if (track) {
      playbackController.play(track);
      recommendationEngine.recordPlay(track);
      const qs = queueEngine.getState();
      prefetchEngine.prefetch(qs.queue, qs.queueIndex);
    }
    syncFromEngine(set);
    debouncedSave(get());
  },

  playTracks: (tracks, startIndex = 0) => {
    if (tracks.length === 0) return;
    queueEngine.setQueue(tracks, startIndex);
    const current = queueEngine.getCurrentTrack();
    if (current) {
      playbackController.play(current);
      recommendationEngine.recordPlay(current);
      prefetchEngine.prefetch(tracks, startIndex);
    }
    syncFromEngine(set);
    debouncedSave(get());
  },

  togglePlay: () => {
    playbackController.togglePlay();
    set({ isPlaying: playbackController.getState().isPlaying });
    debouncedSave(get());
  },

  pause: () => {
    playbackController.pause();
    set({ isPlaying: false });
    debouncedSave(get());
  },

  resume: () => {
    playbackController.resume();
    set({ isPlaying: true });
    debouncedSave(get());
  },

  seek: (time) => {
    playbackController.seek(time);
    set({ progress: time });
  },

  setVolume: (volume) => {
    playbackController.setVolume(volume);
    syncFromEngine(set);
    debouncedSave(get());
  },

  toggleMute: () => {
    playbackController.toggleMute();
    syncFromEngine(set);
    debouncedSave(get());
  },

  toggleShuffle: () => {
    const { isShuffle } = get();
    queueEngine.shuffle(!isShuffle);
    syncFromEngine(set);
    debouncedSave(get());
  },

  cycleRepeat: () => {
    const { repeatMode } = get();
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % 3];
    queueEngine.setRepeatMode(nextMode);
    syncFromEngine(set);
    debouncedSave(get());
  },

  nextTrack: () => {
    const next = queueEngine.next();
    if (next) {
      playbackController.play(next);
      recommendationEngine.recordPlay(next);
      const qs = queueEngine.getState();
      prefetchEngine.prefetch(qs.queue, qs.queueIndex);
    } else {
      playbackController.pause();
      // Clear current track from playback controller so the UI
      // doesn't show a stale "loaded" track after the queue ends.
      set({ currentTrack: null });
    }
    syncFromEngine(set);
    debouncedSave(get());
  },

  previousTrack: () => {
    const realProgress = playbackController.getState().progress;
    const prev = queueEngine.previous(realProgress);
    if (prev) {
      playbackController.play(prev);
    }
    syncFromEngine(set);
    debouncedSave(get());
  },

  addToQueue: (track) => {
    queueEngine.add(track);
    syncFromEngine(set);
    debouncedSave(get());
  },

  playNext: (track) => {
    queueEngine.playNext(track);
    syncFromEngine(set);
    debouncedSave(get());
  },

  removeFromQueue: (index) => {
    queueEngine.remove(index);
    syncFromEngine(set);
    debouncedSave(get());
  },

  reorderQueue: (fromIndex, toIndex) => {
    queueEngine.reorder(fromIndex, toIndex);
    syncFromEngine(set);
    debouncedSave(get());
  },

  clearQueue: () => {
    queueEngine.clear();
    syncFromEngine(set);
    debouncedSave(get());
  },

  setFullPlayerOpen: (open) => set({ isFullPlayerOpen: open }),

  setProgress: (progress) => {
    // Throttle to ~0.1s to keep React re-renders manageable while still
    // updating smoothly. The 0.5s throttle used previously caused the
    // progress bar to appear stuck because the underlying `timeupdate`
    // event fires every ~250ms, so most updates were being dropped.
    const prev = get().progress;
    if (Math.abs(progress - prev) < 0.1) return;
    set({ progress });
  },

  setDuration: (duration) => set({ duration }),
  setLoading: (loading) => set({ isLoading: loading }),
  toggleAutoDedup: () => {
    const { autoDedup } = get();
    queueEngine.setAutoDedup(!autoDedup);
    syncFromEngine(set);
    debouncedSave(get());
  },

  restoreSession: async () => {
    try {
      const session = await ipc.settings.getSession();
      if (session) {
        // Restore engine state
        queueEngine.setAutoDedup(session.autoDedup ?? true);
        queueEngine.setRepeatMode(session.repeatMode ?? 'off');
        if (session.queue?.length) {
          queueEngine.setQueue(session.queue, session.queueIndex ?? 0);
        }
        playbackController.setVolume(session.volume ?? 0.8);

        syncFromEngine(set);
        if (session.currentTrack && session.wasPlaying) {
          playbackController.play(session.currentTrack);
          syncFromEngine(set);
        }
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
    }
  },

  saveSession: () => {
    debouncedSave(get());
  },
}));
