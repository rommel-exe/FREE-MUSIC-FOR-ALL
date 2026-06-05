import { create } from 'zustand';
import { Track, Playlist } from '@/types';
import { ipc } from '@/utils/ipc';

interface LibraryState {
  tracks: Track[];
  favorites: Track[];
  recentlyPlayed: Track[];
  playlists: Playlist[];
  searchQuery: string;
  sortBy: 'title' | 'artist' | 'album' | 'createdAt' | 'playCount';
  sortOrder: 'asc' | 'desc';
  loading: boolean;
  error: string | null;

  loadTracks: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  loadRecentlyPlayed: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  addTrack: (track: Partial<Track>) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSortBy: (field: 'title' | 'artist' | 'album' | 'createdAt' | 'playCount') => void;
  toggleSortOrder: () => void;
  getFilteredTracks: () => Track[];

  /**
   * Import a YouTube or Spotify playlist and create a new playlist in the
   * user's library containing all the imported tracks.
   *
   * Returns the created playlist + import summary.
   */
  importAsPlaylist: (
    url: string,
    playlistName?: string,
    onProgress?: (message: string) => void,
  ) => Promise<{
    playlist: { id: string; name: string; trackCount: number };
    imported: number;
    total: number;
    failed: number;
  }>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  favorites: [],
  recentlyPlayed: [],
  playlists: [],
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  loading: false,
  error: null,

  loadTracks: async () => {
    set({ loading: true, error: null });
    try {
      const tracks = await ipc.library.getTracks();
      set({ tracks, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  loadFavorites: async () => {
    try {
      const favorites = await ipc.library.getFavorites();
      set({ favorites });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadRecentlyPlayed: async () => {
    try {
      const recentlyPlayed = await ipc.library.getRecentlyPlayed();
      set({ recentlyPlayed });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadPlaylists: async () => {
    try {
      const playlists = await ipc.playlist.getPlaylists();
      set({ playlists: playlists as Playlist[] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  addTrack: async (trackData) => {
    try {
      const track = await ipc.library.addTrack(trackData);
      set((s) => ({ tracks: [track, ...s.tracks] }));
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  removeTrack: async (id) => {
    try {
      await ipc.library.removeTrack(id);
      set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) }));
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  toggleFavorite: async (id) => {
    try {
      await ipc.library.toggleFavorite(id);
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === id ? { ...t, isFavorite: !t.isFavorite } : t)),
      }));
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortBy: (field) => set({ sortBy: field }),
  toggleSortOrder: () => set((s) => ({ sortOrder: s.sortOrder === 'asc' ? 'desc' : 'asc' })),

  getFilteredTracks: () => {
    const { tracks, searchQuery, sortBy, sortOrder } = get();
    let filtered = tracks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = tracks.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.artist?.toLowerCase().includes(q) ||
          t.album?.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a: any, b: any) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  },

  importAsPlaylist: async (url, playlistName, onProgress) => {
    onProgress?.('Fetching playlist...');
    const result = await ipc.import.asPlaylist(url, playlistName);
    onProgress?.('Reloading library...');
    // Refresh tracks and playlists so UI updates immediately
    await Promise.all([get().loadTracks(), get().loadPlaylists()]);
    return result;
  },
}));
