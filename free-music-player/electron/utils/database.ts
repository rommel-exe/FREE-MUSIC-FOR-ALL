import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { ensureDirectoryExists } from './file-utils';
import type {
  Track,
  Playlist,
  PlaylistTrack,
  QueueItem,
  Settings,
  RecentlyPlayed,
  Favorite,
} from './types';

let db: Database.Database | null = null;

// ─── Initialisation ────────────────────────────────────────────────────

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbDir = path.join(app.getPath('userData'), 'data');
  ensureDirectoryExists(dbDir);

  db = new Database(path.join(dbDir, 'player.db'));

  // WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Schema ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      artist      TEXT NOT NULL DEFAULT '',
      album       TEXT NOT NULL DEFAULT '',
      duration    INTEGER NOT NULL DEFAULT 0,
      path        TEXT NOT NULL DEFAULT '',
      thumbnail   TEXT NOT NULL DEFAULT '',
      youtube_id  TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL DEFAULT 'local',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      thumbnail   TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL DEFAULT '',
      source_url  TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id TEXT NOT NULL,
      track_id    TEXT NOT NULL,
      position    INTEGER NOT NULL DEFAULT 0,
      added_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id   TEXT NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0,
      added_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recently_played (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id  TEXT NOT NULL,
      played_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      track_id TEXT PRIMARY KEY,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_queue_position        ON queue(position);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos   ON playlist_tracks(playlist_id, position);
    CREATE INDEX IF NOT EXISTS idx_recently_played_date  ON recently_played(played_at);

    -- ── Play history: one row per play session ──────────────────────────
    -- Tracks when songs were played, how long the user actually listened,
    -- and whether they completed or skipped. Powers the Analytics page.
    CREATE TABLE IF NOT EXISTS play_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id        TEXT NOT NULL,
      played_at       TEXT NOT NULL DEFAULT (datetime('now')),
      seconds_played  REAL    NOT NULL DEFAULT 0,
      track_duration  REAL    NOT NULL DEFAULT 0,
      completed       INTEGER NOT NULL DEFAULT 0,  -- 1 = full song, 0 = skipped
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_play_history_date    ON play_history(played_at);
    CREATE INDEX IF NOT EXISTS idx_play_history_track   ON play_history(track_id);
  `);

  // Seed default settings
  const defaults: Record<string, string> = {
    volume: '0.8',
    quality: 'highest',
    downloadPath: '',
    theme: 'dark',
    miniPlayer: 'false',
    alwaysOnTop: 'false',
  };

  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) {
    upsert.run(k, v);
  }

  return db;
}

export function getDb(): Database.Database {
  if (!db) return initDatabase();
  return db;
}

// ─── Tracks ────────────────────────────────────────────────────────────

export function getAllTracks(): Track[] {
  return getDb().prepare('SELECT * FROM tracks ORDER BY created_at DESC').all() as Track[];
}

export function getTrackById(id: string): Track | undefined {
  return getDb().prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Track | undefined;
}

export function addTrack(track: Omit<Track, 'created_at' | 'updated_at'>): Track {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO tracks (id, title, artist, album, duration, path, thumbnail, youtube_id, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(track.id, track.title, track.artist, track.album, track.duration, track.path, track.thumbnail, track.youtube_id, track.source, now, now);
  return getTrackById(track.id)!;
}

/**
 * Add a track or update it if a track with the same id already exists.
 * Used by the download flow — tracks are inserted with empty `path` during
 * import, then need their `path` updated when the file is downloaded.
 */
export function addOrUpdateTrack(track: Omit<Track, 'created_at' | 'updated_at'>): Track {
  const existing = getTrackById(track.id);
  if (existing) {
    return updateTrack(track.id, track)!;
  }
  return addTrack(track);
}

/**
 * Find a track by its YouTube ID. Used to link downloaded files back to
 * the library entry created during playlist import.
 */
export function getTrackByYouTubeId(youtubeId: string): Track | undefined {
  if (!youtubeId) return undefined;
  return getDb()
    .prepare('SELECT * FROM tracks WHERE youtube_id = ?')
    .get(youtubeId) as Track | undefined;
}

export function updateTrack(id: string, updates: Partial<Omit<Track, 'id' | 'created_at'>>): Track | undefined {
  const existing = getTrackById(id);
  if (!existing) return undefined;

  const fields = Object.keys(updates).filter((k) => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return existing;

  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(new Date().toISOString(), id);

  getDb()
    .prepare(`UPDATE tracks SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...values);

  return getTrackById(id);
}

export function removeTrack(id: string): boolean {
  const result = getDb().prepare('DELETE FROM tracks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function searchTracks(query: string): Track[] {
  const pattern = `%${query}%`;
  return getDb()
    .prepare(
      `SELECT * FROM tracks
       WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
       ORDER BY created_at DESC`,
    )
    .all(pattern, pattern, pattern) as Track[];
}

// ─── Playlists ─────────────────────────────────────────────────────────

export function getAllPlaylists(): Playlist[] {
  return getDb().prepare('SELECT * FROM playlists ORDER BY created_at DESC').all() as Playlist[];
}

export function getPlaylistById(id: string): Playlist | undefined {
  return getDb().prepare('SELECT * FROM playlists WHERE id = ?').get(id) as Playlist | undefined;
}

export function createPlaylist(playlist: Omit<Playlist, 'created_at' | 'updated_at'>): Playlist {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO playlists (id, name, description, thumbnail, source, source_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(playlist.id, playlist.name, playlist.description, playlist.thumbnail, playlist.source, playlist.source_url, now, now);
  return getPlaylistById(playlist.id)!;
}

export function updatePlaylist(id: string, updates: Partial<Omit<Playlist, 'id' | 'created_at'>>): Playlist | undefined {
  const existing = getPlaylistById(id);
  if (!existing) return undefined;

  const fields = Object.keys(updates).filter((k) => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return existing;

  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(new Date().toISOString(), id);

  getDb()
    .prepare(`UPDATE playlists SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...values);

  return getPlaylistById(id);
}

export function deletePlaylist(id: string): boolean {
  const result = getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── Playlist Tracks ───────────────────────────────────────────────────

export function getPlaylistTracks(playlistId: string): PlaylistTrack[] {
  return getDb()
    .prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC')
    .all(playlistId) as PlaylistTrack[];
}

export function addTrackToPlaylist(playlistId: string, trackId: string, position?: number): PlaylistTrack {
  const maxPos = getDb()
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM playlist_tracks WHERE playlist_id = ?')
    .get(playlistId) as { maxPos: number };

  const pos = position ?? maxPos.maxPos + 1;
  const now = new Date().toISOString();

  getDb()
    .prepare(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)',
    )
    .run(playlistId, trackId, pos, now);

  return getDb()
    .prepare(
      'SELECT * FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
    )
    .get(playlistId, trackId) as PlaylistTrack;
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
    .run(playlistId, trackId);

  if (result.changes > 0) {
    // Re-index positions
    const remaining = getPlaylistTracks(playlistId);
    const update = getDb().prepare('UPDATE playlist_tracks SET position = ? WHERE id = ?');
    remaining.forEach((pt, i) => update.run(i, pt.id));
    return true;
  }
  return false;
}

export function reorderPlaylistTracks(playlistId: string, trackIds: string[]): void {
  const update = getDb().prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?');
  const reorder = getDb().transaction((ids: string[]) => {
    ids.forEach((trackId, i) => update.run(i, playlistId, trackId));
  });
  reorder(trackIds);
}

// ─── Queue ─────────────────────────────────────────────────────────────

export function getQueue(): QueueItem[] {
  return getDb().prepare('SELECT * FROM queue ORDER BY position ASC').all() as QueueItem[];
}

export function addToQueue(trackId: string, position?: number): QueueItem {
  const maxPos = getDb()
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM queue')
    .get() as { maxPos: number };

  const pos = position ?? maxPos.maxPos + 1;
  const now = new Date().toISOString();

  getDb()
    .prepare('INSERT INTO queue (track_id, position, added_at) VALUES (?, ?, ?)')
    .run(trackId, pos, now);

  const row = getDb()
    .prepare('SELECT * FROM queue WHERE track_id = ? AND position = ?')
    .get(trackId, pos) as QueueItem;
  return row;
}

export function removeFromQueue(id: number): boolean {
  const result = getDb().prepare('DELETE FROM queue WHERE id = ?').run(id);
  if (result.changes > 0) {
    const remaining = getQueue();
    const update = getDb().prepare('UPDATE queue SET position = ? WHERE id = ?');
    remaining.forEach((q, i) => update.run(i, q.id));
    return true;
  }
  return false;
}

export function clearQueue(): void {
  getDb().prepare('DELETE FROM queue').run();
}

export function reorderQueue(trackIds: string[]): void {
  const update = getDb().prepare('UPDATE queue SET position = ? WHERE id = ?');
  const reorder = getDb().transaction((ids: string[]) => {
    ids.forEach((id, i) => update.run(i, id));
  });
  reorder(trackIds);
}

// ─── Settings ──────────────────────────────────────────────────────────

export function getSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function updateSettings(partial: Record<string, string | number | boolean>): void {
  const upsert = getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const updateAll = getDb().transaction((entries: [string, string][]) => {
    for (const [k, v] of entries) upsert.run(k, String(v));
  });
  updateAll(Object.entries(partial) as [string, string][]);
}

// ─── Recently Played ───────────────────────────────────────────────────

export function addRecentlyPlayed(trackId: string): void {
  const now = new Date().toISOString();
  getDb().prepare('INSERT INTO recently_played (track_id, played_at) VALUES (?, ?)').run(trackId, now);

  // Keep only the last 100 entries
  getDb()
    .prepare(
      `DELETE FROM recently_played
       WHERE id NOT IN (
         SELECT id FROM recently_played ORDER BY played_at DESC LIMIT 100
       )`,
    )
    .run();
}

export function getRecentlyPlayed(limit = 50): RecentlyPlayed[] {
  return getDb()
    .prepare('SELECT * FROM recently_played ORDER BY played_at DESC LIMIT ?')
    .all(limit) as RecentlyPlayed[];
}

// ─── Favorites ─────────────────────────────────────────────────────────

export function addFavorite(trackId: string): void {
  const now = new Date().toISOString();
  getDb().prepare('INSERT OR IGNORE INTO favorites (track_id, added_at) VALUES (?, ?)').run(trackId, now);
}

export function removeFavorite(trackId: string): boolean {
  const result = getDb().prepare('DELETE FROM favorites WHERE track_id = ?').run(trackId);
  return result.changes > 0;
}

export function isFavorite(trackId: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM favorites WHERE track_id = ?').get(trackId);
  return !!row;
}

export function getFavorites(): Favorite[] {
  return getDb().prepare('SELECT * FROM favorites ORDER BY added_at DESC').all() as Favorite[];
}

// ─── Play History ──────────────────────────────────────────────────────

export interface PlayHistoryEntry {
  id: number;
  track_id: string;
  played_at: string;
  seconds_played: number;
  track_duration: number;
  completed: number;
}

/** Insert a new play history row (returns the id). */
export function recordPlayStart(trackId: string, trackDuration: number): number {
  const result = getDb()
    .prepare(
      `INSERT INTO play_history (track_id, track_duration, seconds_played, completed)
       VALUES (?, ?, 0, 0)`,
    )
    .run(trackId, trackDuration);
  return Number(result.lastInsertRowid);
}

/** Update the duration played and whether the song completed. */
export function recordPlayEnd(historyId: number, secondsPlayed: number, completed: boolean): void {
  getDb()
    .prepare(
      `UPDATE play_history SET seconds_played = ?, completed = ? WHERE id = ?`,
    )
    .run(secondsPlayed, completed ? 1 : 0, historyId);
}

/** Get recent N plays with joined track info. */
export function getRecentPlays(limit: number = 50) {
  return getDb()
    .prepare(
      `SELECT ph.*, t.title, t.artist, t.album, t.thumbnail, t.duration as track_total_duration
       FROM play_history ph
       LEFT JOIN tracks t ON t.id = ph.track_id
       ORDER BY ph.played_at DESC
       LIMIT ?`,
    )
    .all(limit);
}

/** Compute overview metrics: total plays, total seconds, unique tracks/artists/albums. */
export function getAnalyticsOverview() {
  const d = getDb();
  const totals = d
    .prepare(
      `SELECT
         COUNT(*)                                              AS total_plays,
         COALESCE(SUM(seconds_played), 0)                       AS total_seconds,
         COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS completed_plays,
         COALESCE(MAX(played_at), '')                          AS last_played_at
       FROM play_history`,
    )
    .get() as any;

  // Unique counts from the tracks table (joined via play_history so we only count played)
  const uniqueTracks = d
    .prepare(
      `SELECT COUNT(DISTINCT ph.track_id) AS c
       FROM play_history ph`,
    )
    .get() as any;

  const uniqueArtists = d
    .prepare(
      `SELECT COUNT(DISTINCT LOWER(TRIM(t.artist))) AS c
       FROM play_history ph
       JOIN tracks t ON t.id = ph.track_id
       WHERE t.artist != ''`,
    )
    .get() as any;

  const uniqueAlbums = d
    .prepare(
      `SELECT COUNT(DISTINCT LOWER(TRIM(t.album))) AS c
       FROM play_history ph
       JOIN tracks t ON t.id = ph.track_id
       WHERE t.album != ''`,
    )
    .get() as any;

  return {
    totalPlays: totals?.total_plays ?? 0,
    totalSeconds: Math.round(totals?.total_seconds ?? 0),
    completedPlays: totals?.completed_plays ?? 0,
    lastPlayedAt: totals?.last_played_at || null,
    uniqueTracks: uniqueTracks?.c ?? 0,
    uniqueArtists: uniqueArtists?.c ?? 0,
    uniqueAlbums: uniqueAlbums?.c ?? 0,
  };
}

/** Top N artists by total seconds listened. */
export function getTopArtists(limit: number = 10) {
  return getDb()
    .prepare(
      `SELECT
         t.artist                                                    AS artist,
         COUNT(DISTINCT ph.track_id)                                 AS track_count,
         COUNT(*)                                                    AS play_count,
         COALESCE(SUM(ph.seconds_played), 0)                         AS total_seconds
       FROM play_history ph
       JOIN tracks t ON t.id = ph.track_id
       WHERE t.artist != ''
       GROUP BY LOWER(TRIM(t.artist))
       ORDER BY total_seconds DESC
       LIMIT ?`,
    )
    .all(limit);
}

/** Top N albums by total seconds listened. */
export function getTopAlbums(limit: number = 10) {
  return getDb()
    .prepare(
      `SELECT
         t.album                                                     AS album,
         t.artist                                                    AS artist,
         COUNT(DISTINCT ph.track_id)                                 AS track_count,
         COUNT(*)                                                    AS play_count,
         COALESCE(SUM(ph.seconds_played), 0)                         AS total_seconds
       FROM play_history ph
       JOIN tracks t ON t.id = ph.track_id
       WHERE t.album != ''
       GROUP BY LOWER(TRIM(t.album)), LOWER(TRIM(t.artist))
       ORDER BY total_seconds DESC
       LIMIT ?`,
    )
    .all(limit);
}

/** Top N tracks by total seconds listened. */
export function getTopTracks(limit: number = 10) {
  return getDb()
    .prepare(
      `SELECT
         t.id                                                        AS track_id,
         t.title                                                     AS title,
         t.artist                                                    AS artist,
         t.album                                                     AS album,
         t.thumbnail                                                 AS thumbnail,
         COUNT(*)                                                    AS play_count,
         COALESCE(SUM(ph.seconds_played), 0)                         AS total_seconds
       FROM play_history ph
       JOIN tracks t ON t.id = ph.track_id
       GROUP BY ph.track_id
       ORDER BY total_seconds DESC
       LIMIT ?`,
    )
    .all(limit);
}

/** Listening time per day for the last N days. Returns { date: 'YYYY-MM-DD', seconds: N } */
export function getListeningByDay(days: number = 30) {
  return getDb()
    .prepare(
      `SELECT
         DATE(played_at) AS date,
         COALESCE(SUM(seconds_played), 0) AS seconds,
         COUNT(*) AS plays
       FROM play_history
       WHERE played_at >= DATE('now', ?)
       GROUP BY DATE(played_at)
       ORDER BY date ASC`,
    )
    .all(`-${days} days`);
}

/** Listening time per hour-of-day (24 rows, 0..23). */
export function getListeningByHour() {
  return getDb()
    .prepare(
      `SELECT
         CAST(strftime('%H', played_at) AS INTEGER) AS hour,
         COALESCE(SUM(seconds_played), 0) AS seconds,
         COUNT(*) AS plays
       FROM play_history
       GROUP BY hour
       ORDER BY hour ASC`,
    )
    .all();
}

/** Current listening streak in consecutive days. */
export function getListeningStreak() {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT DATE(played_at) AS d
       FROM play_history
       ORDER BY d DESC`,
    )
    .all() as { d: string }[];

  if (rows.length === 0) return { current: 0, longest: 0 };

  // Longest streak: walk through and count consecutive days
  let longest = 1;
  let current = 0;

  // Convert dates to Date objects
  const dates = rows.map((r) => {
    // DATE() returns 'YYYY-MM-DD' in UTC
    const [y, m, d] = r.d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  });

  for (let i = 0; i < dates.length; i++) {
    if (i === 0) {
      current = 1;
    } else {
      const diff = (dates[i - 1].getTime() - dates[i].getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        current += 1;
      } else if (diff > 1) {
        if (current > longest) longest = current;
        current = 1;
      }
      // diff < 1 means duplicate date (shouldn't happen with DISTINCT)
    }
  }
  if (current > longest) longest = current;

  // "Current" streak: count back from today (or yesterday if no play today)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  let activeStreak = 0;
  let cursor = new Date(today);
  // If no play today, start counting from yesterday (still counts as active streak)
  if (dates[0].getTime() !== today.getTime() && dates[0].getTime() === yesterday.getTime()) {
    cursor = yesterday;
  } else if (dates[0].getTime() !== today.getTime()) {
    // No play today or yesterday — streak is broken
    return { current: 0, longest };
  }

  for (const d of dates) {
    if (d.getTime() === cursor.getTime()) {
      activeStreak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (d.getTime() < cursor.getTime()) {
      break;
    }
  }

  return { current: activeStreak, longest };
}
