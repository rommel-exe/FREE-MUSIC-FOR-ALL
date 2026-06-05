import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';

export interface LyricLine {
  time: number;
  text: string;
}

interface LyricsData {
  title: string;
  artist: string;
  lines: LyricLine[];
  synced: boolean;
}

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

export function useLyrics(title: string, artist: string) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!title || !artist) {
      setLyrics(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    let cancelled = false;

    async function fetchLyrics() {
      setLoading(true);
      setError(null);

      try {
        // Try lrclib.net first (free, no API key)
        const params = new URLSearchParams({ track_name: title, artist_name: artist });
        const res = await fetch(`https://lrclib.net/api/get?${params}`, {
          signal: abortRef.current?.signal,
        });

        if (!cancelled && res.ok) {
          const data = await res.json();

          // Prefer synced lyrics, fall back to plain
          if (data.syncedLyrics) {
            const lines = parseLRC(data.syncedLyrics);
            if (lines.length > 0) {
              setLyrics({ title: data.trackName || title, artist: data.artistName || artist, lines, synced: true });
              setLoading(false);
              return;
            }
          }

          if (data.plainLyrics) {
            const lines = data.plainLyrics.split('\n').map((text: string, i: number) => ({
              time: i * 3, // Fake timing for plain lyrics
              text,
            }));
            if (!cancelled) {
              setLyrics({ title: data.trackName || title, artist: data.artistName || artist, lines, synced: false });
            }
          } else if (!cancelled) {
            setLyrics(null);
            setError('No lyrics found');
          }
        } else if (!cancelled) {
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
  }, [title, artist]);

  return { lyrics, loading, error };
}
