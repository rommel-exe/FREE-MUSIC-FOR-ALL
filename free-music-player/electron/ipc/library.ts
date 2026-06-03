import { ipcMain } from 'electron';
import * as db from '../utils/database';
import type { Track } from '../utils/types';

function generateId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
}

export function registerLibraryHandlers(): void {
  ipcMain.handle('library:getTracks', () => {
    try { return db.getAllTracks(); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:addTrack', (_event, track: any) => {
    try {
      const id = track.id || generateId();
      return db.addTrack({ id, title: track.title || '', artist: track.artist || '', album: track.album || '', duration: track.duration || 0, path: track.path || '', thumbnail: track.thumbnail || '', youtube_id: track.youtubeId || track.youtube_id || '', source: track.source || 'local' });
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:removeTrack', (_event, id: string) => {
    try { return db.removeTrack(id); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:searchTracks', (_event, query: string) => {
    try { return db.searchTracks(query); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('library:toggleFavorite', (_event, id: string) => {
    try {
      const exists = db.isFavorite(id);
      if (exists) { db.removeFavorite(id); return false; }
      db.addFavorite(id); return true;
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

  ipcMain.handle('library:incrementPlayCount', (_event, id: string) => {
    try { db.updateTrack(id, {}); } catch {}
  });
}
