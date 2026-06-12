import { ipcMain } from 'electron';
import * as db from '../utils/database';
import type { Track } from '../utils/types';
import { validate, IdSchema, TrackSchema } from '../utils/validate';
import { resolveYoutubeIds } from '../services/playlistImport';

function generateId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
}

export function registerLibraryHandlers(): void {
  ipcMain.handle('library:getTracks', () => {
    try { return db.getAllTracks(); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:addTrack', (_event, track: any) => {
    try {
      const data = validate(TrackSchema, track ?? {}, 'track');
      // Use youtubeId as the track ID when adding from YouTube search so
      // that recently-played tracking (which uses track.id) works consistently.
      const id = data.id || data.youtubeId || data.youtube_id || generateId();
      return db.addTrack({
        id,
        title: data.title,
        artist: data.artist,
        album: data.album,
        duration: data.duration,
        path: data.path || '',
        thumbnail: data.thumbnail,
        youtube_id: data.youtubeId || data.youtube_id || '',
        source: data.source || 'local',
        play_count: data.playCount ?? data.play_count ?? 0,
      });
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:removeTrack', (_event, id: unknown) => {
    try {
      const validatedId = validate(IdSchema, id, 'track ID');
      return db.removeTrack(validatedId);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:searchTracks', (_event, query: unknown) => {
    try {
      const validatedQuery = String(query ?? '');
      return db.searchTracks(validatedQuery);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:toggleFavorite', (_event, id: unknown) => {
    try {
      const validatedId = validate(IdSchema, id, 'track ID');
      const exists = db.isFavorite(validatedId);
      if (exists) { db.removeFavorite(validatedId); return false; }
      db.addFavorite(validatedId); return true;
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:getFavorites', () => {
    try {
      const favs = db.getFavorites();
      return favs.map(f => db.getTrackById(f.track_id)).filter(Boolean);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:getRecentlyPlayed', () => {
    try {
      const recent = db.getRecentlyPlayed();
      return recent.map(r => db.getTrackById(r.track_id)).filter(Boolean);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:incrementPlayCount', (_event, id: unknown) => {
    try {
      const validatedId = validate(IdSchema, id, 'track ID');
      db.incrementPlayCount(validatedId);
    } catch (err) { console.error('[library] incrementPlayCount failed:', err); }
  });

  ipcMain.handle('library:addRecentlyPlayed', (_event, id: unknown) => {
    try {
      const validatedId = validate(IdSchema, id, 'track ID');
      db.addRecentlyPlayed(validatedId);
    } catch (err) { console.error('[library] addRecentlyPlayed failed:', err); }
  });

  /**
   * Scan the library for tracks missing youtube_id and resolve them
   * using exact-duration YouTube Music matching. Returns the count
   * of successfully resolved tracks.
   */
  ipcMain.handle('library:resolveMissingYoutubeIds', async () => {
    const unresolved = db.getTracksWithoutYoutubeIds();
    if (unresolved.length === 0) return { resolved: 0, total: 0 };

    // Preserve track ID alongside the resolve payload so we can
    // update the correct database record when a match is found.
    const tracks = unresolved.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      thumbnail: t.thumbnail,
      youtubeId: t.youtube_id || undefined,
    }));

    const resolved = await resolveYoutubeIds(tracks as any);
    let count = 0;
    for (const track of resolved) {
      const trackId = (track as any).id;
      if (track.youtubeId && trackId) {
        db.updateTrack(trackId, { youtube_id: track.youtubeId, source: 'youtube' });
        count++;
      }
    }

    return { resolved: count, total: unresolved.length };
  });
}
