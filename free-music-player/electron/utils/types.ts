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
  downloadPath: string;
  theme: string;
  miniPlayer: boolean;
  alwaysOnTop: boolean;
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

/** ── YouTube / Search ──────────────────────────────────────────────── */
export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  url: string;
}

export interface PlaylistTrackResult extends SearchResult {
  position: number;
}

/** ── YouTube Music ─────────────────────────────────────────────────── */
export interface YTMusicThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface YTMusicSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  thumbnails: YTMusicThumbnail[];
  type: 'song' | 'video' | 'album' | 'artist' | 'playlist';
}

export interface YTMusicSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  thumbnails: YTMusicThumbnail[];
  year?: string;
  likeStatus?: string;
}

export interface YTMusicAlbum {
  id: string;
  title: string;
  artist: string;
  year?: string;
  thumbnails: YTMusicThumbnail[];
  tracks: YTMusicSong[];
}

export interface YTMusicArtist {
  id: string;
  name: string;
  thumbnails: YTMusicThumbnail[];
  description?: string;
  subscribers?: string;
}

export interface YTMusicPlaylist {
  id: string;
  title: string;
  description?: string;
  thumbnails: YTMusicThumbnail[];
  trackCount: number;
  tracks: YTMusicSong[];
}

/** ── Lyrics ────────────────────────────────────────────────────────── */
export interface LyricsResult {
  plain?: string;
  synced?: { time: number; text: string }[];
}

/** ── Downloads ─────────────────────────────────────────────────────── */
export interface DownloadItem {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'cancelled' | 'error';
  outputPath?: string;
  error?: string;
  startedAt: string;
}

/** ── Spotify Import ────────────────────────────────────────────────── */
export interface SpotifyTrack {
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export interface SpotifyPlaylistImport {
  name: string;
  description: string;
  thumbnail: string;
  tracks: SpotifyTrack[];
}

/** ── YouTube Playlist Import ───────────────────────────────────────── */
export interface YTPlaylistTrack {
  title: string;
  artist: string;
  duration: number;
  videoId: string;
  thumbnail: string;
}

export interface YTPlaylistImport {
  name: string;
  description: string;
  thumbnail: string;
  tracks: YTPlaylistTrack[];
}
