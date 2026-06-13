import { create } from 'zustand';
import { Track, Playlist } from '@/types';
import { ipc } from '@/utils/ipc';

interface LibraryState {
  tracks: Track[];
  favorites: Track[];
  recentlyPlayed: Track[];
  playlists: Playlist[];
  searchQuery: string;
  sortBy: 'title' | 'artist' | 'album' | 'createdAt' | 'playCount' | 'duration';
  sortOrder: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  resolving: boolean; // tracks missing youtube_id being resolved
  rematching: boolean; // tracks being re-matched through v1.3 engine

  loadTracks: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  loadRecentlyPlayed: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  addTrack: (track: Partial<Track>) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSortBy: (field: 'title' | 'artist' | 'album' | 'createdAt' | 'playCount' | 'duration') => void;
  toggleSortOrder: () => void;
  getFilteredTracks: () => Track[];
  resolveMissingIds: () => Promise<void>;
  rematchAll: () => Promise<void>;

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
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
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
  resolving: false,
  rematching: false,

  loadTracks: async () => {
    set({ loading: true, error: null });
    try {
      const tracks = await ipc.library.getTracks();
      set({ tracks, loading: false });

      // Fire-and-forget: resolve any tracks missing youtube_id (e.g. old
      // Spotify imports) using exact-duration YouTube matching
      const unresolved = tracks.filter(t => !t.youtubeId);
      if (unresolved.length > 0) {
        get().resolveMissingIds();
      }

      // v1.3.1 migration: re-match ALL existing tracks through the fixed
      // duration-first + multi-factor matching engine.
      // Re-runs even if v1.3.0 rematch already ran (that version had a bug
      // where trust-only sort picked wrong-artist Topic channels).
      if (tracks.some(t => t.youtubeId)) {
        const settings = await ipc.settings.getSettings();
        if (settings?.migration_v1_3_1_rematch !== 'done') {
          get().rematchAll();
        }
      }
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
    const prevTracks = get().tracks;
    const prevFavorites = get().favorites;
    const track = prevTracks.find((t) => t.id === id);
    const wasFavorite = track?.isFavorite ?? false;
    
    // Optimistic update
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, isFavorite: !t.isFavorite } : t)),
      favorites: wasFavorite
        ? s.favorites.filter((t) => t.id !== id)
        : track ? [...s.favorites, { ...track, isFavorite: true }] : s.favorites,
    }));
    
    try {
      await ipc.library.toggleFavorite(id);
    } catch (e: any) {
      // Revert on failure
      set({ tracks: prevTracks, favorites: prevFavorites, error: e.message });
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
    return [...filtered].sort((a, b) => {
      // Duration: ABSOLUTELY STRINGENT numeric sort — pure integer subtraction
      if (sortBy === 'duration') {
        const aDur = a.duration ?? 0;
        const bDur = b.duration ?? 0;
        return sortOrder === 'asc' ? aDur - bDur : bDur - aDur;
      }
      const aVal = (a as any)[sortBy] ?? '';
      const bVal = (b as any)[sortBy] ?? '';
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  },

  importAsPlaylist: async (url, playlistName, onProgress) => {
    onProgress?.('Fetching playlist and matching tracks to exact YouTube sources...');
    const result = await ipc.import.asPlaylist(url, playlistName);
    onProgress?.('Reloading library...');
    // Refresh tracks and playlists so UI updates immediately
    await Promise.all([get().loadTracks(), get().loadPlaylists()]);
    return result;
  },

  createPlaylist: async (name, description) => {
    const playlist = await ipc.playlist.createPlaylist(name, description || '');
    await get().loadPlaylists();
    return playlist as Playlist;
  },

  resolveMissingIds: async () => {
    if (get().resolving) return; // already in progress
    set({ resolving: true });
    try {
      const { resolved, total } = await ipc.library.resolveMissingYoutubeIds();
      if (resolved > 0) {
        console.log(`[Library] Resolved ${resolved}/${total} missing YouTube IDs`);
        // Refresh tracks to pick up the newly resolved IDs
        await get().loadTracks();
      }
    } catch (e: any) {
      console.error('[Library] Failed to resolve missing YouTube IDs:', e);
    } finally {
      set({ resolving: false });
    }
  },

  rematchAll: async () => {
    if (get().rematching) return;
    set({ rematching: true });
    console.log('[Library] Re-matching all tracks through v1.3 matching engine...');
    try {
      const { rematched, total } = await ipc.library.rematchAllTracks();
      console.log(`[Library] Re-matched ${rematched}/${total} tracks`);

      // Mark migration as complete so it only runs once
      await ipc.settings.updateSettings({ migration_v1_3_1_rematch: 'done' });

      // Refresh tracks to pick up new YouTube IDs
      if (rematched > 0) {
        await get().loadTracks();
      }
    } catch (e: any) {
      console.error('[Library] Re-match failed:', e);
    } finally {
      set({ rematching: false });
    }
  },
}));
