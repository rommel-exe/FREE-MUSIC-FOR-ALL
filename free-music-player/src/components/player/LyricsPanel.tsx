import { useEffect, useRef, useMemo, memo } from 'react';
import { useLyrics } from '@/hooks/useLyrics';
import { usePlayerStore } from '@/store/playerStore';
import type { LyricLine as LyricLineData } from '@/hooks/useLyrics';

/** Memoized individual lyric line. Only re-renders when its own state changes. */
const LyricLineView = memo(function LyricLineView({
  line,
  isActive,
  isPast,
  synced,
  indexRef,
}: {
  line: LyricLineData;
  isActive: boolean;
  isPast: boolean;
  synced: boolean;
  indexRef: (el: HTMLDivElement | null) => void;
}) {
  const className = synced
    ? isActive
      ? 'text-white text-xl font-bold scale-105'
      : isPast
        ? 'text-white/30 text-lg'
        : 'text-white/50 text-lg'
    : 'text-white/70 text-lg';

  return (
    <div ref={isActive ? indexRef : undefined} className={`transition-all duration-300 ${className}`}>
      {line.text || '\u00A0'}
    </div>
  );
});

export function LyricsPanel() {
  // Only subscribe to what we actually need. The lyrics panel re-renders
  // every progress tick — keep the render path as cheap as possible.
  const title = usePlayerStore((s) => s.currentTrack?.title ?? '');
  const artist = usePlayerStore((s) => s.currentTrack?.artist ?? '');
  const progress = usePlayerStore((s) => s.progress);
  const hasTrack = usePlayerStore((s) => s.currentTrack !== null);

  const { lyrics, loading, error } = useLyrics(title, artist);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Find current line index — only recomputes when lyrics or progress change.
  const currentLineIndex = useMemo(() => {
    if (!lyrics?.synced || !lyrics.lines.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (progress >= lyrics.lines[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyrics, progress]);

  // Auto-scroll to active line.
  useEffect(() => {
    const container = containerRef.current;
    const el = activeLineRef.current;
    if (container && el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
      container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' });
    }
  }, [currentLineIndex]);

  if (!hasTrack) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <h2 className="text-lg font-bold text-white">Lyrics</h2>
        {title && (
          <div className="text-sm text-white/50 truncate">
            {title} — {artist}
          </div>
        )}
      </div>

      {/* Lyrics content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-white/10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <p className="text-white/30 text-sm">{error}</p>
          </div>
        )}

        {lyrics && !loading && (
          <div className="space-y-4">
            {lyrics.lines.map((line, i) => (
              <LyricLineView
                key={i}
                line={line}
                isActive={i === currentLineIndex}
                isPast={i < currentLineIndex}
                synced={lyrics.synced}
                indexRef={(el) => {
                  if (i === currentLineIndex) activeLineRef.current = el;
                }}
              />
            ))}
          </div>
        )}

        {!lyrics && !loading && !error && (
          <div className="text-center py-12">
            <p className="text-white/30 text-sm">No lyrics available</p>
          </div>
        )}
      </div>
    </div>
  );
}
