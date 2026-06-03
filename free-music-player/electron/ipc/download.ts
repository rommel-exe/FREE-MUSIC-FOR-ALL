import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { downloadTrack, getVideoInfo, searchYouTube } from '../services/ytdl';
import { getDownloadsPath, sanitizeFilename } from '../utils/file-utils';
import * as db from '../utils/database';
import type { DownloadItem } from '../utils/types';

/**
 * Resolve a videoId for a track that may not have one.
 * Used as a fallback during downloads for tracks imported before the
 * pre-resolve fix (e.g. legacy imports from the Genre Mix playlist).
 */
async function resolveVideoId(t: any): Promise<string | null> {
  if (t.youtubeId || t.youtube_id) return t.youtubeId || t.youtube_id;
  const q = `${t.title || ''} ${t.artist || ''}`.trim();
  if (!q) return null;
  try {
    const results = await searchYouTube(q, 1);
    return results?.[0]?.id || null;
  } catch {
    return null;
  }
}

const downloads = new Map<string, DownloadItem>();

function generateId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
}

function notifyRenderer(channel: string, ...args: unknown[]) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args);
  });
}

export function registerDownloadHandlers(): void {
  // Preload sends: (videoId, title, artist, thumbnail)
  ipcMain.handle('download:startDownload', async (_event, videoId: string, title: string, artist: string, thumbnail: string) => {
    // ── Skip if already downloaded: check DB by youtubeId, then check filesystem
    // at both the DB-recorded path AND the canonical filename path.
    const existing = db.getTrackByYouTubeId(videoId);
    if (existing?.path && fs.existsSync(existing.path) && fs.statSync(existing.path).size > 1000) {
      console.log(`[Downloads] Skipping ${videoId} — already in library at ${path.basename(existing.path)}`);
      return { success: true, skipped: true, trackId: existing.id, outputPath: existing.path };
    }

    const id = generateId();
    const downloadsPath = getDownloadsPath();

    const item: DownloadItem = {
      id, videoId, title: title || '', artist: artist || '', thumbnail: thumbnail || '',
      progress: 0, status: 'pending', startedAt: new Date().toISOString(),
    };

    downloads.set(id, item);
    notifyRenderer('download:statusChange', item);

    if (!item.title) {
      try {
        const info = await getVideoInfo(videoId);
        item.title = info.title;
        item.artist = info.artist;
        item.thumbnail = info.thumbnail;
      } catch { item.title = videoId; }
    }

    const filename = sanitizeFilename(`${item.artist} - ${item.title}`) + '.mp3';
    const outputPath = path.join(downloadsPath, filename);

    // Belt-and-suspenders: also check the canonical filename path
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      console.log(`[Downloads] Skipping ${videoId} — file already on disk at ${filename}`);
      // Make sure DB has the path
      const trackId = existing?.id || generateId();
      try {
        db.addOrUpdateTrack({
          id: trackId, title: item.title, artist: item.artist, album: '', duration: 0,
          path: outputPath, thumbnail: item.thumbnail, youtube_id: videoId, source: 'youtube',
        });
      } catch {}
      return { success: true, skipped: true, trackId, outputPath };
    }

    item.outputPath = outputPath;
    item.status = 'downloading';
    notifyRenderer('download:statusChange', item);

    try {
      await downloadTrack(videoId, outputPath, (progress) => {
        item.progress = progress;
        notifyRenderer('download:progress', { id, progress });
      });

      const trackId = existing?.id || generateId();
      db.addOrUpdateTrack({
        id: trackId, title: item.title, artist: item.artist, album: '', duration: 0,
        path: outputPath, thumbnail: item.thumbnail, youtube_id: videoId, source: 'youtube',
      });

      item.status = 'completed';
      item.progress = 100;
      notifyRenderer('download:statusChange', item);
      downloads.delete(id);
      return { success: true, trackId, outputPath };
    } catch (err: any) {
      item.status = 'error';
      item.error = err.message;
      notifyRenderer('download:statusChange', item);
      downloads.delete(id);
      throw new Error(`Download failed: ${err.message}`);
    }
  });

  /**
   * Download all tracks in a playlist sequentially.
   * Each track is added to the downloads list with a unique id.
   * Skips tracks that already have a local file (idempotent).
   */
  ipcMain.handle('download:downloadPlaylist', async (_event, tracks: any[]) => {
    const results: { trackId: string; success: boolean; error?: string; skipped?: boolean; title?: string; artist?: string }[] = [];
    const downloadsPath = getDownloadsPath();

    console.log(`[Downloads] Starting batch of ${tracks.length} tracks to ${downloadsPath}`);

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      // Fallback: if track has no videoId, search YouTube for it.
      // This handles legacy tracks imported before the pre-resolve fix.
      let videoId = await resolveVideoId(t);

      if (!videoId) {
        console.warn(`[Downloads] [${i + 1}/${tracks.length}] ✗ ${t.artist} - ${t.title}: no videoId after search`);
        results.push({ trackId: t.id || '', success: false, error: 'No videoId and YouTube search returned nothing', title: t.title, artist: t.artist });
        notifyRenderer('download:batchProgress', { current: i + 1, total: tracks.length, track: t.title });
        continue;
      }

      // ── Skip if already downloaded: two-tier check
      //   1. DB lookup by youtubeId — handles re-imports with different titles
      //   2. Filesystem check at canonical filename — handles legacy files
      //      downloaded before the DB had paths recorded
      const existing = db.getTrackByYouTubeId(videoId);
      if (existing?.path && fs.existsSync(existing.path) && fs.statSync(existing.path).size > 1000) {
        console.log(`[Downloads] [${i + 1}/${tracks.length}] ⊘ ${t.artist} - ${t.title} (already in library, skipping)`);
        results.push({ trackId: existing.id, success: true, skipped: true, title: t.title, artist: t.artist });
        notifyRenderer('download:batchProgress', { current: i + 1, total: tracks.length, track: t.title });
        continue;
      }

      const filename = sanitizeFilename(`${t.artist || ''} - ${t.title || videoId}`) + '.mp3';
      const outputPath = path.join(downloadsPath, filename);
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        console.log(`[Downloads] [${i + 1}/${tracks.length}] ⊘ ${t.artist} - ${t.title} (file already on disk, skipping)`);
        // Backfill the DB with the path so future checks are faster
        const trackId = existing?.id || t.id || generateId();
        try {
          db.addOrUpdateTrack({
            id: trackId, title: t.title || '', artist: t.artist || '', album: t.album || '',
            duration: t.duration || 0, path: outputPath, thumbnail: t.thumbnail || '',
            youtube_id: videoId, source: 'youtube',
          });
        } catch {}
        results.push({ trackId, success: true, skipped: true, title: t.title, artist: t.artist });
        notifyRenderer('download:batchProgress', { current: i + 1, total: tracks.length, track: t.title });
        continue;
      }

      const id = generateId();
      const item: DownloadItem = {
        id, videoId,
        title: t.title || '', artist: t.artist || '', thumbnail: t.thumbnail || '',
        progress: 0, status: 'pending', startedAt: new Date().toISOString(),
        outputPath,
      };
      downloads.set(id, item);
      notifyRenderer('download:statusChange', item);
      notifyRenderer('download:batchProgress', { current: i + 1, total: tracks.length, track: t.title });

      try {
        item.status = 'downloading';
        notifyRenderer('download:statusChange', item);

        await downloadTrack(videoId, outputPath, (progress) => {
          item.progress = progress;
          notifyRenderer('download:progress', { id, progress });
        });

        // Verify the file was actually written
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
          throw new Error('File was not written to disk or is too small');
        }

        // Add to library if not already there, or UPDATE the existing
        // track's `path` field. Tracks are inserted during playlist import
        // with empty `path`; the download flow fills it in.
        let trackId = t.id;
        if (!trackId) {
          // No id provided — try to find an existing track by youtube_id
          const existing = db.getTrackByYouTubeId(videoId);
          if (existing) trackId = existing.id;
          else trackId = generateId();
        }
        try {
          db.addOrUpdateTrack({
            id: trackId, title: t.title || '', artist: t.artist || '', album: t.album || '', duration: t.duration || 0,
            path: outputPath, thumbnail: t.thumbnail || '', youtube_id: videoId, source: 'youtube',
          });
          console.log(`[Downloads]    → Library updated: ${trackId} (path: ${path.basename(outputPath)})`);
        } catch (dbErr: any) {
          console.error(`[Downloads]    → DB update failed: ${dbErr.message || dbErr}`);
        }

        item.status = 'completed';
        item.progress = 100;
        notifyRenderer('download:statusChange', item);
        downloads.delete(id);
        results.push({ trackId, success: true, title: t.title, artist: t.artist });
        console.log(`[Downloads] [${i + 1}/${tracks.length}] ✓ ${t.artist} - ${t.title} → ${filename}`);
      } catch (err: any) {
        console.error(`[Downloads] [${i + 1}/${tracks.length}] ✗ ${t.artist} - ${t.title}: ${err.message || err}`);
        item.status = 'error';
        item.error = err.message;
        notifyRenderer('download:statusChange', item);
        downloads.delete(id);
        results.push({ trackId: t.id || '', success: false, error: err.message, title: t.title, artist: t.artist });
      }
    }

    const success = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`[Downloads] Batch complete: ${success} downloaded, ${skipped} skipped, ${failed} failed (of ${tracks.length})`);
    if (failed > 0) {
      console.log(`[Downloads] Failed tracks:`);
      results.filter((r) => !r.success).slice(0, 10).forEach((r) => {
        console.log(`  - ${r.artist} - ${r.title}: ${r.error}`);
      });
    }

    notifyRenderer('download:batchComplete', { results });
    return results;
  });

  ipcMain.handle('download:getDownloads', () => Array.from(downloads.values()));

  ipcMain.handle('download:cancelDownload', (_event, id: string) => {
    const item = downloads.get(id);
    if (!item) return false;
    if (item.outputPath && fs.existsSync(item.outputPath)) {
      try { fs.unlinkSync(item.outputPath); } catch {}
    }
    item.status = 'cancelled';
    notifyRenderer('download:statusChange', item);
    downloads.delete(id);
    return true;
  });

  ipcMain.handle('download:removeDownload', (_event, id: string) => {
    downloads.delete(id);
    return true;
  });
}
