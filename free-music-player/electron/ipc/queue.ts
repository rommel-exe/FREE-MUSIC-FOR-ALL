import { ipcMain } from 'electron';
import * as db from '../utils/database';

export function registerQueueHandlers(): void {
  ipcMain.handle('queue:getQueue', () => {
    try { return db.getQueue(); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:addToQueue', (_event, trackId: string) => {
    try { return db.addToQueue(trackId); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:playNext', (_event, trackId: string) => {
    try {
      const queue = db.getQueue();
      const pos = queue.length > 0 ? 1 : 0;
      return db.addToQueue(trackId, pos);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:removeFromQueue', (_event, id: number) => {
    try { return db.removeFromQueue(id); } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:reorderQueue', (_event, from: number, to: number) => {
    try {
      const queue = db.getQueue();
      const ids = queue.map(q => String(q.id));
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      db.reorderQueue(ids);
    } catch (err: any) { throw new Error(err.message); }
  });

  ipcMain.handle('queue:clearQueue', () => {
    try { db.clearQueue(); return true; } catch (err: any) { throw new Error(err.message); }
  });
}
