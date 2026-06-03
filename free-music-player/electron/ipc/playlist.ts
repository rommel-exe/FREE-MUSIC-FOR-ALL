import { ipcMain } from 'electron';
import * as db from '../utils/database';

function generateId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
}

export function registerPlaylistHandlers(): void {
  ipcMain.handle('playlist:getPlaylists', () => {
    try { return db.getAllPlaylists(); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:createPlaylist', (_event, name: string, description?: string) => {
    try {
      const id = generateId();
      return db.createPlaylist({ id, name, description: description || '', thumbnail: '', source: '', source_url: '' });
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:deletePlaylist', (_event, id: string) => {
    try { return db.deletePlaylist(id); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:updatePlaylist', (_event, id: string, data: any) => {
    try { return db.updatePlaylist(id, data); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:addTrackToPlaylist', (_event, playlistId: string, trackId: string) => {
    try { return db.addTrackToPlaylist(playlistId, trackId); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:removeTrackFromPlaylist', (_event, playlistId: string, trackId: string) => {
    try { return db.removeTrackFromPlaylist(playlistId, trackId); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:getPlaylistTracks', (_event, playlistId: string) => {
    try {
      const pts = db.getPlaylistTracks(playlistId);
      return pts.map(pt => db.getTrackById(pt.track_id)).filter(Boolean);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:reorderPlaylistTracks', (_event, playlistId: string, from: number, to: number) => {
    try {
      const pts = db.getPlaylistTracks(playlistId);
      const ids = pts.map(p => p.track_id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      db.reorderPlaylistTracks(playlistId, ids);
    } catch (err: any) { throw new Error(err.message); }
  });
}
