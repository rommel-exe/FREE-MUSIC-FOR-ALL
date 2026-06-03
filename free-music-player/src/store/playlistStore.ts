import { create } from 'zustand';
import { Playlist, Track } from '@/types';
import { ipc } from '@/utils/ipc';

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylistId: string | null;
  currentPlaylistTracks: Track[];
  loading: boolean;
  error: string | null;

  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<void>;
  selectPlaylist: (id: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderTracks: (playlistId: string, fromIndex: number, toIndex: number) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  currentPlaylistId: null,
  currentPlaylistTracks: [],
  loading: false,
  error: null,

  loadPlaylists: async () => {
    set({ loading: true });
    try {
      const playlists = await ipc.playlist.getPlaylists();
      set({ playlists, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  createPlaylist: async (name, description) => {
    try {
      const playlist = await ipc.playlist.createPlaylist(name, description);
      set((s) => ({ playlists: [...s.playlists, playlist] }));
      return playlist;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    }
  },

  deletePlaylist: async (id) => {
    try {
      await ipc.playlist.deletePlaylist(id);
      set((s) => ({
        playlists: s.playlists.filter((p) => p.id !== id),
        currentPlaylistId: s.currentPlaylistId === id ? null : s.currentPlaylistId,
      }));
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  selectPlaylist: async (id) => {
    set({ currentPlaylistId: id, loading: true });
    try {
      const tracks = await ipc.playlist.getPlaylistTracks(id);
      set({ currentPlaylistTracks: tracks, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    try {
      await ipc.playlist.addTrackToPlaylist(playlistId, trackId);
      if (get().currentPlaylistId === playlistId) {
        await get().selectPlaylist(playlistId);
      }
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    try {
      await ipc.playlist.removeTrackFromPlaylist(playlistId, trackId);
      if (get().currentPlaylistId === playlistId) {
        set((s) => ({
          currentPlaylistTracks: s.currentPlaylistTracks.filter((t) => t.id !== trackId),
        }));
      }
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  reorderTracks: async (playlistId, fromIndex, toIndex) => {
    try {
      await ipc.playlist.reorderPlaylistTracks(playlistId, fromIndex, toIndex);
      await get().selectPlaylist(playlistId);
    } catch (e: any) {
      set({ error: e.message });
    }
  },
}));
