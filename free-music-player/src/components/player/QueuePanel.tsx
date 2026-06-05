import { useState, useRef, useCallback, memo } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import type { Track } from '@/types';

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Memoized queue item
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
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 px-2 py-2 rounded-md group transition-colors cursor-grab active:cursor-grabbing ${
        dragIndex === index ? 'opacity-50' : ''
      } ${dragOverIndex === index ? 'border-t-2 border-green-400' : ''} hover:bg-white/5`}
    >
      <div className="text-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm8-16a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </div>

      <div className="w-8 h-8 rounded bg-white/10 flex-shrink-0 overflow-hidden">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${isCurrent ? 'text-green-400 font-medium' : 'text-white'}`}>{track.title}</div>
        <div className="text-xs text-white/50 truncate">{track.artist}</div>
      </div>

      <span className="text-xs text-white/30 tabular-nums">{formatTime(track.duration)}</span>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"
        type="button"
      >
        <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
});

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

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = dragItemRef.current;
    if (fromIndex === null || fromIndex === toIndex) return;

    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);

    const newCurrentIndex = newQueue.findIndex(t => t.id === currentTrack?.id);
    usePlayerStore.setState({ queue: newQueue, queueIndex: newCurrentIndex >= 0 ? newCurrentIndex : 0 });

    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  }, [queue, currentTrack]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  }, []);

  const handlePlay = useCallback((index: number) => {
    const actualIndex = queueIndex + 1 + index;
    usePlayerStore.setState({
      queueIndex: actualIndex,
      currentTrack: queue[actualIndex],
      progress: 0,
      isPlaying: true,
    });
  }, [queue, queueIndex]);

  const handleRemove = useCallback((index: number) => {
    removeFromQueue(queueIndex + 1 + index);
  }, [removeFromQueue, queueIndex]);

  if (!isQueueOpen) return null;

  return (
    <div className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h2 className="text-lg font-bold text-white">Queue</h2>
        <button onClick={toggleQueue} className="p-1 hover:bg-white/10 rounded transition-colors" type="button">
          <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {currentTrack && (
        <div className="p-4 border-b border-white/5">
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Now Playing</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 overflow-hidden">
              {currentTrack.thumbnail ? (
                <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-green-400 truncate">{currentTrack.title}</div>
              <div className="text-xs text-white/50 truncate">{currentTrack.artist}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {upcoming.length > 0 ? (
          <div className="p-2">
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-2">Up Next ({upcoming.length})</div>
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
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <svg className="w-12 h-12 text-white/10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <p className="text-white/30 text-sm">Queue is empty</p>
          </div>
        )}
      </div>
    </div>
  );
});
