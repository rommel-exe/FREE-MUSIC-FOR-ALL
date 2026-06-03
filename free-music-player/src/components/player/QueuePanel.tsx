import React from 'react';
import { motion } from 'framer-motion';
import { X, GripVertical, Trash2 } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { formatDuration } from '@/utils/formatters';

export function QueuePanel() {
  const { queue, queueIndex, currentTrack, removeFromQueue, clearQueue, playTrack } = usePlayerStore();
  const { isQueueOpen, toggleQueue } = useUIStore();

  if (!isQueueOpen) return null;

  return (
    <motion.div
      className="absolute right-0 top-0 bottom-0 w-72 glass-sidebar z-20 flex flex-col border-l border-mac-separator"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="flex items-center justify-between p-4 border-b border-mac-separator">
        <h2 className="text-[15px] font-semibold text-surface-100">Queue</h2>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              type="button"
              onClick={clearQueue}
              className="text-[11px] text-surface-400 hover:text-mac-red transition-colors duration-150 cursor-pointer"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={toggleQueue}
            className="p-1 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-surface-100 transition-colors duration-150 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-surface-500 text-[13px]">Queue is empty</p>
            <p className="text-surface-600 text-[11px] mt-1">Add tracks to start listening</p>
          </div>
        ) : (
          queue.map((track, index) => {
            const isCurrent = index === queueIndex;
            return (
              <div
                key={`${track.id}-${index}`}
                className={`flex items-center gap-2 p-2 rounded-mac-sm group cursor-pointer transition-colors duration-150 ${
                  isCurrent ? 'bg-mac-blue/10' : 'hover:bg-white/5'
                }`}
                onClick={() => playTrack(track)}
              >
                <GripVertical size={14} className="text-surface-600 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                <div className="w-8 h-8 rounded-mac-sm bg-surface-700 overflow-hidden flex-shrink-0">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-500 text-xs">♪</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] truncate ${isCurrent ? 'text-mac-blue' : 'text-surface-100'}`}>{track.title}</p>
                  <p className="text-[11px] text-surface-400 truncate">{track.artist}</p>
                </div>
                <span className="text-[11px] text-surface-600 font-mono tabular-nums">{formatDuration(track.duration)}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFromQueue(index); }}
                  className="p-0.5 rounded text-surface-600 hover:text-mac-red opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
