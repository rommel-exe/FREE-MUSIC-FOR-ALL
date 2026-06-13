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

  /**
   * Re-match ALL tracks (even ones with existing youtube_id) through the
   * improved duration-first matching engine. Clears stale caches for any
   * track whose YouTube ID changes.
   *
   * One-time migration: runs in background on first launch after v1.3.0.
   */
  ipcMain.handle('library:rematchAllTracks', async () => {
    const allTracks = db.getAllTracks();
    const matchable = allTracks.filter(t => t.artist && t.title && t.duration > 0);
    if (matchable.length === 0) return { rematched: 0, total: 0, unchanged: 0 };

    // Preserve old youtube_id so we can clear stale caches after re-match.
    // Set youtubeId to undefined to force resolveYoutubeIds to re-search.
    const tracks = matchable.map(t => ({
      id: t.id,
      oldYoutubeId: t.youtube_id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      thumbnail: t.thumbnail,
      youtubeId: undefined as string | undefined,
    }));

    console.log(`[Library] Re-matching ${tracks.length} tracks through v1.3 matching engine...`);

    const resolved = await resolveYoutubeIds(tracks as any);
    let rematched = 0;
    let unchanged = 0;

    for (const track of resolved) {
      const trackId = (track as any).id;
      const oldYoutubeId = (track as any).oldYoutubeId as string | undefined;
      const newYoutubeId = track.youtubeId;

      if (!newYoutubeId || !trackId) {
        unchanged++;
        continue;
      }

      if (oldYoutubeId && oldYoutubeId !== newYoutubeId) {
        // ID changed — clear stale caches for the old video
        db.removeVerifiedTrack(oldYoutubeId);
        db.removeStreamCache(oldYoutubeId);
        db.removeAlignedLyrics(oldYoutubeId);
      }

      db.updateTrack(trackId, { youtube_id: newYoutubeId, source: 'youtube' });
      rematched++;
    }

    console.log(`[Library] Re-match complete: ${rematched} updated, ${unchanged} unchanged`);
    return { rematched, total: matchable.length, unchanged };
  });
}
