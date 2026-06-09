import { useState, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types';
import { X, GripVertical, ListMusic } from 'lucide-react';
import { thumbGradient, thumbLetter } from '@/utils/thumb';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Equalizer bars — animated playing indicator                         */
/* ------------------------------------------------------------------ */

const EqualizerBars = memo(function EqualizerBars({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-[2px] h-3.5 ${className}`}>
      <motion.span
        className="w-[3px] rounded-full bg-green-400"
        animate={{ height: ['30%', '100%', '50%', '80%', '30%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="w-[3px] rounded-full bg-green-400"
        animate={{ height: ['60%', '30%', '100%', '40%', '60%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />
      <motion.span
        className="w-[3px] rounded-full bg-green-400"
        animate={{ height: ['80%', '50%', '30%', '100%', '80%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Queue item row                                                      */
/* ------------------------------------------------------------------ */

const QueueItem = memo(function QueueItem({
  track,
  index,
  isPlaying,
  onPlay,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragIndex,
  dragOverIndex,
}: {
  track: Track;
  index: number;
  isPlaying: boolean;
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  dragIndex: number | null;
  dragOverIndex: number | null;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (dragIndex === null) onPlay(index);
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && dragIndex === null) {
          e.preventDefault();
          onPlay(index);
        }
      }}
      className={`group flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all duration-200 cursor-pointer
        ${dragIndex === index ? 'opacity-40 scale-[0.98]' : ''}
        ${dragOverIndex === index ? 'border-t-2 border-green-400/60' : 'border-t-2 border-transparent'}
        hover:bg-white/[0.04]`}
    >
      {/* Drag handle — visible on hover */}
      <div className="text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Thumbnail — 36px */}
      <div
        className="w-9 h-9 rounded-md flex-shrink-0 overflow-hidden"
        style={{ background: thumbGradient(track.id) }}
      >
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-white/60">
            {thumbLetter(track.title)}
          </div>
        )}
      </div>

      {/* Info — single line: Artist · Title */}
      <div className="flex-1 min-w-0 text-[12px] leading-tight truncate">
        <span className="text-white/40">{track.artist}</span>
        <span className="text-white/40 mx-1">·</span>
        <span className="text-white/80">{track.title}</span>
      </div>

      {/* Duration — monospace */}
      <span className="text-[10px] text-white/25 font-mono tabular-nums flex-shrink-0 tracking-tight">
        {formatTime(track.duration)}
      </span>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        className="p-1 text-white/0 group-hover:text-white/40 hover:!text-white/80 hover:bg-white/[0.08] rounded-md transition-all flex-shrink-0"
        type="button"
        title="Remove from queue"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Queue panel                                                         */
/* ------------------------------------------------------------------ */

export const QueuePanel = memo(function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const isQueueOpen = useUIStore((s) => s.isQueueOpen);
  const toggleQueue = useUIStore((s) => s.toggleQueue);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const upcoming = queue.slice(queueIndex + 1);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragItemRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = dragItemRef.current;
      if (fromIndex === null || fromIndex === toIndex) return;

      const actualFromIndex = queueIndex + 1 + fromIndex;
      const actualToIndex = queueIndex + 1 + toIndex;

      usePlayerStore.getState().reorderQueue(actualFromIndex, actualToIndex);

      setDragIndex(null);
      setDragOverIndex(null);
      dragItemRef.current = null;
    },
    [queueIndex],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  }, []);

  const handlePlay = useCallback(
    (index: number) => {
      const actualIndex = queueIndex + 1 + index;
      usePlayerStore.getState().playFromQueue(actualIndex);
    },
    [queueIndex],
  );

  const handleRemove = useCallback(
    (index: number) => {
      removeFromQueue(queueIndex + 1 + index);
    },
    [removeFromQueue, queueIndex],
  );

  if (!isQueueOpen) return null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
      className="glass-sidebar border-l border-mac-separator flex flex-col h-full overflow-hidden"
    >
      <div className="w-80 flex flex-col h-full">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-3 no-drag">
          <h2 className="text-white/90 font-semibold">
            Queue
            {currentTrack && (
              <span className="text-[11px] text-white/30 font-mono tabular-nums ml-2">
                {upcoming.length}
              </span>
            )}
          </h2>

          <button
            onClick={toggleQueue}
            className="p-1.5 -mr-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] transition-all"
            type="button"
            title="Close queue"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Now Playing ────────────────────────────────── */}
        {currentTrack && (
          <div className="px-3 mb-3">
            <div className="rounded-xl bg-white/[0.04] border-l-2 border-green-400 p-3.5">
              <div className="flex items-center gap-3">
                {/* 64px thumbnail */}
                <div
                  className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden"
                  style={{ background: thumbGradient(currentTrack.id) }}
                >
                  {currentTrack.thumbnail ? (
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-white/60">
                      {thumbLetter(currentTrack.title)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-green-400 truncate">
                    {currentTrack.title}
                  </div>
                  <div className="text-xs text-white/40 truncate">
                    {currentTrack.artist}
                  </div>
                </div>

                {/* Playing indicator */}
                <div className="flex-shrink-0">
                  {isPlaying ? (
                    <EqualizerBars />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400/50" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Up Next List ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {upcoming.length > 0 ? (
            <div className="px-3 pt-3 pb-1">
              <div className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1 select-none">
                Up Next · {upcoming.length}
              </div>

              {upcoming.map((track, i) => (
                <QueueItem
                  key={track.id}
                  track={track}
                  index={i}
                  isPlaying={isPlaying}
                  onPlay={handlePlay}
                  onRemove={handleRemove}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  dragIndex={dragIndex}
                  dragOverIndex={dragOverIndex}
                />
              ))}
            </div>
          ) : (
            /* ── Empty state ────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full text-center px-3">
              <div className="mb-4">
                <ListMusic className="w-7 h-7 text-white/15" />
              </div>
              <p className="text-[13px] text-white/35 font-medium">Queue is empty</p>
              <p className="text-[11px] text-white/20 mt-1.5 leading-relaxed">
                Add songs to see them here
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
