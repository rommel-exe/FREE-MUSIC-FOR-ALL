import { ipcMain } from 'electron';
import {
  importYouTubePlaylist,
  importSpotifyPlaylist,
  type PlaylistImportResult,
} from '../services/playlistImport';
import { resolveBatchYoutubeIds } from '../utils/searchMatching';
import * as db from '../utils/database';
import { validate, IdSchema } from '../utils/validate';
import { z } from 'zod';

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

/**
 * Import a YouTube or Spotify playlist AND create a new playlist in the
 * user's library that contains all the imported tracks.
 *
 * Returns the created playlist + the import summary.
 */
async function importAsPlaylist(
  url: string,
  playlistName?: string,
): Promise<{
  playlist: { id: string; name: string; trackCount: number };
  imported: number;
  total: number;
  failed: number;
}> {
  const trimmed = url.trim();
  const isSpotify = trimmed.includes('spotify.com');
  const isYoutube =
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('music.youtube.com');

  if (!isSpotify && !isYoutube) {
    throw new Error('Invalid playlist URL');
  }

  // --- 1. Fetch the source playlist ---
  let source: PlaylistImportResult;
  if (isYoutube) {
    source = await importYouTubePlaylist(trimmed);
  } else {
    source = await importSpotifyPlaylist(trimmed);
    // --- 1b. Resolve every Spotify track to its exact-duration YouTube match ---
    source.tracks = await resolveBatchYoutubeIds(source.tracks);
  }

  const name = (playlistName?.trim() || source.name || 'Imported Playlist').slice(0, 200);

  // --- 2. Create the playlist row ---
  const playlistId = generateId();
  const playlist = db.createPlaylist({
    id: playlistId,
    name,
    description: isYoutube ? 'Imported from YouTube' : 'Imported from Spotify',
    thumbnail: source.thumbnail || source.tracks[0]?.thumbnail || '',
    source: isYoutube ? 'youtube' : 'spotify',
    source_url: trimmed,
  });

  // --- 3. Insert tracks + link to playlist ---
  let imported = 0;
  let failed = 0;
  const total = source.tracks.length;

  const BATCH_SIZE = 10;
  for (let i = 0; i < source.tracks.length; i += BATCH_SIZE) {
    const batch = source.tracks.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((t) => {
        const trackId = generateId();
        const inserted = db.addTrack({
          id: trackId,
          title: t.title || '',
          artist: t.artist || '',
          album: '',
          duration: t.duration || 0,
          path: '',
          thumbnail: t.thumbnail || '',
          youtube_id: t.youtubeId || '',
          source: t.youtubeId ? 'youtube' : isYoutube ? 'youtube' : 'spotify',
          play_count: 0,
        });
        db.addTrackToPlaylist(playlistId, inserted.id);
        return inserted;
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') imported++;
      else failed++;
    }
  }

  return {
    playlist: { id: playlist.id, name: playlist.name, trackCount: imported },
    imported,
    total,
    failed,
  };
}

const NonEmptyStringSchema = z.string().min(1, 'URL cannot be empty').max(2000);

export function registerImportHandlers(): void {
  ipcMain.handle('import:youtube', async (_event, url: unknown) => {
    try {
      const validatedUrl = validate(NonEmptyStringSchema, url, 'YouTube URL');
      return await importYouTubePlaylist(validatedUrl);
    } catch (err: any) {
      throw new Error(`YouTube import failed: ${err.message}`);
    }
  });

  ipcMain.handle('import:spotify', async (_event, url: unknown) => {
    try {
      const validatedUrl = validate(NonEmptyStringSchema, url, 'Spotify URL');
      return await importSpotifyPlaylist(validatedUrl);
    } catch (err: any) {
      throw new Error(`Spotify import failed: ${err.message}`);
    }
  });

  ipcMain.handle(
    'import:asPlaylist',
    async (_event, url: unknown, playlistName?: string) => {
      try {
        const validatedUrl = validate(NonEmptyStringSchema, url, 'playlist URL');
        const validatedName = playlistName != null ? validate(z.string().max(200), playlistName, 'playlist name') : undefined;
        return await importAsPlaylist(validatedUrl, validatedName);
      } catch (err: any) {
        throw new Error(`Playlist import failed: ${err.message}`);
      }
    },
  );
}
