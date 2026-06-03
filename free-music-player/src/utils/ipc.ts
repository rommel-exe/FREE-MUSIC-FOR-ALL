import { Track, Playlist, QueueItem, Download, SearchResult, LyricsData, Settings, SpotifyImportResult, YouTubeImportResult } from '@/types';

const api = (window as any).electronAPI;

export const ipc = {
  player: {
    play: (trackId?: string): Promise<void> => api?.player?.play(trackId),
    pause: (): Promise<void> => api?.player?.pause(),
    resume: (): Promise<void> => api?.player?.resume(),
    seek: (time: number): Promise<void> => api?.player?.seek(time),
    setVolume: (volume: number): Promise<void> => api?.player?.setVolume(volume),
    getCurrentTrack: (): Promise<Track | null> => api?.player?.getCurrentTrack(),
    getProgress: (): Promise<{ progress: number; duration: number }> => api?.player?.getProgress(),
    onTrackChange: (callback: (track: Track | null) => void) => api?.player?.onTrackChange(callback),
    onTimeUpdate: (callback: (data: { progress: number; duration: number }) => void) => api?.player?.onTimeUpdate(callback),
    onPlaybackEnd: (callback: () => void) => api?.player?.onPlaybackEnd(callback),
  },
  library: {
    getTracks: (): Promise<Track[]> => api?.library?.getTracks() ?? Promise.resolve([]),
    addTrack: (track: Partial<Track>): Promise<Track> => api?.library?.addTrack(track),
    removeTrack: (id: string): Promise<void> => api?.library?.removeTrack(id),
    searchTracks: (query: string): Promise<Track[]> => api?.library?.searchTracks(query) ?? Promise.resolve([]),
    toggleFavorite: (id: string): Promise<boolean> => api?.library?.toggleFavorite(id),
    getFavorites: (): Promise<Track[]> => api?.library?.getFavorites() ?? Promise.resolve([]),
    getRecentlyPlayed: (): Promise<Track[]> => api?.library?.getRecentlyPlayed() ?? Promise.resolve([]),
    incrementPlayCount: (id: string): Promise<void> => api?.library?.incrementPlayCount(id),
  },
  playlist: {
    getPlaylists: (): Promise<Playlist[]> => api?.playlist?.getPlaylists() ?? Promise.resolve([]),
    createPlaylist: (name: string, description?: string): Promise<Playlist> => api?.playlist?.createPlaylist(name, description),
    deletePlaylist: (id: string): Promise<void> => api?.playlist?.deletePlaylist(id),
    updatePlaylist: (id: string, data: Partial<Playlist>): Promise<void> => api?.playlist?.updatePlaylist(id, data),
    addTrackToPlaylist: (playlistId: string, trackId: string): Promise<void> => api?.playlist?.addTrackToPlaylist(playlistId, trackId),
    removeTrackFromPlaylist: (playlistId: string, trackId: string): Promise<void> => api?.playlist?.removeTrackFromPlaylist(playlistId, trackId),
    getPlaylistTracks: (playlistId: string): Promise<Track[]> => api?.playlist?.getPlaylistTracks(playlistId) ?? Promise.resolve([]),
    reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number): Promise<void> => api?.playlist?.reorderPlaylistTracks(playlistId, fromIndex, toIndex),
  },
  queue: {
    getQueue: (): Promise<QueueItem[]> => api?.queue?.getQueue() ?? Promise.resolve([]),
    addToQueue: (trackId: string): Promise<void> => api?.queue?.addToQueue(trackId),
    playNext: (trackId: string): Promise<void> => api?.queue?.playNext(trackId),
    removeFromQueue: (id: number): Promise<void> => api?.queue?.removeFromQueue(id),
    reorderQueue: (from: number, to: number): Promise<void> => api?.queue?.reorderQueue(from, to),
    clearQueue: (): Promise<void> => api?.queue?.clearQueue(),
  },
  download: {
    startDownload: (videoId: string, title: string, artist: string, thumbnail: string): Promise<void> =>
      api?.download?.startDownload(videoId, title, artist, thumbnail),
    downloadPlaylist: (tracks: any[]): Promise<any[]> => api?.download?.downloadPlaylist(tracks) ?? Promise.resolve([]),
    getDownloads: (): Promise<Download[]> => api?.download?.getDownloads() ?? Promise.resolve([]),
    cancelDownload: (id: string): Promise<void> => api?.download?.cancelDownload(id),
    removeDownload: (id: string): Promise<void> => api?.download?.removeDownload(id),
    onBatchProgress: (cb: (data: { current: number; total: number; track: string }) => void) =>
      api?.download?.onBatchProgress?.(cb),
    onBatchComplete: (cb: (data: { results: any[] }) => void) =>
      api?.download?.onBatchComplete?.(cb),
  },
  search: {
    searchYouTube: (query: string, limit?: number): Promise<SearchResult[]> =>
      api?.search?.searchYouTube(query, limit) ?? Promise.resolve([]),
    getStreamUrl: (videoId: string): Promise<string> => api?.search?.getStreamUrl(videoId) ?? Promise.resolve(''),
    getLocalStreamPath: (videoId: string): Promise<string> => api?.search?.getLocalStreamPath(videoId) ?? Promise.resolve(''),
  },
  import: {
    importSpotifyPlaylist: (url: string): Promise<SpotifyImportResult> => api?.import?.importSpotifyPlaylist(url),
    importYouTubePlaylist: (url: string): Promise<YouTubeImportResult> => api?.import?.importYouTubePlaylist(url),
    importTracks: (tracks: { title: string; artist: string; album?: string; duration?: number }[], targetPlaylistId?: string): Promise<Track[]> =>
      api?.import?.importTracks(tracks, targetPlaylistId) ?? Promise.resolve([]),
  },
  lyrics: {
    getLyrics: (track: string, artist: string, album?: string, duration?: number): Promise<LyricsData> =>
      api?.lyrics?.getLyrics(track, artist, album, duration) ?? Promise.resolve({}),
  },
  settings: {
    getSettings: (): Promise<Settings> => api?.settings?.getSettings(),
    updateSettings: (settings: Partial<Settings>): Promise<void> => api?.settings?.updateSettings(settings),
  },
  app: {
    minimize: () => api?.app?.minimize(),
    maximize: () => api?.app?.maximize(),
    close: () => api?.app?.close(),
    getVersion: (): Promise<string> => api?.app?.getVersion() ?? Promise.resolve('1.0.0'),
    openDownloadsFolder: (): Promise<string> => api?.app?.openDownloadsFolder() ?? Promise.resolve(''),
    revealInFolder: (filePath: string): Promise<void> => api?.app?.revealInFolder(filePath) ?? Promise.resolve(),
  },
  update: {
    check: (): Promise<UpdateState> => api?.update?.check() ?? Promise.resolve({ status: 'idle' }),
    download: (): Promise<UpdateState> => api?.update?.download() ?? Promise.resolve({ status: 'idle' }),
    install: (): Promise<boolean> => api?.update?.install() ?? Promise.resolve(false),
    getState: (): Promise<UpdateState> => api?.update?.getState() ?? Promise.resolve({ status: 'idle' }),
    getVersion: (): Promise<string> => api?.update?.getVersion() ?? Promise.resolve('1.0.0'),
    onStatusChange: (callback: (state: UpdateState) => void) => api?.update?.onStatusChange?.(callback),
  },
  analytics: {
    startPlay: (trackId: string, duration: number): Promise<number> =>
      api?.analytics?.startPlay(trackId, duration) ?? Promise.resolve(0),
    endPlay: (historyId: number, secondsPlayed: number, completed: boolean): Promise<boolean> =>
      api?.analytics?.endPlay(historyId, secondsPlayed, completed) ?? Promise.resolve(false),
    recordPlay: (trackId: string, secondsPlayed: number, trackDuration: number, completed: boolean): Promise<number> =>
      api?.analytics?.recordPlay(trackId, secondsPlayed, trackDuration, completed) ?? Promise.resolve(0),
    getOverview: (): Promise<AnalyticsOverview> => api?.analytics?.getOverview(),
    getTopArtists: (limit?: number): Promise<TopArtist[]> =>
      api?.analytics?.getTopArtists(limit) ?? Promise.resolve([]),
    getTopAlbums: (limit?: number): Promise<TopAlbum[]> =>
      api?.analytics?.getTopAlbums(limit) ?? Promise.resolve([]),
    getTopTracks: (limit?: number): Promise<TopTrack[]> =>
      api?.analytics?.getTopTracks(limit) ?? Promise.resolve([]),
    getListeningByDay: (days?: number): Promise<DayStat[]> =>
      api?.analytics?.getListeningByDay(days) ?? Promise.resolve([]),
    getListeningByHour: (): Promise<HourStat[]> =>
      api?.analytics?.getListeningByHour() ?? Promise.resolve([]),
    getStreak: (): Promise<{ current: number; longest: number }> =>
      api?.analytics?.getStreak() ?? Promise.resolve({ current: 0, longest: 0 }),
    getRecentPlays: (limit?: number): Promise<RecentPlay[]> =>
      api?.analytics?.getRecentPlays(limit) ?? Promise.resolve([]),
  },
};

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  releaseNotes?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  error?: string;
}

export interface AnalyticsOverview {
  totalPlays: number;
  totalSeconds: number;
  completedPlays: number;
  lastPlayedAt: string | null;
  uniqueTracks: number;
  uniqueArtists: number;
  uniqueAlbums: number;
}

export interface TopArtist {
  artist: string;
  track_count: number;
  play_count: number;
  total_seconds: number;
}

export interface TopAlbum {
  album: string;
  artist: string;
  track_count: number;
  play_count: number;
  total_seconds: number;
}

export interface TopTrack {
  track_id: string;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  play_count: number;
  total_seconds: number;
}

export interface DayStat {
  date: string;
  seconds: number;
  plays: number;
}

export interface HourStat {
  hour: number;
  seconds: number;
  plays: number;
}

export interface RecentPlay {
  id: number;
  track_id: string;
  played_at: string;
  seconds_played: number;
  track_duration: number;
  completed: number;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
}
