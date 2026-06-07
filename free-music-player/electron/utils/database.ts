import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import type { Track, Playlist, PlaylistTrack, QueueItem, Settings, RecentlyPlayed, Favorite } from './types';

let db: Database.Database | null = null;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mapTrack(row: any): any {
  if (!row) return row;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    path: row.path,
    thumbnail: row.thumbnail,
    youtubeId: row.youtube_id ?? row.youtubeId ?? '',
    source: row.source,
    isFavorite: row.isFavorite ?? false,
    playCount: row.play_count ?? row.playCount ?? 0,
    createdAt: row.created_at ?? row.createdAt ?? '',
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  };
}

function mapTracks(rows: any[]): any[] {
  return rows.map(mapTrack);
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbDir = path.join(app.getPath('userData'), 'data');
  ensureDir(dbDir);

  db = new Database(path.join(dbDir, 'player.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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
      play_count  INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS session (
      id    INTEGER PRIMARY KEY CHECK (id = 1),
      data  TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_queue_position      ON queue(position);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pos ON playlist_tracks(playlist_id, position);
    CREATE INDEX IF NOT EXISTS idx_recently_played     ON recently_played(played_at);

    CREATE TABLE IF NOT EXISTS verified_tracks (
      video_id      TEXT PRIMARY KEY,
      verified      INTEGER NOT NULL DEFAULT 0,
      playable      INTEGER NOT NULL DEFAULT 0,
      trust_score   INTEGER NOT NULL DEFAULT 0,
      channel       TEXT NOT NULL DEFAULT '',
      availability  TEXT NOT NULL DEFAULT 'unknown',
      live_status   TEXT NOT NULL DEFAULT 'unknown',
      duration      INTEGER NOT NULL DEFAULT 0,
      has_audio     INTEGER NOT NULL DEFAULT 0,
      last_checked  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_verified_playable ON verified_tracks(playable);
  `);

  // ── Migration: add play_count column if missing (added after v1.0) ────
  const cols = db.prepare("PRAGMA table_info('tracks')").all() as { name: string }[];
  if (!cols.some((c) => c.name === 'play_count')) {
    db.exec("ALTER TABLE tracks ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0");
  }

  const defaults: Record<string, string> = { volume: '0.8', theme: 'dark' };
  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) upsert.run(k, v);

  return db;
}

export function getDb(): Database.Database {
  if (!db) return initDatabase();
  return db;
}

// ─── Tracks ─────────────────────────────────────────────────────────────

export function getAllTracks(): Track[] {
  return mapTracks(getDb().prepare('SELECT * FROM tracks ORDER BY created_at DESC').all());
}

export function getTrackById(id: string): Track | undefined {
  return mapTrack(getDb().prepare('SELECT * FROM tracks WHERE id = ?').get(id));
}

export function addTrack(track: Omit<Track, 'created_at' | 'updated_at'>): Track {
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO tracks (id, title, artist, album, duration, path, thumbnail, youtube_id, source, play_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(track.id, track.title, track.artist, track.album, track.duration, track.path, track.thumbnail, track.youtube_id, track.source, track.play_count ?? 0, now, now);
  return getTrackById(track.id)!;
}

export function updateTrack(id: string, updates: Partial<Omit<Track, 'id' | 'created_at'>>): Track | undefined {
  const existing = getTrackById(id);
  if (!existing) return undefined;
  const fields = Object.keys(updates).filter((k) => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return existing;
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(new Date().toISOString(), id);
  getDb().prepare(`UPDATE tracks SET ${sets}, updated_at = ? WHERE id = ?`).run(...values);
  return getTrackById(id);
}

export function removeTrack(id: string): boolean {
  return getDb().prepare('DELETE FROM tracks WHERE id = ?').run(id).changes > 0;
}

export function searchTracks(query: string): Track[] {
  const p = `%${query}%`;
  return mapTracks(getDb().prepare(
    'SELECT * FROM tracks WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? ORDER BY created_at DESC'
  ).all(p, p, p));
}

// ─── Playlists ──────────────────────────────────────────────────────────

export function getAllPlaylists(): (Playlist & { trackCount: number })[] {
  return getDb().prepare(
    `SELECT p.*, COALESCE(c.cnt, 0) AS trackCount
     FROM playlists p
     LEFT JOIN (
       SELECT playlist_id, COUNT(*) AS cnt
       FROM playlist_tracks
       GROUP BY playlist_id
     ) c ON c.playlist_id = p.id
     ORDER BY p.created_at DESC`,
  ).all() as (Playlist & { trackCount: number })[];
}

export function getPlaylistById(id: string): Playlist | undefined {
  return getDb().prepare('SELECT * FROM playlists WHERE id = ?').get(id) as Playlist | undefined;
}

export function createPlaylist(playlist: Omit<Playlist, 'created_at' | 'updated_at'>): Playlist {
  const now = new Date().toISOString();
  getDb().prepare(
    `INSERT INTO playlists (id, name, description, thumbnail, source, source_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(playlist.id, playlist.name, playlist.description, playlist.thumbnail, playlist.source, playlist.source_url, now, now);
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
  getDb().prepare(`UPDATE playlists SET ${sets}, updated_at = ? WHERE id = ?`).run(...values);
  return getPlaylistById(id);
}

export function deletePlaylist(id: string): boolean {
  return getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id).changes > 0;
}

// ─── Playlist Tracks ────────────────────────────────────────────────────

export function getPlaylistTracks(playlistId: string): PlaylistTrack[] {
  return getDb().prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC').all(playlistId) as PlaylistTrack[];
}

export function addTrackToPlaylist(playlistId: string, trackId: string, position?: number): PlaylistTrack {
  const maxPos = getDb().prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as { maxPos: number };
  const pos = position ?? maxPos.maxPos + 1;
  getDb().prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)').run(playlistId, trackId, pos, new Date().toISOString());
  return getDb().prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').get(playlistId, trackId) as PlaylistTrack;
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
  const result = getDb().prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId);
  if (result.changes > 0) {
    const remaining = getPlaylistTracks(playlistId);
    const update = getDb().prepare('UPDATE playlist_tracks SET position = ? WHERE id = ?');
    remaining.forEach((pt, i) => update.run(i, pt.id));
    return true;
  }
  return false;
}

export function reorderPlaylistTracks(playlistId: string, trackIds: string[]): void {
  const update = getDb().prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?');
  getDb().transaction((ids: string[]) => ids.forEach((tid, i) => update.run(i, playlistId, tid)))(trackIds);
}

// ─── Queue ──────────────────────────────────────────────────────────────

export function getQueue(): QueueItem[] {
  return getDb().prepare('SELECT * FROM queue ORDER BY position ASC').all() as QueueItem[];
}

export function addToQueue(trackId: string, position?: number): QueueItem {
  const maxPos = getDb().prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM queue').get() as { maxPos: number };
  const pos = position ?? maxPos.maxPos + 1;
  getDb().prepare('INSERT INTO queue (track_id, position, added_at) VALUES (?, ?, ?)').run(trackId, pos, new Date().toISOString());
  return getDb().prepare('SELECT * FROM queue WHERE track_id = ? AND position = ?').get(trackId, pos) as QueueItem;
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
  getDb().transaction((ids: string[]) => ids.forEach((id, i) => update.run(i, id)))(trackIds);
}

// ─── Settings ───────────────────────────────────────────────────────────

export function getSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function getSetting(key: string): string | undefined {
  return (getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
}

export function updateSettings(partial: Record<string, string | number | boolean>): void {
  const upsert = db!.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  getDb().transaction((entries: [string, string][]) => entries.forEach(([k, v]) => upsert.run(k, String(v))))(Object.entries(partial) as [string, string][]);
}

// ─── Recently Played ────────────────────────────────────────────────────

export function addRecentlyPlayed(trackId: string): void {
  getDb().prepare('INSERT INTO recently_played (track_id, played_at) VALUES (?, ?)').run(trackId, new Date().toISOString());
  getDb().prepare('DELETE FROM recently_played WHERE id NOT IN (SELECT id FROM recently_played ORDER BY played_at DESC LIMIT 100)').run();
}

export function getRecentlyPlayed(limit = 50): RecentlyPlayed[] {
  return getDb().prepare('SELECT * FROM recently_played ORDER BY played_at DESC LIMIT ?').all(limit) as RecentlyPlayed[];
}

// ─── Play Count ────────────────────────────────────────────────────────

export function incrementPlayCount(id: string): void {
  getDb().prepare("UPDATE tracks SET play_count = play_count + 1, updated_at = datetime('now') WHERE id = ?").run(id);
}

// ─── Favorites ──────────────────────────────────────────────────────────

export function addFavorite(trackId: string): void {
  getDb().prepare('INSERT OR IGNORE INTO favorites (track_id, added_at) VALUES (?, ?)').run(trackId, new Date().toISOString());
}

export function removeFavorite(trackId: string): boolean {
  return getDb().prepare('DELETE FROM favorites WHERE track_id = ?').run(trackId).changes > 0;
}

export function isFavorite(trackId: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM favorites WHERE track_id = ?').get(trackId);
}

export function getFavorites(): Favorite[] {
  return getDb().prepare('SELECT * FROM favorites ORDER BY added_at DESC').all() as Favorite[];
}

// ─── Session ────────────────────────────────────────────────────────────

export function getSession(): Record<string, unknown> | null {
  const row = getDb().prepare('SELECT data FROM session WHERE id = 1').get() as { data: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export function saveSession(data: Record<string, unknown>): void {
  const json = JSON.stringify(data);
  getDb().prepare('INSERT OR REPLACE INTO session (id, data) VALUES (1, ?)').run(json);
}

// ─── Verified Tracks (verification cache) ────────────────────────────────

export interface VerifiedTrack {
  videoId: string;
  verified: boolean;
  playable: boolean;
  trustScore: number;
  channel: string;
  availability: string;
  liveStatus: string;
  duration: number;
  hasAudio: boolean;
  lastChecked: string;
}

export function getVerifiedTrack(videoId: string): VerifiedTrack | null {
  const row = getDb().prepare('SELECT * FROM verified_tracks WHERE video_id = ?').get(videoId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    videoId: row.video_id as string,
    verified: (row.verified as number) === 1,
    playable: (row.playable as number) === 1,
    trustScore: row.trust_score as number,
    channel: row.channel as string,
    availability: row.availability as string,
    liveStatus: row.live_status as string,
    duration: row.duration as number,
    hasAudio: (row.has_audio as number) === 1,
    lastChecked: row.last_checked as string,
  };
}

export function getVerifiedTracksBatch(videoIds: string[]): Map<string, VerifiedTrack> {
  if (videoIds.length === 0) return new Map();
  const placeholders = videoIds.map(() => '?').join(',');
  const rows = getDb().prepare(`SELECT * FROM verified_tracks WHERE video_id IN (${placeholders})`).all(...videoIds) as Record<string, unknown>[];
  const map = new Map<string, VerifiedTrack>();
  for (const row of rows) {
    map.set(row.video_id as string, {
      videoId: row.video_id as string,
      verified: (row.verified as number) === 1,
      playable: (row.playable as number) === 1,
      trustScore: row.trust_score as number,
      channel: row.channel as string,
      availability: row.availability as string,
      liveStatus: row.live_status as string,
      duration: row.duration as number,
      hasAudio: (row.has_audio as number) === 1,
      lastChecked: row.last_checked as string,
    });
  }
  return map;
}

export function setVerifiedTrack(data: VerifiedTrack): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO verified_tracks (video_id, verified, playable, trust_score, channel, availability, live_status, duration, has_audio, last_checked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.videoId,
    data.verified ? 1 : 0,
    data.playable ? 1 : 0,
    data.trustScore,
    data.channel,
    data.availability,
    data.liveStatus,
    data.duration,
    data.hasAudio ? 1 : 0,
    data.lastChecked,
  );
}

export function clearExpiredVerifiedTracks(maxAgeDays = 7): void {
  getDb().prepare(`DELETE FROM verified_tracks WHERE last_checked < datetime('now', '-' || ? || ' days')`).run(maxAgeDays);
}
