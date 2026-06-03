import React, { useRef, useCallback, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, Volume1, VolumeX, Heart, ListMusic, Maximize2,
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { formatDuration } from '@/utils/formatters';

export function NowPlayingBar() {
  const {
    currentTrack, isPlaying, progress, duration, volume, isShuffle, repeatMode, isMuted,
    togglePlay, nextTrack, previousTrack, seek, setVolume, toggleMute,
    toggleShuffle, cycleRepeat, setFullPlayerOpen,
  } = usePlayerStore();
  const { toggleFavorite } = useLibraryStore();
  const { isQueueOpen, toggleQueue, isFullPlayerOpen } = useUIStore();
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const [progressHovered, setProgressHovered] = useState(false);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * duration);
  }, [duration, seek]);

  const handleVolumeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pct);
  }, [setVolume]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="h-16 glass-content border-t border-mac-separator flex items-center px-5 gap-5 relative z-30">
      {/* Progress bar at top */}
      <div
        ref={progressRef}
        className="absolute top-0 left-0 right-0 cursor-pointer group"
        style={{ height: progressHovered ? 4 : 2, marginTop: progressHovered ? -1 : 0, transition: 'height 150ms ease-out, margin-top 150ms ease-out' }}
        onClick={handleProgressClick}
        onMouseEnter={() => setProgressHovered(true)}
        onMouseLeave={() => setProgressHovered(false)}
      >
        <div className="absolute inset-0 bg-mac-fill/50" />
        <div
          className="absolute top-0 left-0 h-full bg-mac-blue transition-none"
          style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ left: duration ? `calc(${(progress / duration) * 100}% - 6px)` : '0%' }}
        />
      </div>

      {/* LEFT: Track info */}
      <div className="flex items-center gap-3 w-72 min-w-[200px]">
        {currentTrack ? (
          <>
            <button
              type="button"
              className="w-10 h-10 rounded-mac-sm overflow-hidden bg-surface-700 flex-shrink-0 shadow-sm cursor-pointer"
              onClick={() => setFullPlayerOpen(true)}
            >
              {currentTrack.thumbnail ? (
                <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xl text-surface-500">♪</span>
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="text-[13px] font-medium text-mac-primary truncate cursor-pointer hover:underline text-left block w-full"
                onClick={() => setFullPlayerOpen(true)}
              >
                {currentTrack.title}
              </button>
              <p className="text-[11px] text-mac-tertiary truncate">{currentTrack.artist}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleFavorite(currentTrack.id)}
              className={`flex-shrink-0 p-1.5 rounded-mac-sm transition-colors duration-150 ${
                currentTrack.isFavorite ? 'text-mac-red' : 'text-surface-500 hover:text-surface-100'
              }`}
            >
              <Heart size={14} fill={currentTrack.isFavorite ? 'currentColor' : 'none'} />
            </button>
          </>
        ) : (
          <div className="text-surface-500 text-[13px]">No track playing</div>
        )}
      </div>

      {/* CENTER: Controls */}
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleShuffle}
            className={`p-1.5 rounded-mac-sm transition-colors duration-150 ${
              isShuffle ? 'text-mac-blue' : 'text-surface-400 hover:text-surface-100'
            }`}
          >
            <Shuffle size={16} />
          </button>
          <button
            type="button"
            onClick={previousTrack}
            className="p-1.5 rounded-mac-sm text-surface-300 hover:text-surface-100 transition-colors duration-150"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center hover:bg-white transition-colors duration-150 cursor-pointer"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause size={16} className="text-surface-900" fill="currentColor" />
            ) : (
              <Play size={16} className="text-surface-900 ml-0.5" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={nextTrack}
            className="p-1.5 rounded-mac-sm text-surface-300 hover:text-surface-100 transition-colors duration-150"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={cycleRepeat}
            className={`p-1.5 rounded-mac-sm transition-colors duration-150 ${
              repeatMode !== 'off' ? 'text-mac-blue' : 'text-surface-400 hover:text-surface-100'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-mac-tertiary font-mono tabular-nums">
          <span className="w-10 text-right">{formatDuration(progress)}</span>
          <span className="text-mac-quaternary">/</span>
          <span className="w-10">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* RIGHT: Volume & extras */}
      <div className="flex items-center gap-2 w-72 justify-end">
        <button
          type="button"
          onClick={toggleMute}
          className="p-1.5 rounded-mac-sm text-surface-400 hover:text-surface-100 transition-colors duration-150"
        >
          <VolumeIcon size={16} />
        </button>
        <div
          ref={volumeRef}
          className="w-24 h-1 bg-mac-fill/50 rounded-full cursor-pointer group relative"
          onClick={handleVolumeClick}
        >
          <div
            className="h-full bg-surface-100 rounded-full relative"
            style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          </div>
        </div>
        <div className="w-px h-4 bg-mac-separator mx-1" />
        <button
          type="button"
          onClick={toggleQueue}
          className={`p-1.5 rounded-mac-sm transition-colors duration-150 ${isQueueOpen ? 'text-mac-blue' : 'text-surface-400 hover:text-surface-100'}`}
        >
          <ListMusic size={16} />
        </button>
        <button
          type="button"
          onClick={() => setFullPlayerOpen(!isFullPlayerOpen)}
          className="p-1.5 rounded-mac-sm text-surface-400 hover:text-surface-100 transition-colors duration-150"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
