import { contextBridge, ipcRenderer } from 'electron';

// ─── Helpers ────────────────────────────────────────────────────────────

function invoke(channel: string, ...args: unknown[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args);
}

function send(channel: string, ...args: unknown[]): void {
  ipcRenderer.send(channel, ...args);
}

function on(channel: string, callback: (...args: unknown[]) => void): () => void {
  const handler = (_event: any, ...args: unknown[]) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => { ipcRenderer.removeListener(channel, handler); };
}

// ─── Expose API to Renderer ────────────────────────────────────────────
// Channel names MUST match what src/utils/ipc.ts calls.

contextBridge.exposeInMainWorld('electronAPI', {
  player: {
    play: (trackId?: string) => send('player:play', trackId),
    pause: () => send('player:pause'),
    resume: () => send('player:resume'),
    seek: (time: number) => send('player:seek', time),
    setVolume: (volume: number) => send('player:setVolume', volume),
    getCurrentTrack: () => invoke('player:getCurrentTrack'),
    getProgress: () => invoke('player:getProgress'),
    onTrackChange: (cb: (track: unknown) => void) => on('player:trackChange', cb),
    onTimeUpdate: (cb: (data: unknown) => void) => on('player:timeUpdate', cb),
    onPlaybackEnd: (cb: () => void) => on('player:playbackEnd', cb),
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

  download: {
    startDownload: (videoId: string, title: string, artist: string, thumbnail: string) =>
      invoke('download:startDownload', videoId, title, artist, thumbnail),
    downloadPlaylist: (tracks: any[]) => invoke('download:downloadPlaylist', tracks),
    getDownloads: () => invoke('download:getDownloads'),
    cancelDownload: (id: string) => invoke('download:cancelDownload', id),
    removeDownload: (id: string) => invoke('download:removeDownload', id),
    onBatchProgress: (cb: (data: any) => void) => on('download:batchProgress', cb),
    onBatchComplete: (cb: (data: any) => void) => on('download:batchComplete', cb),
  },

  search: {
    searchYouTube: (query: string, limit?: number) => invoke('search:youtube', query, limit),
    getStreamUrl: (videoId: string) => invoke('search:getStreamUrl', videoId),
    getLocalStreamPath: (videoId: string) => invoke('search:getLocalStreamPath', videoId),
  },

  import: {
    importSpotifyPlaylist: (url: string) => invoke('import:importSpotifyPlaylist', url),
    importYouTubePlaylist: (url: string) => invoke('import:importYouTubePlaylist', url),
    importTracks: (tracks: unknown, targetPlaylistId?: string) => invoke('import:importTracks', tracks, targetPlaylistId),
  },

  lyrics: {
    getLyrics: (track: string, artist: string, album?: string, duration?: number) =>
      invoke('lyrics:getLyrics', track, artist, album, duration),
  },

  settings: {
    getSettings: () => invoke('settings:getSettings'),
    updateSettings: (partial: unknown) => invoke('settings:updateSettings', partial),
  },

  app: {
    minimize: () => send('app:minimize'),
    maximize: () => send('app:maximize'),
    close: () => send('app:close'),
    getVersion: (): Promise<string> => invoke('app:getVersion'),
    openDownloadsFolder: () => invoke('shell:openDownloadsFolder'),
    revealInFolder: (filePath: string) => invoke('shell:revealInFolder', filePath),
  },

  update: {
    check: () => invoke('update:check'),
    download: () => invoke('update:download'),
    install: () => invoke('update:install'),
    getState: () => invoke('update:getState'),
    getVersion: (): Promise<string> => invoke('update:getVersion'),
    onStatusChange: (cb: (state: any) => void) => on('update:status', cb),
  },

  analytics: {
    startPlay: (trackId: string, duration: number) => invoke('analytics:startPlay', trackId, duration),
    endPlay: (historyId: number, secondsPlayed: number, completed: boolean) =>
      invoke('analytics:endPlay', historyId, secondsPlayed, completed),
    recordPlay: (trackId: string, secondsPlayed: number, trackDuration: number, completed: boolean) =>
      invoke('analytics:recordPlay', trackId, secondsPlayed, trackDuration, completed),
    resolveTrackForPlay: (videoId: string) => invoke('analytics:resolveTrackForPlay', videoId),
    getOverview: () => invoke('analytics:getOverview'),
    getTopArtists: (limit?: number) => invoke('analytics:getTopArtists', limit),
    getTopAlbums: (limit?: number) => invoke('analytics:getTopAlbums', limit),
    getTopTracks: (limit?: number) => invoke('analytics:getTopTracks', limit),
    getListeningByDay: (days?: number) => invoke('analytics:getListeningByDay', days),
    getListeningByHour: () => invoke('analytics:getListeningByHour'),
    getStreak: () => invoke('analytics:getStreak'),
    getRecentPlays: (limit?: number) => invoke('analytics:getRecentPlays', limit),
  },
});
