import { useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLyrics } from '@/hooks/useLyrics';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import type { LyricLine as LyricLineData } from '@/hooks/useLyrics';
import { RefreshCw, Music, AlertCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Offset Nudge Button                                                 */
/* ------------------------------------------------------------------ */

const NudgeBtn = memo(function NudgeBtn({
  delta,
  label,
}: {
  delta: number;
  label: string;
}) {
  const adjust = usePlayerStore((s) => s.adjustLyricsOffset);
  const handleClick = useCallback(() => adjust(delta), [adjust, delta]);
  return (
    <button
      onClick={handleClick}
      className="px-2 py-0.5 text-[10px] font-semibold text-groove-200 hover:text-groove-50 bg-groove-600 rounded-md transition-all duration-150 active:scale-95"
      type="button"
      title={delta > 0 ? `Shift lyrics +${delta}s` : `Shift lyrics ${delta}s`}
    >
      {label}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  Lyric Line — memoized, clickable for tap-to-sync                    */
/* ------------------------------------------------------------------ */

const LyricLineView = memo(function LyricLineView({
  line,
  isActive,
  isPast,
  synced,
  onSyncTap,
  index,
}: {
  line: LyricLineData;
  isActive: boolean;
  isPast: boolean;
  synced: boolean;
  onSyncTap: (lineTime: number) => void;
  index: number;
}) {
  const baseClasses =
    'transition-all duration-300 ease-out cursor-pointer select-none px-4 py-1 rounded-radius-sm';

  const stateClasses = synced
    ? isActive
      ? 'text-groove-50 text-mac-title font-bold scale-[1.02] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]'
      : isPast
        ? 'text-groove-400 text-mac-body'
        : 'text-groove-200 text-mac-body'
    : 'text-groove-200 text-mac-body';

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${
        isActive ? 'bg-emerald-subtle' : 'hover:bg-groove-700/50'
      }`}
      onClick={() => onSyncTap(line.time)}
    >
      {line.text || '\u00A0'}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Lyrics Panel                                                        */
/* ------------------------------------------------------------------ */

export const LyricsPanel = memo(function LyricsPanel() {
  const title = usePlayerStore((s) => s.currentTrack?.title ?? '');
  const artist = usePlayerStore((s) => s.currentTrack?.artist ?? '');
  const progress = usePlayerStore((s) => s.progress);
  const hasTrack = usePlayerStore((s) => s.currentTrack !== null);
  const lyricsOffset = usePlayerStore((s) => s.lyricsOffset);
  const setLyricsOffset = usePlayerStore((s) => s.setLyricsOffset);
  const resetLyricsOffset = usePlayerStore((s) => s.resetLyricsOffset);
  const isLyricsOpen = useUIStore((s) => s.isLyricsOpen);

  const { lyrics, loading, error } = useLyrics(title, artist);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Find current line index ─────────────────────────────────────
  const effectiveProgress = progress + lyricsOffset;

  const currentLineIndex = useMemo(() => {
    if (!lyrics?.lines.length) return -1;

    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (effectiveProgress >= lyrics.lines[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyrics, effectiveProgress]);

  // ── Tap-to-sync ─────────────────────────────────────────────────
  const handleSyncTap = useCallback(
    (lineTime: number) => {
      const newOffset = progress - lineTime;
      setLyricsOffset(Math.round(newOffset * 10) / 10);
    },
    [progress, setLyricsOffset],
  );

  // ── Auto-scroll to active line ─────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || currentLineIndex < 0) return;
    const el = container.querySelector<HTMLDivElement>(
      `[data-line-index="${currentLineIndex}"]`,
    );
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scrollOffset =
      elRect.top -
      containerRect.top -
      containerRect.height / 2 +
      elRect.height / 2;
    container.scrollTo({
      top: container.scrollTop + scrollOffset,
      behavior: 'smooth',
    });
  }, [currentLineIndex]);

  if (!hasTrack || !isLyricsOpen) return null;

  const offsetActive = Math.abs(lyricsOffset) > 0.01;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
      className="bg-groove-900 glass-sidebar border-l border-groove-700 flex flex-col h-full overflow-hidden"
    >
      <div className="w-80 flex flex-col h-full">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="drag-region">
          <div className="relative flex items-center p-4 pb-3 no-drag">
            {/* Subtle gradient behind header */}
            <div className="absolute inset-0 h-20 bg-gradient-to-b from-groove-700/20 to-transparent pointer-events-none" />

            <div className="relative flex items-center gap-3">
              <h2 className="text-mac-headline text-groove-50 font-semibold">Lyrics</h2>
            </div>
          </div>
        </div>

        {/* ── Offset indicator banner ────────────────────────── */}
        <AnimatePresence>
          {offsetActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mx-3 mb-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-subtle border border-emerald/20">
                <p className="text-[11px] text-emerald/70 font-medium">
                  Tap a line to re-sync
                </p>
                <span className="text-[10px] font-mono tabular-nums text-emerald/50 font-semibold">
                  {lyricsOffset > 0 ? '+' : ''}
                  {lyricsOffset.toFixed(2)}s
                </span>
                <button
                  onClick={resetLyricsOffset}
                  className="text-[10px] text-emerald/50 hover:text-emerald transition-colors font-medium"
                  type="button"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Lyrics content ─────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto scrollbar-thin overscroll-contain px-2 py-8"
        >
          {/* Loading */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <div className="w-8 h-8 border-2 border-groove-600 border-t-groove-200 rounded-full animate-spin" />
              <p className="text-[11px] text-groove-400 font-medium">Loading lyrics...</p>
            </motion.div>
          )}

          {/* Error */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-16 gap-3 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-groove-800 flex items-center justify-center ring-1 ring-groove-700">
                <AlertCircle className="w-6 h-6 text-groove-400" />
              </div>
              <p className="text-mac-body text-groove-300 font-medium">{error}</p>
            </motion.div>
          )}

          {/* Lyrics lines */}
          {lyrics && !loading && (
            <div className="space-y-1.5">
              {lyrics.lines.map((line, i) => (
                <div key={i} data-line-index={i}>
                  <LyricLineView
                    line={line}
                    isActive={i === currentLineIndex}
                    isPast={i < currentLineIndex}
                    synced={lyrics.synced}
                    onSyncTap={handleSyncTap}
                    index={i}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Empty / no lyrics */}
          {!lyrics && !loading && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-groove-800 flex items-center justify-center ring-1 ring-groove-700">
                <Music className="w-6 h-6 text-groove-400" />
              </div>
              <p className="text-mac-body text-groove-300 font-medium">
                No lyrics available
              </p>
            </motion.div>
          )}
        </div>

        {/* ── Nudge controls — bottom of panel ──────────────── */}
        {lyrics?.synced && (
          <div className="px-4 py-3 border-t border-groove-700 flex items-center justify-center gap-1">
            <NudgeBtn delta={-1} label="-1s" />
            <NudgeBtn delta={-0.25} label="-0.25s" />
            <NudgeBtn delta={0.25} label="+0.25s" />
            <NudgeBtn delta={1} label="+1s" />

            {offsetActive && (
              <button
                onClick={resetLyricsOffset}
                className="ml-1 p-1 text-groove-400 hover:text-emerald hover:bg-emerald-subtle rounded-md transition-all duration-150 active:scale-95"
                type="button"
                title="Reset sync"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
