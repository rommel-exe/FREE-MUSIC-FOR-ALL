import { ipcMain } from 'electron';
import * as db from '../utils/database';
import type { Track } from '../utils/types';
import { validate, IdSchema, TrackSchema } from '../utils/validate';
import { resolveBatchYoutubeIds } from '../utils/searchMatching';

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
   * Pre-match ALL library tracks through the unified YouTube matching engine.
   *
   * Replaces the old resolveMissingYoutubeIds + rematchAllTracks with a
   * SINGLE pass that runs every track through searchMatching.resolveBatchYoutubeIds().
   * Updates DB records and clears stale caches for changed YouTube IDs.
   *
   * Called automatically on library load (fire-and-forget, background).
   */
  ipcMain.handle('library:prematchAll', async () => {
    const allTracks = db.getAllTracks();
    const matchable = allTracks.filter(t => t.artist && t.title && t.duration > 0);
    if (matchable.length === 0) return { matched: 0, total: 0, unchanged: 0, failed: 0 };

    const tracks = matchable.map(t => ({
      id: t.id,
      oldYoutubeId: t.youtube_id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      thumbnail: t.thumbnail,
      // No youtubeId — force resolveBatchYoutubeIds to search EVERY track
      youtubeId: undefined as string | undefined,
    }));

    console.log(`[Library] Pre-matching ${tracks.length} tracks through unified engine...`);

    const resolved = await resolveBatchYoutubeIds(tracks as any);
    let matched = 0;
    let unchanged = 0;
    let failed = 0;

    for (const track of resolved) {
      const trackId = (track as any).id as string | undefined;
      const oldYoutubeId = (track as any).oldYoutubeId as string | undefined;
      const newYoutubeId = track.youtubeId;

      if (!newYoutubeId || !trackId) {
        failed++;
        continue;
      }

      if (!oldYoutubeId || oldYoutubeId !== newYoutubeId) {
        // New or changed YouTube ID — update DB and clear stale caches
        if (oldYoutubeId) {
          db.removeVerifiedTrack(oldYoutubeId);
          db.removeStreamCache(oldYoutubeId);
          db.removeAlignedLyrics(oldYoutubeId);
        }
        db.updateTrack(trackId, { youtube_id: newYoutubeId, source: 'youtube' });
        matched++;
      } else {
        unchanged++;
      }
    }

    console.log(`[Library] Pre-match: ${matched} new/changed, ${unchanged} unchanged, ${failed} failed`);
    return { matched, total: matchable.length, unchanged, failed };
  });
}
