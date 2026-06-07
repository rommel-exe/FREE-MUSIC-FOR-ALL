import { useState, useRef, useCallback, memo } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types';
import { X, Music, GripVertical, Play } from 'lucide-react';

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Queue item row                                                      */
/* ------------------------------------------------------------------ */

const QueueItem = memo(function QueueItem({
  track,
  index,
  isCurrent,
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
  isCurrent: boolean;
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
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-3 px-2 py-2 rounded-md transition-colors cursor-grab active:cursor-grabbing ${
        dragIndex === index ? 'opacity-40' : ''
      } ${dragOverIndex === index ? 'border-t-2 border-green-400' : ''} hover:bg-white/5 group`}
    >
      {/* Drag handle */}
      <div className="text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Thumbnail — 44px */}
      <div className="w-11 h-11 rounded-md bg-white/10 flex-shrink-0 overflow-hidden">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-4 h-4 text-white/25" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate font-medium ${isCurrent ? 'text-green-400' : 'text-white'}`}>
          {track.title}
        </div>
        <div className="text-xs text-white/50 truncate">{track.artist}</div>
      </div>

      {/* Duration */}
      <span className="text-xs text-white/30 tabular-nums flex-shrink-0">{formatTime(track.duration)}</span>

      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all flex-shrink-0"
        type="button"
        title="Remove from queue"
      >
        <X className="w-3.5 h-3.5 text-white/50" />
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

      // Map from "upcoming" indices (0-based after current) to absolute queue indices
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
    <div className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 h-24 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between p-4 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">Queue</h2>
            <p className="text-xs text-white/40 mt-0.5">
              {currentTrack ? `Now playing + ${upcoming.length} in queue` : 'Empty queue'}
            </p>
          </div>
          <button
            onClick={toggleQueue}
            className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white"
            type="button"
            title="Close queue"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Now playing */}
      {currentTrack && (
        <div className="px-3 pb-3">
          <div className="relative rounded-lg overflow-hidden bg-white/[0.04] border-l-2 border-green-400">
            <div className="flex items-center gap-3 p-3">
              <div className="w-14 h-14 rounded-md bg-white/10 flex-shrink-0 overflow-hidden shadow-lg shadow-black/30">
                {currentTrack.thumbnail ? (
                  <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-5 h-5 text-white/25" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-green-400 truncate">{currentTrack.title}</div>
                <div className="text-xs text-white/50 truncate">{currentTrack.artist}</div>
              </div>
              {isPlaying && (
                <div className="flex items-center gap-0.5">
                  <div className="w-0.5 h-3 bg-green-400 rounded-full animate-pulse" />
                  <div className="w-0.5 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-0.5 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-t border-white/5" />

      {/* Up next list */}
      <div className="flex-1 overflow-y-auto">
        {upcoming.length > 0 ? (
          <div className="p-2">
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-2">
              Up Next · {upcoming.length}
            </div>
            {upcoming.map((track, i) => {
              const actualIndex = queueIndex + 1 + i;
              return (
                <QueueItem
                  key={`${track.id}-${actualIndex}`}
                  track={track}
                  index={i}
                  isCurrent={false}
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
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4 border border-white/5">
              <Music className="w-7 h-7 text-white/15" />
            </div>
            <p className="text-white/30 text-sm font-medium">Queue is empty</p>
            <p className="text-xs text-white/20 mt-1">Add songs to see them here</p>
          </div>
        )}
      </div>
    </div>
  );
});
