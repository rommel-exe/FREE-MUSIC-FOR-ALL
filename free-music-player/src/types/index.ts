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

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  url: string;
  viewCount?: number;
}

export interface Settings {
  volume: number;
  theme: 'dark' | 'light';
  [key: string]: string | number | boolean;
}

/** ── Media Source ──────────────────────────────────────────────────── */
export interface MediaSource {
  /** Local HTTP proxy URL (same-origin, no CORS issues) */
  audioUrl: string;
  /** Unix timestamp (ms) when this source expires */
  expiresAt: number;
  /** Audio bitrate in kbps */
  bitrate: number;
  /** Original YouTube video ID */
  videoId: string;
}
