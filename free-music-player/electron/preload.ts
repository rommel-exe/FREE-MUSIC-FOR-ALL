import { contextBridge, ipcRenderer } from 'electron';

function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function send(channel: string, ...args: unknown[]): void {
  ipcRenderer.send(channel, ...args);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Global shortcut listeners
  onGlobalShortcut: (channel: string, callback: () => void) => {
    const validChannels = ['global:playPause', 'global:nextTrack', 'global:previousTrack', 'global:pause'];
    if (validChannels.includes(channel)) {
      const wrapper = () => callback();
      ipcRenderer.on(channel, wrapper);
      return () => {
        ipcRenderer.removeListener(channel, wrapper);
      };
    }
    return () => {};
  },

  player: {
    play: (trackId?: string) => send('player:play', trackId),
    pause: () => send('player:pause'),
    resume: () => send('player:resume'),
    seek: (time: number) => send('player:seek', time),
    setVolume: (volume: number) => send('player:setVolume', volume),
  },

  library: {
    getTracks: () => invoke('library:getTracks'),
    addTrack: (track: unknown) => invoke('library:addTrack', track),
    removeTrack: (id: string) => invoke('library:removeTrack', id),
    searchTracks: (query: string) => invoke('library:searchTracks', query),
    toggleFavorite: (id: string) => invoke('library:toggleFavorite', id),
    getFavorites: () => invoke('library:getFavorites'),
    getRecentlyPlayed: () => invoke('library:getRecentlyPlayed'),
    incrementPlayCount: (id: string) => invoke('library:incrementPlayCount', id),
    addRecentlyPlayed: (id: string) => invoke('library:addRecentlyPlayed', id),
  },

  playlist: {
    getPlaylists: () => invoke('playlist:getPlaylists'),
    createPlaylist: (name: string, description?: string) => invoke('playlist:createPlaylist', name, description),
    deletePlaylist: (id: string) => invoke('playlist:deletePlaylist', id),
    updatePlaylist: (id: string, data: unknown) => invoke('playlist:updatePlaylist', id, data),
    addTrackToPlaylist: (playlistId: string, trackId: string) => invoke('playlist:addTrackToPlaylist', playlistId, trackId),
    removeTrackFromPlaylist: (playlistId: string, trackId: string) => invoke('playlist:removeTrackFromPlaylist', playlistId, trackId),
    getPlaylistTracks: (playlistId: string) => invoke('playlist:getPlaylistTracks', playlistId),
    reorderPlaylistTracks: (playlistId: string, from: number, to: number) => invoke('playlist:reorderPlaylistTracks', playlistId, from, to),
  },

  queue: {
    getQueue: () => invoke('queue:getQueue'),
    addToQueue: (trackId: string) => invoke('queue:addToQueue', trackId),
    playNext: (trackId: string) => invoke('queue:playNext', trackId),
    removeFromQueue: (id: number) => invoke('queue:removeFromQueue', id),
    reorderQueue: (from: number, to: number) => invoke('queue:reorderQueue', from, to),
    clearQueue: () => invoke('queue:clearQueue'),
  },

  search: {
    searchYouTube: (query: string, limit?: number) => invoke('search:youtube', query, limit),
    /** Trigger background verification for search results. */
    verify: (results: Array<{ id: string; title: string; artist: string }>) =>
      invoke('search:verify', results),
    /** Batch-lookup verification status for video IDs. Returns Record<videoId, VerifiedTrack>. */
    getVerified: (videoIds: string[]) => invoke('search:getVerified', videoIds),
  },

  settings: {
    getSettings: () => invoke('settings:getSettings'),
    updateSettings: (partial: unknown) => invoke('settings:updateSettings', partial),
    getSession: () => invoke('settings:getSession'),
    saveSession: (session: unknown) => invoke('settings:saveSession', session),
  },

  stream: {
    resolve: (videoId: string, metadata?: { artist: string; title: string; expectedDuration?: number; trackId?: string }): Promise<{ url?: string; expiresAt?: number; bitrate?: number; videoId?: string; error?: string }> =>
      invoke('stream:resolve', videoId, metadata),
    prefetch: (videoId: string): Promise<{ ok: boolean }> => invoke('stream:prefetch', videoId),
    prefetchBatch: (videoIds: string[]): Promise<Array<{ videoId: string; ok: boolean }>> => invoke('stream:prefetchBatch', videoIds),
    hasCached: (videoId: string): Promise<{ cached: boolean }> => invoke('stream:hasCached', videoId),
    getCached: (videoId: string): Promise<{ url?: string; expiresAt?: number; bitrate?: number; videoId?: string; error?: string }> =>
      invoke('stream:getCached', videoId),
  },

  download: {
    track: (track: {
      id: string;
      youtubeId: string;
      title: string;
      artist: string;
      album?: string;
      duration: number;
      thumbnail?: string;
    }): Promise<{ ok: boolean; filePath?: string; error?: string }> =>
      invoke('download:track', track),
    cancel: (downloadId: number): Promise<{ ok: boolean }> =>
      invoke('download:cancel', downloadId),
    cancelByTrackId: (trackId: string): Promise<{ ok: boolean }> =>
      invoke('download:cancelByTrackId', trackId),
    delete: (trackId: string): Promise<{ ok: boolean; error?: string }> =>
      invoke('download:delete', trackId),
    hasDownload: (trackId: string): Promise<{ downloaded: boolean }> =>
      invoke('download:hasDownload', trackId),
    getPath: (trackId: string): Promise<{ filePath: string | null }> =>
      invoke('download:getPath', trackId),
    getAll: (): Promise<{ downloads: Array<{ id: number; trackId: string; videoId: string; title: string; artist: string; filePath: string; fileSize: number; status: string; progress: number; error: string; createdAt: string; completedAt: string | null }> }> =>
      invoke('download:getAll'),
    getForTrack: (trackId: string): Promise<{ downloads: any[] }> =>
      invoke('download:getForTrack', trackId),
    onDownloadProgress: (callback: (data: { trackId: string; downloadId?: number; progress: number }) => void) => {
      const wrapper = (_event: unknown, data: { trackId: string; downloadId?: number; progress: number }) => callback(data);
      ipcRenderer.on('download:progress', wrapper);
      return () => { ipcRenderer.removeListener('download:progress', wrapper); };
    },
  },

  import: {
    youtube: (url: string): Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string; youtubeId: string }> }> =>
      invoke('import:youtube', url),
    spotify: (url: string): Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string }> }> =>
      invoke('import:spotify', url),
    asPlaylist: (url: string, playlistName?: string): Promise<{
      playlist: { id: string; name: string; trackCount: number };
      imported: number;
      total: number;
      failed: number;
    }> => invoke('import:asPlaylist', url, playlistName),
  },

  alignment: {
    /** Run alignment on a track. Returns generated LRC or error. */
    align: (videoId: string, audioUrl: string, plainLyrics: string[]): Promise<{ lrc: string; confidence: number; fromCache: boolean; error?: string }> =>
      invoke('alignment:align', videoId, audioUrl, plainLyrics),
    /** Check if cached aligned lyrics exist for a video ID. */
    getCached: (videoId: string): Promise<{ lrc: string; confidence: number; cached: boolean }> =>
      invoke('alignment:getCached', videoId),
    /** Delete cached aligned lyrics. */
    removeCached: (videoId: string): Promise<{ ok: boolean }> =>
      invoke('alignment:removeCached', videoId),
    /** Get engine status (model/binary availability). */
    status: (): Promise<{ modelDownloaded: boolean; binaryFound: boolean; modelPath: string; binaryPath: string | null }> =>
      invoke('alignment:status'),
    /** Download the Whisper Base model (with progress events). */
    downloadModel: (): Promise<{ ok: boolean }> =>
      invoke('alignment:downloadModel'),
    /** Listen for model download progress (0–100). */
    onDownloadProgress: (callback: (pct: number) => void) => {
      const wrapper = (_event: unknown, pct: number) => callback(pct);
      ipcRenderer.on('alignment:downloadProgress', wrapper);
      return () => { ipcRenderer.removeListener('alignment:downloadProgress', wrapper); };
    },
  },

  app: {
    minimize: () => send('app:minimize'),
    maximize: () => send('app:maximize'),
    close: () => send('app:close'),
    getVersion: (): Promise<string> => invoke('app:getVersion'),
  },

  update: {
    checkForUpdates: (): Promise<{ ok: boolean; reason?: string }> =>
      invoke('update:check'),
    quitAndInstall: (): void => send('update:quitAndInstall'),
    onUpdateStatus: (callback: (data: {
      status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';
      version?: string;
      releaseDate?: string;
      releaseNotes?: string;
      message?: string;
    }) => void) => {
      const wrapper = (_event: unknown, data: any) => callback(data);
      ipcRenderer.on('update:status', wrapper);
      return () => { ipcRenderer.removeListener('update:status', wrapper); };
    },
    onUpdateProgress: (callback: (data: {
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }) => void) => {
      const wrapper = (_event: unknown, data: any) => callback(data);
      ipcRenderer.on('update:progress', wrapper);
      return () => { ipcRenderer.removeListener('update:progress', wrapper); };
    },
  },
});
