/** ── Track ─────────────────────────────────────────────────────────── */
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  path: string;
  thumbnail: string;
  youtube_id: string;
  source: string;
  play_count: number;
  created_at: string;
  updated_at: string;
}

/** ── Playlist ──────────────────────────────────────────────────────── */
export interface Playlist {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  source: string;
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface PlaylistTrack {
  id: number;
  playlist_id: string;
  track_id: string;
  position: number;
  added_at: string;
}

/** ── Queue ─────────────────────────────────────────────────────────── */
export interface QueueItem {
  id: number;
  track_id: string;
  position: number;
  added_at: string;
}

/** ── Settings ──────────────────────────────────────────────────────── */
export interface Settings {
  volume: number;
  quality: string;
  theme: string;
  [key: string]: string | number | boolean;
}

/** ── Recently Played ───────────────────────────────────────────────── */
export interface RecentlyPlayed {
  id: number;
  track_id: string;
  played_at: string;
}

/** ── Favorite ──────────────────────────────────────────────────────── */
export interface Favorite {
  track_id: string;
  added_at: string;
}

/** ── Search ────────────────────────────────────────────────────────── */
export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  url: string;
  /** View count from YouTube (used for popularity-based ranking) */
  viewCount?: number;
}

/** ── Media Source ───────────────────────────────────────────────────── */
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
