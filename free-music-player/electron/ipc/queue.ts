import { ipcMain } from 'electron';
import * as db from '../utils/database';
import { z } from 'zod';
import { validate, IdSchema, ReorderSchema } from '../utils/validate';

export function registerQueueHandlers(): void {
  ipcMain.handle('queue:getQueue', () => {
    try { return db.getQueue(); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:addToQueue', (_event, trackId: unknown) => {
    try {
      const validatedId = validate(IdSchema, trackId, 'track ID');
      return db.addToQueue(validatedId);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:playNext', (_event, trackId: unknown) => {
    try {
      const validatedId = validate(IdSchema, trackId, 'track ID');
      const queue = db.getQueue();
      const pos = queue.length > 0 ? 1 : 0;
      return db.addToQueue(validatedId, pos);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:removeFromQueue', (_event, id: unknown) => {
    try {
      const validatedId = validate(z.number().int().min(0), id, 'queue item index');
      return db.removeFromQueue(validatedId);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:reorderQueue', (_event, from: unknown, to: unknown) => {
    try {
      const { from: validatedFrom, to: validatedTo } = validate(ReorderSchema, { from, to }, 'reorder');
      const queue = db.getQueue();
      const ids = queue.map(q => String(q.id));
      const [moved] = ids.splice(validatedFrom, 1);
      ids.splice(validatedTo, 0, moved);
      db.reorderQueue(ids);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:clearQueue', () => {
    try { db.clearQueue(); return true; } catch (err: any) { throw new Error(err.message); }
  });
}
