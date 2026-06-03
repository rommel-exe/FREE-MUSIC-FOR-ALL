export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  thumbnail: string;
  path: string;
  youtubeId: string;
  source: 'local' | 'youtube' | 'spotify';
  isFavorite: boolean;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  source: string;
  sourceUrl: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueueItem {
  id: number;
  trackId: string;
  position: number;
  track?: Track;
  addedAt: string;
}

export interface Download {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  outputPath: string;
  thumbnail: string;
  speed: string;
  eta: string;
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  url: string;
  viewCount?: number;
}

export interface LyricsData {
  plain?: string;
  synced?: SyncedLyric[];
}

export interface SyncedLyric {
  time: number;
  text: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Settings {
  downloadPath: string;
  downloadFormat: 'mp3' | 'flac' | 'ogg' | 'm4a';
  audioQuality: 'low' | 'medium' | 'high';
  crossfadeDuration: number;
  theme: 'dark' | 'light';
  miniPlayerOnClose: boolean;
  startupAction: 'none' | 'resume' | 'lastPlaylist';
  equalizerPreset: string;
  volume: number;
}

export interface SpotifyImportResult {
  name: string;
  description: string;
  thumbnail: string;
  tracks: { title: string; artist: string; album: string; duration: number }[];
}

export interface YouTubeImportResult {
  name: string;
  description: string;
  thumbnail: string;
  tracks: { title: string; artist: string; duration: number; videoId: string; thumbnail: string }[];
}
