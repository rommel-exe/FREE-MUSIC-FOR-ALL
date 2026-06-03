import { ipcMain } from 'electron';
import {
  recordPlayStart,
  recordPlayEnd,
  getRecentPlays,
  getAnalyticsOverview,
  getTopArtists,
  getTopAlbums,
  getTopTracks,
  getListeningByDay,
  getListeningByHour,
  getListeningStreak,
  getTrackById,
  getTrackByYouTubeId,
} from '../utils/database';

export function registerAnalyticsHandlers(): void {
  /** Start a new play session. Returns the historyId to use for recordPlayEnd. */
  ipcMain.handle('analytics:startPlay', (_event, trackId: string, trackDuration: number) => {
    return recordPlayStart(trackId, trackDuration || 0);
  });

  /** End a play session. Pass secondsPlayed and whether the song completed. */
  ipcMain.handle('analytics:endPlay', (_event, historyId: number, secondsPlayed: number, completed: boolean) => {
    recordPlayEnd(historyId, secondsPlayed, completed);
    return true;
  });

  /** Convenience: record a play + immediately end it with given stats. */
  ipcMain.handle('analytics:recordPlay', (_event, trackId: string, secondsPlayed: number, trackDuration: number, completed: boolean) => {
    const id = recordPlayStart(trackId, trackDuration);
    recordPlayEnd(id, secondsPlayed, completed);
    return id;
  });

  /** Lookup the track that the renderer is about to play, so analytics can be
   *  recorded even when the renderer only has a YouTube ID. */
  ipcMain.handle('analytics:resolveTrackForPlay', (_event, videoId: string) => {
    return getTrackByYouTubeId(videoId) || getTrackById(videoId) || null;
  });

  /** Overview cards: totals + unique counts. */
  ipcMain.handle('analytics:getOverview', () => getAnalyticsOverview());

  /** Top N artists. */
  ipcMain.handle('analytics:getTopArtists', (_event, limit: number) => getTopArtists(limit || 10));

  /** Top N albums. */
  ipcMain.handle('analytics:getTopAlbums', (_event, limit: number) => getTopAlbums(limit || 10));

  /** Top N tracks. */
  ipcMain.handle('analytics:getTopTracks', (_event, limit: number) => getTopTracks(limit || 10));

  /** Listening per day for the last N days. */
  ipcMain.handle('analytics:getListeningByDay', (_event, days: number) => getListeningByDay(days || 30));

  /** Listening per hour-of-day. */
  ipcMain.handle('analytics:getListeningByHour', () => getListeningByHour());

  /** Streaks. */
  ipcMain.handle('analytics:getStreak', () => getListeningStreak());

  /** Recent plays. */
  ipcMain.handle('analytics:getRecentPlays', (_event, limit: number) => getRecentPlays(limit || 50));
}
