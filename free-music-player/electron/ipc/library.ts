import { ipcMain } from 'electron';
import * as db from '../utils/database';
import type { Track } from '../utils/types';
import { validate, IdSchema, TrackSchema } from '../utils/validate';
import { resolveBatchYoutubeIds } from '../utils/searchMatching';
import { trackIdentityEngine } from '../identity/trackIdentityEngine';

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
   * Pre-match ALL library tracks through the TrackIdentityEngine.
   *
   * Uses the dedicated identity engine with persistence, caching, and
   * multi-factor scoring. Updates DB records and clears stale caches
   * for changed YouTube IDs.
   *
   * Called automatically on library load (fire-and-forget, background).
   */
  ipcMain.handle('library:prematchAll', async () => {
    const allTracks = db.getAllTracks();
    // Include tracks with duration=0 (e.g. Spotify imports without duration data)
    // — the identity engine handles unknown duration via DurationClass.UNKNOWN.
    const matchable = allTracks.filter(t => t.artist && t.title);
    if (matchable.length === 0) return { matched: 0, total: 0, unchanged: 0, failed: 0 };

    const tracks = matchable.map(t => ({
      id: t.id,
      oldYoutubeId: t.youtube_id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      thumbnail: t.thumbnail,
    }));

    console.log(`[Library] Pre-matching ${tracks.length} tracks through TrackIdentityEngine...`);

    const results = await trackIdentityEngine.batchIdentify(
      tracks.map(t => ({ title: t.title, artist: t.artist, duration: t.duration })),
      (completed, total) => {
        console.log(`[Library] Pre-matching ${completed}/${total}...`);
      },
    );

    let matched = 0;
    let unchanged = 0;
    let failed = 0;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const result = results[i];
      const newYoutubeId = result?.videoId;

      if (!newYoutubeId || (result?.confidence ?? 0) < 50) {
        failed++;
        continue;
      }

      if (!track.oldYoutubeId || track.oldYoutubeId !== newYoutubeId) {
        // New or changed YouTube ID — update DB and clear stale caches
        if (track.oldYoutubeId) {
          db.removeVerifiedTrack(track.oldYoutubeId);
          db.removeStreamCache(track.oldYoutubeId);
          db.removeAlignedLyrics(track.oldYoutubeId);
        }
        db.updateTrack(track.id, { youtube_id: newYoutubeId, source: 'youtube' });
        matched++;
      } else {
        unchanged++;
      }
    }

    console.log(`[Library] Pre-match: ${matched} new/changed, ${unchanged} unchanged, ${failed} failed`);
    return { matched, total: matchable.length, unchanged, failed };
  });
}
