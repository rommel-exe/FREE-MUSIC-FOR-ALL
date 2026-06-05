import type { Track, Playlist, QueueItem, SearchResult, Settings } from '@/types';

const api = window.electronAPI;

/** Session data persisted across app restarts. */
interface SessionData {
  currentTrack?: Track | null;
  wasPlaying?: boolean;
  volume?: number;
  isShuffle?: boolean;
  repeatMode?: 'off' | 'all' | 'one';
  queue?: Track[];
  queueIndex?: number;
  queueHistory?: Track[];
  progress?: number;
  isMuted?: boolean;
  autoDedup?: boolean;
}

export const ipc = {
  player: {
    play: (trackId?: string): Promise<void> => Promise.resolve(api?.player?.play(trackId)),
    pause: (): Promise<void> => Promise.resolve(api?.player?.pause()),
    resume: (): Promise<void> => Promise.resolve(api?.player?.resume()),
    seek: (time: number): Promise<void> => Promise.resolve(api?.player?.seek(time)),
    setVolume: (volume: number): Promise<void> => Promise.resolve(api?.player?.setVolume(volume)),
  },

  library: {
    getTracks: (): Promise<Track[]> =>
      (api?.library?.getTracks() as Promise<Track[]> | undefined) ?? Promise.resolve([]),
    addTrack: (track: Partial<Track>): Promise<Track> =>
      (api?.library?.addTrack(track) as Promise<Track> | undefined) ?? Promise.reject(new Error('No API')),
    removeTrack: (id: string): Promise<void> => api?.library?.removeTrack(id) ?? Promise.resolve(),
    searchTracks: (query: string): Promise<Track[]> =>
      (api?.library?.searchTracks(query) as Promise<Track[]> | undefined) ?? Promise.resolve([]),
    toggleFavorite: (id: string): Promise<boolean> =>
      (api?.library?.toggleFavorite(id) as Promise<boolean> | undefined) ?? Promise.resolve(false),
    getFavorites: (): Promise<Track[]> =>
      (api?.library?.getFavorites() as Promise<Track[]> | undefined) ?? Promise.resolve([]),
    getRecentlyPlayed: (): Promise<Track[]> =>
      (api?.library?.getRecentlyPlayed() as Promise<Track[]> | undefined) ?? Promise.resolve([]),
    incrementPlayCount: (id: string): Promise<void> =>
      api?.library?.incrementPlayCount(id) ?? Promise.resolve(),
  },

  playlist: {
    getPlaylists: (): Promise<Playlist[]> =>
      (api?.playlist?.getPlaylists() as Promise<Playlist[]> | undefined) ?? Promise.resolve([]),
    createPlaylist: (name: string, description?: string): Promise<Playlist> =>
      (api?.playlist?.createPlaylist(name, description) as Promise<Playlist> | undefined) ??
      Promise.reject(new Error('No API')),
    deletePlaylist: (id: string): Promise<void> => api?.playlist?.deletePlaylist(id) ?? Promise.resolve(),
    updatePlaylist: (id: string, data: Partial<Playlist>): Promise<void> =>
      api?.playlist?.updatePlaylist(id, data) ?? Promise.resolve(),
    addTrackToPlaylist: (playlistId: string, trackId: string): Promise<void> =>
      api?.playlist?.addTrackToPlaylist(playlistId, trackId) ?? Promise.resolve(),
    removeTrackFromPlaylist: (playlistId: string, trackId: string): Promise<void> =>
      api?.playlist?.removeTrackFromPlaylist(playlistId, trackId) ?? Promise.resolve(),
    getPlaylistTracks: (playlistId: string): Promise<Track[]> =>
      (api?.playlist?.getPlaylistTracks(playlistId) as Promise<Track[]> | undefined) ?? Promise.resolve([]),
    reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number): Promise<void> =>
      api?.playlist?.reorderPlaylistTracks(playlistId, fromIndex, toIndex) ?? Promise.resolve(),
  },

  queue: {
    getQueue: (): Promise<QueueItem[]> =>
      (api?.queue?.getQueue() as Promise<QueueItem[]> | undefined) ?? Promise.resolve([]),
    addToQueue: (trackId: string): Promise<void> => api?.queue?.addToQueue(trackId) ?? Promise.resolve(),
    playNext: (trackId: string): Promise<void> => api?.queue?.playNext(trackId) ?? Promise.resolve(),
    removeFromQueue: (id: number): Promise<void> => api?.queue?.removeFromQueue(id) ?? Promise.resolve(),
    reorderQueue: (from: number, to: number): Promise<void> =>
      api?.queue?.reorderQueue(from, to) ?? Promise.resolve(),
    clearQueue: (): Promise<void> => api?.queue?.clearQueue() ?? Promise.resolve(),
  },

  search: {
    searchYouTube: (query: string, limit?: number): Promise<SearchResult[]> =>
      (api?.search?.searchYouTube(query, limit) as Promise<SearchResult[]> | undefined) ?? Promise.resolve([]),
  },

  settings: {
    getSettings: (): Promise<Settings> =>
      (api?.settings?.getSettings() as Promise<Settings> | undefined) ?? Promise.reject(new Error('No API')),
    updateSettings: (settings: Partial<Settings>): Promise<void> =>
      api?.settings?.updateSettings(settings) ?? Promise.resolve(),
    getSession: (): Promise<SessionData | null> =>
      (api?.settings?.getSession?.() as Promise<SessionData> | undefined) ?? Promise.resolve(null),
    saveSession: (session: SessionData): Promise<void> =>
      api?.settings?.saveSession?.(session) ?? Promise.resolve(),
  },

  stream: {
    resolve: (videoId: string): Promise<{ url?: string; expiresAt?: number; bitrate?: number; error?: string }> =>
      (api?.stream?.resolve?.(videoId) as
        | Promise<{ url?: string; expiresAt?: number; bitrate?: number; error?: string }>
        | undefined) ?? Promise.resolve({ error: 'No API' }),
    prefetch: (videoId: string): Promise<{ ok: boolean }> =>
      (api?.stream?.prefetch?.(videoId) as Promise<{ ok: boolean }> | undefined) ??
      Promise.resolve({ ok: false }),
    hasCached: (videoId: string): Promise<{ cached: boolean }> =>
      (api?.stream?.hasCached?.(videoId) as Promise<{ cached: boolean }> | undefined) ??
      Promise.resolve({ cached: false }),
    getCached: (videoId: string): Promise<{ url?: string; expiresAt?: number; bitrate?: number; error?: string }> =>
      (api?.stream?.getCached?.(videoId) as
        | Promise<{ url?: string; expiresAt?: number; bitrate?: number; error?: string }>
        | undefined) ?? Promise.resolve({ error: 'No API' }),
  },

  import: {
    youtube: (url: string): Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string; youtubeId: string }> }> =>
      (api?.import?.youtube(url) as
        | Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string; youtubeId: string }> }>
        | undefined) ?? Promise.reject(new Error('No API')),
    spotify: (url: string): Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string }> }> =>
      (api?.import?.spotify(url) as
        | Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string }> }>
        | undefined) ?? Promise.reject(new Error('No API')),
    asPlaylist: (url: string, playlistName?: string): Promise<{
      playlist: { id: string; name: string; trackCount: number };
      imported: number;
      total: number;
      failed: number;
    }> =>
      (api?.import?.asPlaylist(url, playlistName) as
        | Promise<{
            playlist: { id: string; name: string; trackCount: number };
            imported: number;
            total: number;
            failed: number;
          }>
        | undefined) ?? Promise.reject(new Error('No API')),
  },

  app: {
    minimize: (): void => api?.app?.minimize(),
    maximize: (): void => api?.app?.maximize(),
    close: (): void => api?.app?.close(),
    getVersion: (): Promise<string> =>
      (api?.app?.getVersion() as Promise<string> | undefined) ?? Promise.resolve('1.0.0'),
  },
};
