/**
 * IPC handlers for the Whisper-based lyric alignment engine.
 *
 * @module electron/ipc/alignment
 */

import { ipcMain, BrowserWindow } from 'electron';
import { alignmentEngine } from '../services/alignmentEngine';
import { getAlignedLyrics, removeAlignedLyrics } from '../utils/database';

export function registerAlignmentHandlers(): void {
  // ── Run alignment for a track ─────────────────────────────────
  ipcMain.handle(
    'alignment:align',
    async (
      _event,
      videoId: string,
      audioUrl: string,
      plainLyrics: string[],
    ) => {
      if (!videoId || !audioUrl || !plainLyrics?.length) {
        return { lrc: '', confidence: 0, error: 'Missing required parameters' };
      }

      try {
        const result = await alignmentEngine.align(videoId, audioUrl, plainLyrics);
        return {
          lrc: result.lrc,
          confidence: result.confidence,
          fromCache: result.fromCache,
          error: result.lrc ? undefined : 'Alignment produced no output',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Alignment IPC] align error:', message);
        return { lrc: '', confidence: 0, error: message };
      }
    },
  );

  // ── Check if cached aligned lyrics exist ──────────────────────
  ipcMain.handle('alignment:getCached', async (_event, videoId: string) => {
    try {
      const cached = getAlignedLyrics(videoId);
      if (cached) {
        return {
          lrc: cached.lrc,
          confidence: cached.confidence,
          cached: true,
        };
      }
      return { lrc: '', confidence: 0, cached: false };
    } catch (err) {
      return { lrc: '', confidence: 0, cached: false, error: String(err) };
    }
  });

  // ── Delete cached aligned lyrics ──────────────────────────────
  ipcMain.handle('alignment:removeCached', async (_event, videoId: string) => {
    try {
      removeAlignedLyrics(videoId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // ── Get engine status (model, binary availability) ────────────
  ipcMain.handle('alignment:status', async () => {
    return alignmentEngine.getStatus();
  });

  // ── Download model (triggered manually or on first alignment) ─
  ipcMain.handle('alignment:downloadModel', async (event) => {
    // Start download and send progress to the renderer
    const win = BrowserWindow.fromWebContents(event.sender);
    const unsub = alignmentEngine.onDownloadProgress((pct: number) => {
      win?.webContents.send('alignment:downloadProgress', pct);
    });

    try {
      const ok = await alignmentEngine.downloadModel();
      return { ok };
    } finally {
      unsub();
    }
  });
}
