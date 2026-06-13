import { ipcMain } from 'electron';
import { trackIdentityEngine } from '../identity/trackIdentityEngine';

// ═══════════════════════════════════════════════════════════════════════════
//  Identity IPC Handlers
//
//  Exposes the TrackIdentityEngine to the renderer process via IPC.
//  All handlers return plain objects — no exceptions escape to the caller.
// ═══════════════════════════════════════════════════════════════════════════

export function registerIdentityHandlers(): void {
  // ── Identify a single track ────────────────────────────────────────
  ipcMain.handle('identity:identify', async (_event, track: any) => {
    try {
      if (!track?.title || !track?.artist || !track?.duration) {
        return { error: 'Missing required fields: title, artist, duration' };
      }
      return await trackIdentityEngine.identify({
        title: String(track.title),
        artist: String(track.artist),
        album: track.album ? String(track.album) : undefined,
        duration: Number(track.duration),
        source: track.source ? String(track.source) : undefined,
        youtubeId: track.youtubeId ? String(track.youtubeId) : undefined,
        spotifyId: track.spotifyId ? String(track.spotifyId) : undefined,
      });
    } catch (err: any) {
      console.error('[identity:identify] Error:', err.message);
      return { error: err.message };
    }
  });

  // ── Batch identify with progress ───────────────────────────────────
  ipcMain.handle('identity:batchIdentify', async (event, tracks: any[]) => {
    try {
      if (!Array.isArray(tracks) || tracks.length === 0) {
        return { error: 'No tracks provided' };
      }

      const results = await trackIdentityEngine.batchIdentify(
        tracks.map((t: any) => ({
          title: String(t.title),
          artist: String(t.artist),
          album: t.album ? String(t.album) : undefined,
          duration: Number(t.duration),
          source: t.source ? String(t.source) : undefined,
          youtubeId: t.youtubeId ? String(t.youtubeId) : undefined,
          spotifyId: t.spotifyId ? String(t.spotifyId) : undefined,
        })),
        (completed: number, total: number) => {
          event.sender.send('identity:batchProgress', { completed, total });
        },
      );

      return { results };
    } catch (err: any) {
      console.error('[identity:batchIdentify] Error:', err.message);
      return { error: err.message, results: [] };
    }
  });

  // ── Force re-match (ignore cache) ──────────────────────────────────
  ipcMain.handle('identity:rematch', async (_event, track: any) => {
    try {
      if (!track?.title || !track?.artist) {
        return { error: 'Missing required fields: title, artist' };
      }
      return await trackIdentityEngine.rematch({
        title: String(track.title),
        artist: String(track.artist),
        album: track.album ? String(track.album) : undefined,
        duration: Number(track.duration ?? 0),
      });
    } catch (err: any) {
      console.error('[identity:rematch] Error:', err.message);
      return { error: err.message };
    }
  });

  // ── Invalidate a cached fingerprint ─────────────────────────────────
  ipcMain.handle('identity:invalidate', async (_event, fingerprint: unknown) => {
    try {
      if (!fingerprint || typeof fingerprint !== 'string') {
        return { error: 'Invalid fingerprint' };
      }
      await trackIdentityEngine.invalidate(fingerprint);
      return { ok: true };
    } catch (err: any) {
      console.error('[identity:invalidate] Error:', err.message);
      return { error: err.message };
    }
  });

  // ── Get engine stats ───────────────────────────────────────────────
  ipcMain.handle('identity:getStats', async () => {
    try {
      return trackIdentityEngine.getStats();
    } catch (err: any) {
      console.error('[identity:getStats] Error:', err.message);
      return { error: err.message };
    }
  });

  // ── Verify a specific candidate ────────────────────────────────────
  ipcMain.handle('identity:verify', async (_event, track: any, candidate: any) => {
    try {
      if (!track || !candidate) {
        return { error: 'Missing required arguments: track, candidate' };
      }
      return await trackIdentityEngine.verify(track, candidate);
    } catch (err: any) {
      console.error('[identity:verify] Error:', err.message);
      return { error: err.message };
    }
  });

  // ── Cleanup old entries ────────────────────────────────────────────
  ipcMain.handle('identity:cleanup', async () => {
    try {
      const count = await trackIdentityEngine.cleanup();
      return { ok: true, removed: count };
    } catch (err: any) {
      console.error('[identity:cleanup] Error:', err.message);
      return { error: err.message };
    }
  });
}
