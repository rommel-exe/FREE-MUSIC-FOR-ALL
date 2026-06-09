import { ipcMain } from 'electron';
import { mediaResolver } from '../services/mediaResolver';

/**
 * IPC handlers for stream resolution.
 *
 * Now accepts optional track metadata so MediaResolver can do auto-recovery
 * when the primary video ID resolves to a private/deleted/unavailable video.
 */
export function registerStreamHandlers(): void {
  ipcMain.handle('stream:resolve', async (_event, videoId: string, metadata?: { artist: string; title: string; expectedDuration?: number; trackId?: string }) => {
    try {
      const source = await mediaResolver.resolve(videoId, metadata);
      if (!source) return { error: 'Failed to resolve media' };
      return {
        url: source.audioUrl,
        expiresAt: source.expiresAt,
        bitrate: source.bitrate,
        videoId: source.videoId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: message };
    }
  });

  // Batch prefetch - resolves multiple videoIds in parallel on main process
  ipcMain.handle('stream:prefetchBatch', async (_event, videoIds: string[]) => {
    const results = await Promise.allSettled(
      videoIds.map((videoId) => mediaResolver.resolve(videoId))
    );
    return results.map((r, i) => ({
      videoId: videoIds[i],
      ok: r.status === 'fulfilled' && r.value !== null,
    }));
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
      videoId: source.videoId,
    };
  });
}
