import type { LyricsResult } from '../utils/types';

/**
 * Fetch lyrics for a track.
 * Tries lrclib.net API directly (no API key needed).
 * Falls back gracefully if nothing found.
 */

export async function getLyrics(
  track: string,
  artist: string,
  album?: string,
  duration?: number,
): Promise<LyricsResult> {
  try {
    // Try lrclib.net first
    const lrclibResult = await fetchLrclib(track, artist, album, duration);
    if (lrclibResult) return lrclibResult;

    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get lyrics: ${message}`);
  }
}

// ─── lrclib direct ─────────────────────────────────────────────────────

function parseLrc(lrc: string): { time: number; text: string }[] {
  const lines: { time: number; text: string }[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lrc.split('\n')) {
    const match = line.match(regex);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, '0'), 10);
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

async function fetchLrclib(
  track: string,
  artist: string,
  album?: string,
  duration?: number,
): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({
      track_name: track,
      artist_name: artist,
    });
    if (album) params.set('album_name', album);
    if (duration) params.set('duration', String(Math.round(duration)));

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { 'User-Agent': 'FreeMusicPlayer/1.0' },
    });

    if (!res.ok) return null;

    const data: any = await res.json();

    if (data.syncedLyrics) {
      const synced = parseLrc(data.syncedLyrics);
      if (synced.length > 0) return { synced };
    }

    if (data.plainLyrics) {
      return { plain: data.plainLyrics };
    }

    return null;
  } catch {
    return null;
  }
}
