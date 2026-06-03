import React, { useState, useEffect } from 'react';
import { ipc } from '@/utils/ipc';
import { LyricsData } from '@/types';
import { Track } from '@/types';

export function useLyrics(track: Track | null) {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!track) {
      setLyrics(null);
      return;
    }

    setLoading(true);
    ipc.lyrics.getLyrics(track.title, track.artist, track.album, track.duration)
      .then((data) => {
        setLyrics(data);
        setLoading(false);
      })
      .catch(() => {
        setLyrics(null);
        setLoading(false);
      });
  }, [track?.id, track?.title, track?.artist]);

  return { lyrics, loading };
}
