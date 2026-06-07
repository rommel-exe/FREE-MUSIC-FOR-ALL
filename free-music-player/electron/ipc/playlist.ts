import { ipcMain } from 'electron';
import * as db from '../utils/database';
import { validate, IdSchema, PlaylistCreateSchema, PlaylistUpdateSchema, ReorderSchema } from '../utils/validate';

function generateId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
}

export function registerPlaylistHandlers(): void {
  ipcMain.handle('playlist:getPlaylists', () => {
    try { return db.getAllPlaylists(); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:createPlaylist', (_event, name: unknown, description?: string) => {
    try {
      const data = validate(PlaylistCreateSchema, { name, description }, 'playlist creation');
      const id = generateId();
      return db.createPlaylist({ id, name: data.name, description: data.description || '', thumbnail: '', source: '', source_url: '' });
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:deletePlaylist', (_event, id: unknown) => {
    try {
      const validatedId = validate(IdSchema, id, 'playlist ID');
      return db.deletePlaylist(validatedId);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:updatePlaylist', (_event, id: unknown, data: any) => {
    try {
      const validatedId = validate(IdSchema, id, 'playlist ID');
      const validatedData = validate(PlaylistUpdateSchema, data ?? {}, 'playlist update');
      return db.updatePlaylist(validatedId, validatedData);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:addTrackToPlaylist', (_event, playlistId: unknown, trackId: unknown) => {
    try {
      const validatedPlaylistId = validate(IdSchema, playlistId, 'playlist ID');
      const validatedTrackId = validate(IdSchema, trackId, 'track ID');
      return db.addTrackToPlaylist(validatedPlaylistId, validatedTrackId);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:removeTrackFromPlaylist', (_event, playlistId: unknown, trackId: unknown) => {
    try {
      const validatedPlaylistId = validate(IdSchema, playlistId, 'playlist ID');
      const validatedTrackId = validate(IdSchema, trackId, 'track ID');
      return db.removeTrackFromPlaylist(validatedPlaylistId, validatedTrackId);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:getPlaylistTracks', (_event, playlistId: unknown) => {
    try {
      const validatedId = validate(IdSchema, playlistId, 'playlist ID');
      const pts = db.getPlaylistTracks(validatedId);
      return pts.map(pt => db.getTrackById(pt.track_id)).filter(Boolean);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('playlist:reorderPlaylistTracks', (_event, playlistId: unknown, from: unknown, to: unknown) => {
    try {
      const validatedId = validate(IdSchema, playlistId, 'playlist ID');
      const { from: validatedFrom, to: validatedTo } = validate(ReorderSchema, { from, to }, 'reorder');
      const pts = db.getPlaylistTracks(validatedId);
      const ids = pts.map(p => p.track_id);
      const [moved] = ids.splice(validatedFrom, 1);
      ids.splice(validatedTo, 0, moved);
      db.reorderPlaylistTracks(validatedId, ids);
    } catch (err: any) { throw new Error(err.message); }
  });
}
