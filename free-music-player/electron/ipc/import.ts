import { ipcMain } from 'electron';
import { importPlaylist as importSpotifyPlaylist } from '../services/spotify-import';
import { importPlaylist as importYTPlaylist } from '../services/yt-playlist';
import { searchYouTube } from '../services/ytdl';
import * as db from '../utils/database';

function generateId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
}

/**
 * Search YouTube for a track and return the videoId.
 * Returns null if no result found.
 */
async function resolveYouTubeId(title: string, artist: string): Promise<string | null> {
  try {
    const query = `${title} ${artist}`.trim();
    if (!query) return null;
    const results = await searchYouTube(query, 1);
    return results && results.length > 0 ? results[0].id : null;
  } catch {
    return null;
  }
}

export function registerImportHandlers(): void {
  ipcMain.handle('import:importSpotifyPlaylist', async (_event, url: string) => {
    try {
      return await importSpotifyPlaylist(url);
    } catch (err: any) {
      throw new Error(`Spotify import failed: ${err.message}`);
    }
  });

  ipcMain.handle('import:importYouTubePlaylist', async (_event, url: string) => {
    try {
      return await importYTPlaylist(url);
    } catch (err: any) {
      throw new Error(`YouTube import failed: ${err.message}`);
    }
  });

  ipcMain.handle('import:importTracks', async (_event, tracks: any[], targetPlaylistId?: string) => {
    try {
      // Create playlist if we have a target
      let playlistId = targetPlaylistId;
      if (playlistId && !db.getPlaylistById(playlistId)) {
        playlistId = undefined;
      }

      const importedTracks: any[] = [];

      // Pre-resolve YouTube IDs in parallel for tracks that don't have one.
      // CRITICAL: we use the ORIGINAL array index as the key (not the object
      // reference) because IPC serialization creates fresh objects on the main
      // process side, so object-identity Map keys can fail to match.
      console.log(`[Import] Pre-resolving YouTube IDs for ${tracks.length} tracks in parallel...`);
      const resolveStart = Date.now();

      const resolvePromises = tracks.map(async (t, idx) => {
        if (t.videoId || !t.title) return { idx, videoId: '' };
        const videoId = await resolveYouTubeId(t.title, t.artist);
        return { idx, videoId: videoId || '' };
      });
      const resolveResults = await Promise.all(resolvePromises);
      const videoIdByIndex = new Map<number, string>();
      for (const { idx, videoId } of resolveResults) {
        if (videoId) videoIdByIndex.set(idx, videoId);
      }
      const resolved = Array.from(videoIdByIndex.values()).filter(Boolean).length;
      console.log(`[Import] Resolved ${resolved}/${tracks.length} YouTube IDs in ${Date.now() - resolveStart}ms`);

      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        const trackId = generateId();
        const videoId = t.videoId || videoIdByIndex.get(i) || '';
        const track = db.addTrack({
          id: trackId,
          title: t.title || '',
          artist: t.artist || '',
          album: t.album || '',
          duration: t.duration || 0,
          path: '',
          thumbnail: t.thumbnail || '',
          youtube_id: videoId,
          source: videoId ? 'youtube' : 'local',
        });
        importedTracks.push(track);

        if (playlistId) {
          const pts = db.getPlaylistTracks(playlistId);
          db.addTrackToPlaylist(playlistId, trackId, pts.length);
        }
      }

      return importedTracks;
    } catch (err: any) {
      throw new Error(`Track import failed: ${err.message}`);
    }
  });
}
