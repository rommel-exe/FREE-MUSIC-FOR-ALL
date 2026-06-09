/* eslint-disable @typescript-eslint/no-empty-object-type */

interface AlignmentAPI {
  align(videoId: string, audioUrl: string, plainLyrics: string[]): Promise<{
    lrc: string;
    confidence: number;
    fromCache: boolean;
    error?: string;
  }>;
  getCached(videoId: string): Promise<{ lrc: string; confidence: number; cached: boolean }>;
  removeCached(videoId: string): Promise<{ ok: boolean }>;
  status(): Promise<{ modelDownloaded: boolean; binaryFound: boolean; modelPath: string; binaryPath: string | null }>;
  downloadModel(): Promise<{ ok: boolean }>;
  onDownloadProgress(callback: (pct: number) => void): () => void;
}

interface StreamAPI {
  resolve(videoId: string, metadata?: { artist: string; title: string; expectedDuration?: number; trackId?: string }): Promise<{
    url?: string;
    expiresAt?: number;
    bitrate?: number;
    videoId?: string;
    error?: string;
  } | undefined>;
  prefetch(videoId: string): Promise<{ ok: boolean } | undefined>;
  prefetchBatch(videoIds: string[]): Promise<Array<{ videoId: string; ok: boolean }> | undefined>;
  hasCached(videoId: string): Promise<{ cached: boolean } | undefined>;
  getCached(videoId: string): Promise<{
    url?: string;
    expiresAt?: number;
    bitrate?: number;
    videoId?: string;
    error?: string;
  } | undefined>;
}

interface ElectronAPI {
  player: {
    play: (trackId?: string) => void;
    pause: () => void;
    resume: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
  };
  library: {
    getTracks: () => Promise<unknown>;
    addTrack: (track: unknown) => Promise<unknown>;
    removeTrack: (id: string) => Promise<void>;
    searchTracks: (query: string) => Promise<unknown>;
    toggleFavorite: (id: string) => Promise<boolean | undefined>;
    getFavorites: () => Promise<unknown>;
    getRecentlyPlayed: () => Promise<unknown>;
    incrementPlayCount: (id: string) => Promise<void>;
    addRecentlyPlayed: (id: string) => Promise<void>;
  };
  playlist: {
    getPlaylists: () => Promise<unknown>;
    createPlaylist: (name: string, description?: string) => Promise<unknown>;
    deletePlaylist: (id: string) => Promise<void>;
    updatePlaylist: (id: string, data: unknown) => Promise<void>;
    addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
    removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
    getPlaylistTracks: (playlistId: string) => Promise<unknown>;
    reorderPlaylistTracks: (playlistId: string, from: number, to: number) => Promise<void>;
  };
  queue: {
    getQueue: () => Promise<unknown>;
    addToQueue: (trackId: string) => Promise<void>;
    playNext: (trackId: string) => Promise<void>;
    removeFromQueue: (id: number) => Promise<void>;
    reorderQueue: (from: number, to: number) => Promise<void>;
    clearQueue: () => Promise<void>;
  };
  search: {
    searchYouTube: (query: string, limit?: number) => Promise<unknown>;
    verify: (results: Array<{ id: string; title: string; artist: string }>) => Promise<{ ok: boolean }>;
    getVerified: (videoIds: string[]) => Promise<Record<string, { playable: boolean; trustScore: number }>>;
  };
  settings: {
    getSettings: () => Promise<unknown>;
    updateSettings: (partial: unknown) => Promise<void>;
    getSession: () => Promise<unknown>;
    saveSession: (session: unknown) => Promise<void>;
  };
  download: {
    track(track: {
      id: string;
      youtubeId: string;
      title: string;
      artist: string;
      album?: string;
      duration: number;
      thumbnail?: string;
    }): Promise<{ ok: boolean; filePath?: string; error?: string }>;
    cancel(downloadId: number): Promise<{ ok: boolean }>;
    cancelByTrackId(trackId: string): Promise<{ ok: boolean }>;
    delete(trackId: string): Promise<{ ok: boolean; error?: string }>;
    hasDownload(trackId: string): Promise<{ downloaded: boolean }>;
    getPath(trackId: string): Promise<{ filePath: string | null }>;
    getAll(): Promise<{ downloads: Array<{
      id: number;
      trackId: string;
      videoId: string;
      title: string;
      artist: string;
      filePath: string;
      fileSize: number;
      status: string;
      progress: number;
      error: string;
      createdAt: string;
      completedAt: string | null;
    }> }>;
    getForTrack(trackId: string): Promise<{ downloads: Array<Record<string, unknown>> }>;
    onDownloadProgress(callback: (data: { trackId: string; downloadId?: number; progress: number }) => void): () => void;
  };
  stream: StreamAPI;
  alignment: AlignmentAPI;
  import: {
    youtube: (url: string) => Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string; youtubeId: string }> }>;
    spotify: (url: string) => Promise<{ name: string; tracks: Array<{ title: string; artist: string; duration: number; thumbnail: string }> }>;
    asPlaylist: (url: string, playlistName?: string) => Promise<{
      playlist: { id: string; name: string; trackCount: number };
      imported: number;
      total: number;
      failed: number;
    }>;
  };
  app: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    getVersion: () => Promise<string | undefined>;
  };
  update: {
    checkForUpdates: () => Promise<{ ok: boolean; reason?: string }>;
    quitAndInstall: () => void;
    onUpdateStatus: (callback: (data: {
      status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';
      version?: string;
      releaseDate?: string;
      releaseNotes?: string;
      message?: string;
    }) => void) => () => void;
    onUpdateProgress: (callback: (data: {
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    }) => void) => () => void;
  };
  onGlobalShortcut?: (channel: string, callback: () => void) => (() => void) | void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
