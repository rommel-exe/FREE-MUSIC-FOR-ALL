import React, { useState } from 'react';
import { Play, Pause, Heart, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Track } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { formatDuration } from '@/utils/formatters';

interface TrackItemProps {
  track: Track;
  index?: number;
  showIndex?: boolean;
  showAlbum?: boolean;
  isActive?: boolean;
  onPlay?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  onRemove?: (track: Track) => void;
  onFavorite?: (track: Track) => void;
}

export function TrackItem({
  track,
  index,
  showIndex = true,
  showAlbum = false,
  isActive,
  onPlay,
  onAddToQueue,
  onFavorite,
}: TrackItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { currentTrack, playTrack, togglePlay, isPlaying } = usePlayerStore();
  const { toggleFavorite } = useLibraryStore();
  const { addToast } = useUIStore();

  const isCurrentlyPlaying = isActive ?? currentTrack?.id === track.id;

  const handlePlay = () => {
    if (onPlay) {
      onPlay(track);
    } else {
      playTrack(track);
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavorite) {
      onFavorite(track);
    } else {
      toggleFavorite(track.id);
    }
  };

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-1.5 rounded-mac-sm cursor-pointer transition-colors duration-150 ${
        isCurrentlyPlaying ? 'bg-mac-blue/10' : 'hover:bg-white/5'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handlePlay}
    >
      {showIndex && (
        <div className="w-7 text-center">
          {isHovered ? (
            <button type="button" className="text-surface-100">
              {isCurrentlyPlaying && isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          ) : isCurrentlyPlaying ? (
            <div className="flex items-center justify-center gap-[2px]">
              <motion.div
                className="w-[2px] bg-mac-blue rounded-full"
                animate={{ height: isPlaying ? [3, 10, 3] : 3 }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              />
              <motion.div
                className="w-[2px] bg-mac-blue rounded-full"
                animate={{ height: isPlaying ? [10, 3, 10] : 3 }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
              />
              <motion.div
                className="w-[2px] bg-mac-blue rounded-full"
                animate={{ height: isPlaying ? [3, 10, 3] : 3 }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
              />
            </div>
          ) : (
            <span className="text-surface-500 text-[13px]">{(index ?? 0) + 1}</span>
          )}
        </div>
      )}

      <div className="w-9 h-9 rounded-mac-sm overflow-hidden bg-surface-700 flex-shrink-0">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-surface-500 text-sm">♪</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium truncate ${isCurrentlyPlaying ? 'text-mac-blue' : 'text-surface-100'}`}>
          {track.title}
        </p>
        <p className="text-[11px] text-surface-400 truncate">{track.artist}</p>
      </div>

      {showAlbum && (
        <p className="text-[11px] text-surface-400 truncate w-32 hidden md:block">{track.album}</p>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          onClick={handleFavorite}
          className={`p-1 rounded-mac-sm transition-colors duration-150 ${
            track.isFavorite ? 'text-mac-red' : 'text-surface-500 hover:text-surface-100'
          }`}
        >
          <Heart size={13} fill={track.isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onAddToQueue) onAddToQueue(track);
            else {
              usePlayerStore.getState().addToQueue(track);
              useUIStore.getState().addToast('Added to queue');
            }
          }}
          className="p-1 rounded-mac-sm text-surface-500 hover:text-surface-100 transition-colors duration-150"
        >
          <Plus size={13} />
        </button>
      </div>

      <span className="text-[11px] text-surface-500 font-mono tabular-nums w-10 text-right">{formatDuration(track.duration)}</span>
    </div>
  );
}
