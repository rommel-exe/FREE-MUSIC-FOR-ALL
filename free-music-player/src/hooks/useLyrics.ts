import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { ipc } from '@/utils/ipc';

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  title: string;
  artist: string;
  lines: LyricLine[];
  synced: boolean;
}

/* ── LRC parser ─────────────────────────────────────────────────── */

function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let match;
  while ((match = regex.exec(lrc)) !== null) {
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    const ms = parseInt(match[3].padEnd(3, '0'), 10);
    const time = min * 60 + sec + ms / 1000;
    const text = match[4].trim();
    if (text) lines.push({ time, text });
  }
  return lines;
}

/* ── Smart timing estimation for plain (unsynced) lyrics ────────── */

/**
 * Estimate syllables from a string.
 * Rough heuristic: ~1 syllable per 3 characters for English text.
 * Override by passing an explicit syllable count.
 */
function estimateSyllables(text: string): number {
  const cleaned = text.replace(/[^a-zA-Z0-9']/g, ' ').trim();
  if (!cleaned) return 0;
  // Count vowel groups as syllable proxy
  const words = cleaned.split(/\s+/);
  let count = 0;
  for (const word of words) {
    if (word.length <= 2) { count += 1; continue; }
    // Count vowel groups (consecutive vowels = 1 syllable)
    const vowelGroups = word.match(/[aeiouyAEIOUY]+/g);
    count += vowelGroups ? vowelGroups.length : 1;
  }
  return Math.max(1, count);
}

/**
 * Distribute plain lyric lines across the track duration using
 * syllable-aware timing.
 *
 * - Estimates syllables per line
 * - Uses a typical singing rate of ~4.5 syllables/sec
 * - Adds short pauses between lines (proportional to line length)
 * - If duration is known, scales proportionally
 * - If duration is unknown, uses the singing-rate estimate
 */
function estimateLineTimings(lines: string[], duration: number): LyricLine[] {
  if (!lines.length) return [];

  const singingRate = 4.5; // syllables per second (moderate singing tempo)
  const pausePerSyllable = 0.12; // pause ~0.12s per syllable between lines
  const leadIn = 2; // first line starts ~2s in

  // Estimate syllables per line and total
  const syllCounts = lines.map(estimateSyllables);
  const totalSyllables = syllCounts.reduce((a, b) => a + b, 0);

  // Total sung time + total pause time
  const totalSungTime = totalSyllables / singingRate;
  const totalPauseTime = syllCounts
    .slice(1)
    .reduce((sum, s) => sum + s * pausePerSyllable, 0);
  const estimatedTotal = totalSungTime + totalPauseTime + leadIn;

  // Use actual duration if available and plausible, else estimate
  const usableDuration =
    duration > estimatedTotal * 0.5
      ? duration - leadIn
      : estimatedTotal - leadIn;

  const scale = usableDuration / (totalSungTime + totalPauseTime);

  const result: LyricLine[] = [];
  let currentTime = leadIn;
  for (let i = 0; i < lines.length; i++) {
    result.push({ time: currentTime, text: lines[i] });
    const lineDuration = (syllCounts[i] / singingRate) * scale;
    const pause = (syllCounts[i] * pausePerSyllable) * scale;
    currentTime += lineDuration + pause;
  }

  return result;
}

/* ── LRU cache ──────────────────────────────────────────────────── */

const cache = new Map<string, LyricsData>();
const CACHE_MAX = 50;

function cacheKey(title: string, artist: string): string {
  return `${artist}|||${title}`.toLowerCase();
}

function cacheSet(key: string, data: LyricsData): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, data);
}

/* ── Multi-source fetching ──────────────────────────────────────── */

interface FetchResult {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  trackName?: string;
  artistName?: string;
}

/** Try lrclib.net — supports both synced (LRC) and plain lyrics. */
async function fetchLrcLib(title: string, artist: string, signal: AbortSignal): Promise<FetchResult | null> {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  const res = await fetch(`https://lrclib.net/api/get?${params}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    syncedLyrics: data.syncedLyrics ?? null,
    plainLyrics: data.plainLyrics ?? null,
    trackName: data.trackName,
    artistName: data.artistName,
  };
}

/**
 * Try lrclib.net search API — broader matching when exact get() fails.
 * Returns the best match.
 */
async function searchLrcLib(title: string, artist: string, signal: AbortSignal): Promise<FetchResult | null> {
  const params = new URLSearchParams({
    q: `${artist} ${title}`,
    track_name: title,
    artist_name: artist,
  });
  const res = await fetch(`https://lrclib.net/api/search?${params}`, { signal });
  if (!res.ok) return null;
  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  // Find best match: prefer exact title match, then same artist
  const best = results.find(
    (r: any) =>
      r.trackName?.toLowerCase() === title.toLowerCase() &&
      r.artistName?.toLowerCase() === artist.toLowerCase(),
  ) ?? results[0];

  return {
    syncedLyrics: best.syncedLyrics ?? null,
    plainLyrics: best.plainLyrics ?? null,
    trackName: best.trackName,
    artistName: best.artistName,
  };
}

/**
 * Fetch lyrics from LRCLIB with Whisper Base alignment fallback.
 *
 * Resolution order:
 *   1. LRCLIB synced LRC  ────► Instant display (synced)
 *   2. Aligned cache (SQLite) ─► Instant display (synced)
 *   3. Whisper alignment       ─► Wait 3-10s, then display (synced)
 *   4. Estimated timings       ──► Display immediately (unsynced)
 */
async function fetchAllSources(title: string, artist: string, signal: AbortSignal): Promise<{
  lines: LyricLine[];
  synced: boolean;
} | null> {
  // ── 1) LRCLIB ────────────────────────────────────────────────
  let lrcResult = await fetchLrcLib(title, artist, signal);
  if (!lrcResult) {
    lrcResult = await searchLrcLib(title, artist, signal);
  }

  if (!lrcResult) return null;

  // ── 2) Synced from LRCLIB → instant display ─────────────────
  if (lrcResult.syncedLyrics) {
    const lines = parseLRC(lrcResult.syncedLyrics);
    if (lines.length > 0) {
      return { lines, synced: true };
    }
  }

  // ── 3) Plain lyrics — try Whisper alignment ────────────────
  if (lrcResult.plainLyrics) {
    const textLines = lrcResult.plainLyrics
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (textLines.length === 0) return null;

    const state = usePlayerStore.getState();
    const videoId = state.currentTrack?.youtubeId;
    const audioUrl = state.audioUrl;

    // 3a) Check SQLite cache first (instant)
    if (videoId) {
      try {
        const cached = await ipc.alignment.getCached(videoId);
        if (cached?.cached && cached.lrc) {
          const lines = parseLRC(cached.lrc);
          if (lines.length > 0) {
            console.log('[useLyrics] Cache hit — using aligned lyrics');
            return { lines, synced: true };
          }
        }
      } catch {
        // IPC might not be available (browser, Electron not ready)
      }

      // 3b) Run Whisper alignment (3-10s, awaited)
      if (audioUrl) {
        try {
          console.log('[useLyrics] Running Whisper alignment...');
          const aligned = await ipc.alignment.align(videoId, audioUrl, textLines);
          if (!signal.aborted && aligned?.lrc) {
            const lines = parseLRC(aligned.lrc);
            if (lines.length > 0) {
              console.log(`[useLyrics] Alignment complete — ${lines.length} lines (confidence: ${(aligned.confidence * 100).toFixed(0)}%)`);
              return { lines, synced: true };
            }
          }
        } catch (err) {
          console.warn('[useLyrics] Alignment failed:', err);
        }
      }
    }

    // 3c) Fallback: syllable-estimated timings
    const songDuration = usePlayerStore.getState().duration;
    const timed = estimateLineTimings(textLines, songDuration);
    return { lines: timed, synced: false };
  }

  return null;
}

/* ── Hook ───────────────────────────────────────────────────────── */

export function useLyrics(title: string, artist: string) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Subscribe to duration changes so plain-lyric timing can re-calibrate
  // when the actual duration becomes known.
  const duration = usePlayerStore((s) => s.duration);

  useEffect(() => {
    if (!title || !artist) {
      setLyrics(null);
      setError(null);
      return;
    }

    const key = cacheKey(title, artist);
    const cached = cache.get(key);
    if (cached) {
      setLyrics(cached);
      setLoading(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    let cancelled = false;

    async function fetchLyrics() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchAllSources(title, artist, abortRef.current!.signal);
        if (cancelled) return;

        if (data) {
          const result: LyricsData = {
            title,
            artist,
            lines: data.lines,
            synced: data.synced,
          };
          cacheSet(key, result);
          setLyrics(result);
        } else {
          setLyrics(null);
          setError('No lyrics found');
        }
      } catch (err: any) {
        if (!cancelled && err.name !== 'AbortError') {
          setLyrics(null);
          setError('Failed to fetch lyrics');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLyrics();
    return () => { cancelled = true; abortRef.current?.abort(); };
  }, [title, artist, duration]);

  return { lyrics, loading, error };
}
