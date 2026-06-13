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
    addRecentlyPlayed: (id: string): Promise<void> =>
      api?.library?.addRecentlyPlayed(id) ?? Promise.resolve(),
    resolveMissingYoutubeIds: (): Promise<{ resolved: number; total: number }> =>
      (api?.library?.resolveMissingYoutubeIds() as Promise<{ resolved: number; total: number }> | undefined) ??
      Promise.resolve({ resolved: 0, total: 0 }),
    rematchAllTracks: (): Promise<{ rematched: number; total: number; unchanged: number }> =>
      (api?.library?.rematchAllTracks() as Promise<{ rematched: number; total: number; unchanged: number }> | undefined) ??
      Promise.resolve({ rematched: 0, total: 0, unchanged: 0 }),
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
    /** Trigger background verification for search results. */
    verify: (results: Array<{ id: string; title: string; artist: string }>): Promise<{ ok: boolean }> =>
      (api?.search?.verify?.(results) as Promise<{ ok: boolean }> | undefined) ?? Promise.resolve({ ok: false }),
    /** Batch-lookup verification status for video IDs. */
    getVerified: (videoIds: string[]): Promise<Record<string, { playable: boolean; trustScore: number }>> =>
      (api?.search?.getVerified?.(videoIds) as Promise<Record<string, any>> | undefined) ?? Promise.resolve({}),
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
    resolve: (videoId: string, metadata?: { artist: string; title: string; expectedDuration?: number; trackId?: string }): Promise<{ url?: string; expiresAt?: number; bitrate?: number; videoId?: string; error?: string }> =>
      (api?.stream?.resolve?.(videoId, metadata) as
        | Promise<{ url?: string; expiresAt?: number; bitrate?: number; videoId?: string; error?: string }>
        | undefined) ?? Promise.resolve({ error: 'No API' }),
    prefetch: (videoId: string): Promise<{ ok: boolean }> =>
      (api?.stream?.prefetch?.(videoId) as Promise<{ ok: boolean }> | undefined) ??
      Promise.resolve({ ok: false }),
    prefetchBatch: (videoIds: string[]): Promise<Array<{ videoId: string; ok: boolean }>> =>
      (api?.stream?.prefetchBatch?.(videoIds) as Promise<Array<{ videoId: string; ok: boolean }>> | undefined) ??
      Promise.resolve([]),
    hasCached: (videoId: string): Promise<{ cached: boolean }> =>
      (api?.stream?.hasCached?.(videoId) as Promise<{ cached: boolean }> | undefined) ??
      Promise.resolve({ cached: false }),
    getCached: (videoId: string): Promise<{ url?: string; expiresAt?: number; bitrate?: number; error?: string }> =>
      (api?.stream?.getCached?.(videoId) as
        | Promise<{ url?: string; expiresAt?: number; bitrate?: number; error?: string }>
        | undefined) ?? Promise.resolve({ error: 'No API' }),
  },

  download: {
    track: (track: { id: string; youtubeId: string; title: string; artist: string; album?: string; duration: number; thumbnail?: string }): Promise<{ ok: boolean; filePath?: string; error?: string }> =>
      (api?.download?.track?.(track) as Promise<any>) ?? Promise.resolve({ ok: false, error: 'No API' }),
    cancel: (downloadId: number): Promise<{ ok: boolean }> =>
      (api?.download?.cancel?.(downloadId) as Promise<any>) ?? Promise.resolve({ ok: false }),
    cancelByTrackId: (trackId: string): Promise<{ ok: boolean }> =>
      (api?.download?.cancelByTrackId?.(trackId) as Promise<any>) ?? Promise.resolve({ ok: false }),
    delete: (trackId: string): Promise<{ ok: boolean; error?: string }> =>
      (api?.download?.delete?.(trackId) as Promise<any>) ?? Promise.resolve({ ok: false }),
    hasDownload: (trackId: string): Promise<{ downloaded: boolean }> =>
      (api?.download?.hasDownload?.(trackId) as Promise<any>) ?? Promise.resolve({ downloaded: false }),
    getPath: (trackId: string): Promise<{ filePath: string | null }> =>
      (api?.download?.getPath?.(trackId) as Promise<any>) ?? Promise.resolve({ filePath: null }),
    getAll: (): Promise<{ downloads: Array<any> }> =>
      (api?.download?.getAll?.() as Promise<any>) ?? Promise.resolve({ downloads: [] }),
    getForTrack: (trackId: string): Promise<{ downloads: Array<any> }> =>
      (api?.download?.getForTrack?.(trackId) as Promise<any>) ?? Promise.resolve({ downloads: [] }),
    onDownloadProgress: (fn: (data: { trackId: string; downloadId?: number; progress: number }) => void): (() => void) =>
      api?.download?.onDownloadProgress?.(fn) ?? (() => {}),
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

  alignment: {
    /** Run the full alignment pipeline on a track. Returns generated LRC. */
    align: (videoId: string, audioUrl: string, plainLyrics: string[]): Promise<{ lrc: string; confidence: number; fromCache: boolean; error?: string }> =>
      (api?.alignment?.align(videoId, audioUrl, plainLyrics) as Promise<any>) ?? Promise.resolve({ lrc: '', confidence: 0, fromCache: false, error: 'No API' }),
    /** Check if cached aligned lyrics exist. */
    getCached: (videoId: string): Promise<{ lrc: string; confidence: number; cached: boolean }> =>
      (api?.alignment?.getCached(videoId) as Promise<any>) ?? Promise.resolve({ lrc: '', confidence: 0, cached: false }),
    /** Delete cached aligned lyrics. */
    removeCached: (videoId: string): Promise<{ ok: boolean }> =>
      (api?.alignment?.removeCached(videoId) as Promise<any>) ?? Promise.resolve({ ok: false }),
    /** Get alignment engine status. */
    getStatus: (): Promise<{ modelDownloaded: boolean; binaryFound: boolean; modelPath: string; binaryPath: string | null }> =>
      (api?.alignment?.status() as Promise<any>) ?? Promise.resolve({ modelDownloaded: false, binaryFound: false, modelPath: '', binaryPath: null }),
    /** Download the Whisper model with progress subscription. */
    downloadModel: (): Promise<{ ok: boolean }> =>
      (api?.alignment?.downloadModel() as Promise<any>) ?? Promise.resolve({ ok: false }),
    /** Subscribe to model download progress. Returns unsubscribe function. */
    onDownloadProgress: (fn: (pct: number) => void): (() => void) =>
      api?.alignment?.onDownloadProgress(fn) ?? (() => {}),
  },

  app: {
    minimize: (): void => api?.app?.minimize(),
    maximize: (): void => api?.app?.maximize(),
    close: (): void => api?.app?.close(),
    getVersion: (): Promise<string> =>
      (api?.app?.getVersion() as Promise<string> | undefined) ?? Promise.resolve('1.0.0'),
  },

  update: {
    checkForUpdates: (): Promise<{ ok: boolean; reason?: string }> =>
      (api?.update?.checkForUpdates() as Promise<any>) ?? Promise.resolve({ ok: false, reason: 'No API' }),
    quitAndInstall: (): void => api?.update?.quitAndInstall(),
    onUpdateStatus: (callback: (data: {
      status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';
      version?: string;
      releaseDate?: string;
      releaseNotes?: string;
      message?: string;
    }) => void): (() => void) =>
      api?.update?.onUpdateStatus(callback) ?? (() => {}),
    onUpdateProgress: (callback: (data: {
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }) => void): (() => void) =>
      api?.update?.onUpdateProgress(callback) ?? (() => {}),
  },
};
