/* eslint-disable @typescript-eslint/no-empty-object-type */
interface StreamAPI {
  resolve(videoId: string): Promise<{
    url?: string;
    expiresAt?: number;
    bitrate?: number;
    error?: string;
  } | undefined>;
  prefetch(videoId: string): Promise<{ ok: boolean } | undefined>;
  hasCached(videoId: string): Promise<{ cached: boolean } | undefined>;
  getCached(videoId: string): Promise<{
    url?: string;
    expiresAt?: number;
    bitrate?: number;
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
  };
  settings: {
    getSettings: () => Promise<unknown>;
    updateSettings: (partial: unknown) => Promise<void>;
    getSession: () => Promise<unknown>;
    saveSession: (session: unknown) => Promise<void>;
  };
  stream: StreamAPI;
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
  onGlobalShortcut?: (channel: string, callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
