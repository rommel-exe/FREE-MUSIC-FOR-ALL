/**
 * IPC handlers for song download management.
 */
import { ipcMain } from 'electron';
import { downloadService } from '../services/downloadService';
import {
  getAllDownloads,
  getDownloadsForTrack,
  hasCompletedDownload,
  deleteDownloadsForTrack,
} from '../utils/database';

export function registerDownloadHandlers(): void {
  /**
   * Download a track for offline playback.
   * Receives track metadata, downloads audio via yt-dlp, saves to disk.
   * Streams progress events to the renderer via 'download:progress'.
   */
  ipcMain.handle(
    'download:track',
    async (
      event,
      track: {
        id: string;
        youtubeId: string;
        title: string;
        artist: string;
        album?: string;
        duration: number;
        thumbnail?: string;
      },
    ) => {
      try {
        const filePath = await downloadService.downloadTrack(track, (progress, downloadId) => {
          event.sender.send('download:progress', {
            trackId: track.id,
            downloadId,
            progress,
          });
        });
        return { ok: true, filePath };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { ok: false, error: message };
      }
    },
  );

  /**
   * Cancel an active download by its database ID.
   */
  ipcMain.handle('download:cancel', async (_event, downloadId: number) => {
    const ok = downloadService.cancelDownload(downloadId);
    return { ok };
  });

  /**
   * Cancel an active download by track ID.
   */
  ipcMain.handle('download:cancelByTrackId', async (_event, trackId: string) => {
    const ok = downloadService.cancelDownloadByTrackId(trackId);
    return { ok };
  });

  /**
   * Delete a downloaded track's file and records.
   */
  ipcMain.handle('download:delete', async (_event, trackId: string) => {
    try {
      downloadService.deleteDownloadedTrack(trackId);
      deleteDownloadsForTrack(trackId);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, error: message };
    }
  });

  /**
   * Check if a track has a completed download.
   */
  ipcMain.handle('download:hasDownload', async (_event, trackId: string) => {
    return { downloaded: hasCompletedDownload(trackId) };
  });

  /**
   * Get the local file path for a downloaded track.
   */
  ipcMain.handle('download:getPath', async (_event, trackId: string) => {
    const filePath = downloadService.getLocalPath(trackId);
    return { filePath };
  });

  /**
   * Get all download records.
   */
  ipcMain.handle('download:getAll', async () => {
    return { downloads: getAllDownloads() };
  });

  /**
   * Get downloads for a specific track.
   */
  ipcMain.handle('download:getForTrack', async (_event, trackId: string) => {
    return { downloads: getDownloadsForTrack(trackId) };
  });

  /**
   * Check if the download service is available and ready.
   */
  ipcMain.handle('download:status', async () => {
    return { available: true };
  });
}
