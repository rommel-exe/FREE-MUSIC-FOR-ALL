import { ipcMain } from 'electron';
import { mediaResolver } from '../services/mediaResolver';

/**
 * Thin IPC pass-through — no business logic, just delegates to MediaResolver.
 */
export function registerStreamHandlers(): void {
  ipcMain.handle('stream:resolve', async (_event, videoId: string) => {
    try {
      const source = await mediaResolver.resolve(videoId);
      return {
        url: source.audioUrl,
        expiresAt: source.expiresAt,
        bitrate: source.bitrate,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: message };
    }
  });

  ipcMain.handle('stream:prefetch', async (_event, videoId: string) => {
    mediaResolver.prefetch(videoId);
    return { ok: true };
  });

  ipcMain.handle('stream:hasCached', async (_event, videoId: string) => {
    return { cached: mediaResolver.hasCached(videoId) };
  });

  ipcMain.handle('stream:getCached', async (_event, videoId: string) => {
    const source = mediaResolver.getCached(videoId);
    if (!source) return { error: 'Not cached' };
    return {
      url: source.audioUrl,
      expiresAt: source.expiresAt,
      bitrate: source.bitrate,
    };
  });
}
