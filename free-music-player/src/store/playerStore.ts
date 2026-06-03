import { create } from 'zustand';
import { Track } from '@/types';
import { ipc } from '@/utils/ipc';

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
  isMiniPlayer: boolean;
  isFullPlayerOpen: boolean;
  isMuted: boolean;
  isLoading: boolean;
  seekRequest: { time: number; token: number } | null;

  playTrack: (track: Track) => Promise<void>;
  playTracks: (tracks: Track[], startIndex?: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  addToQueue: (track: Track) => Promise<void>;
  playNext: (track: Track) => Promise<void>;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setMiniPlayer: (isMini: boolean) => void;
  setFullPlayerOpen: (open: boolean) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setLoading: (loading: boolean) => void;
  initPlayer: () => Promise<void>;
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
  seekRequest: null,
  queueIndex: -1,
  isMiniPlayer: false,
  isFullPlayerOpen: false,
  isMuted: false,
  isLoading: false,

  initPlayer: async () => {
    try {
      const currentTrack = await ipc.player.getCurrentTrack();
      if (currentTrack) set({ currentTrack });

      ipc.player.onTrackChange((track) => {
        set({ currentTrack: track, isPlaying: !!track });
      });
      ipc.player.onTimeUpdate(({ progress, duration }) => {
        set({ progress, duration });
      });
      ipc.player.onPlaybackEnd(() => {
        const state = get();
        if (state.repeatMode === 'one') {
          get().seek(0);
        } else {
          get().nextTrack();
        }
      });
    } catch (e) {
      console.error('Failed to init player:', e);
    }
  },

  playTrack: async (track) => {
    set({ currentTrack: track, isPlaying: true, progress: 0 });
    await ipc.library.incrementPlayCount(track.id);
    // AudioPlayback component will handle resolving the stream URL and playing
  },

  playTracks: async (tracks, startIndex = 0) => {
    if (tracks.length === 0) return;
    const { isShuffle } = get();
    const track = tracks[startIndex];
    let queue = tracks;
    let queueIndex = startIndex;

    // If shuffle is on, reorder the queue: current track first, then shuffle the rest
    if (isShuffle) {
      const others = [...tracks.slice(0, startIndex), ...tracks.slice(startIndex + 1)];
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      queue = [track, ...others];
      queueIndex = 0;
    }

    set({ queue, queueIndex, currentTrack: track, isPlaying: true, progress: 0 });
    await ipc.library.incrementPlayCount(track.id);
    for (let i = 0; i < queue.length; i++) {
      await ipc.queue.addToQueue(queue[i].id);
    }
    // AudioPlayback component will handle resolving the stream URL and playing
  },

  togglePlay: async () => {
    if (get().isPlaying) {
      await get().pause();
    } else {
      await get().resume();
    }
  },

  pause: async () => {
    set({ isPlaying: false });
    await ipc.player.pause();
  },

  resume: async () => {
    set({ isPlaying: true });
    await ipc.player.resume();
  },

  seek: async (time) => {
    set({ progress: time, seekRequest: { time, token: Date.now() } });
    await ipc.player.seek(time);
  },

  setVolume: async (volume) => {
    set({ volume, isMuted: volume === 0 });
    await ipc.player.setVolume(volume);
  },

  toggleMute: async () => {
    const { isMuted, volume } = get();
    if (isMuted) {
      set({ isMuted: false });
      await ipc.player.setVolume(volume || 0.8);
    } else {
      set({ isMuted: true });
      await ipc.player.setVolume(0);
    }
  },

  toggleShuffle: () => {
    const { isShuffle, queue, queueIndex } = get();
    const newShuffle = !isShuffle;

    if (queue.length === 0) {
      set({ isShuffle: newShuffle });
      return;
    }

    if (newShuffle) {
      // Turning shuffle ON: reorder the queue so the current track is first,
      // then shuffle the rest. This way the visible queue reflects what
      // shuffle will actually play next.
      const currentTrack = queueIndex >= 0 ? queue[queueIndex] : queue[0];
      const currentIdx = queueIndex >= 0 ? queueIndex : 0;

      // Get all other tracks (excluding current) and shuffle them
      const others = [...queue.slice(0, currentIdx), ...queue.slice(currentIdx + 1)];
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }

      // New queue: current track first, then shuffled others
      const newQueue = [currentTrack, ...others];
      set({ isShuffle: newShuffle, queue: newQueue, queueIndex: 0 });
    } else {
      // Turning shuffle OFF: restore the queue to the order before shuffle.
      // We don't have the original order stored, so we just keep the current
      // order. The user can re-play the playlist to reset.
      set({ isShuffle: newShuffle });
    }
  },

  cycleRepeat: () => set((s) => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const idx = modes.indexOf(s.repeatMode);
    return { repeatMode: modes[(idx + 1) % 3] };
  }),

  nextTrack: async () => {
    const { queue, queueIndex, repeatMode, isShuffle } = get();
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') {
        // When wrapping around with shuffle on, re-shuffle the queue so the
        // listener doesn't hear the exact same sequence twice in a row.
        if (isShuffle) {
          const copy = [...queue];
          for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          set({ queue: copy, queueIndex: 0, currentTrack: copy[0], progress: 0, isPlaying: true });
          return;
        }
        nextIdx = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }
    set({ queueIndex: nextIdx, currentTrack: queue[nextIdx], progress: 0, isPlaying: true });
    // AudioPlayback component will handle resolving the stream URL and playing
  },

  previousTrack: async () => {
    const { queue, queueIndex, progress } = get();
    if (progress > 3) {
      await get().seek(0);
      return;
    }
    if (queue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;
    set({ queueIndex: prevIdx, currentTrack: queue[prevIdx], progress: 0, isPlaying: true });
    // AudioPlayback component will handle resolving the stream URL and playing
  },

  addToQueue: async (track) => {
    set((s) => ({ queue: [...s.queue, track] }));
    await ipc.queue.addToQueue(track.id);
  },

  playNext: async (track) => {
    const { queue, queueIndex } = get();
    const newQueue = [...queue];
    newQueue.splice(queueIndex + 1, 0, track);
    set({ queue: newQueue });
    await ipc.queue.playNext(track.id);
  },

  removeFromQueue: (index) => set((s) => {
    const newQueue = [...s.queue];
    newQueue.splice(index, 1);
    return { queue: newQueue };
  }),

  clearQueue: () => {
    set({ queue: [], queueIndex: -1 });
    ipc.queue.clearQueue();
  },

  setMiniPlayer: (isMini) => set({ isMiniPlayer: isMini }),
  setFullPlayerOpen: (open) => set({ isFullPlayerOpen: open }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
