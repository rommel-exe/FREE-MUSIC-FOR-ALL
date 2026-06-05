import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Separate progress bar to avoid full re-render on every progress tick
const ProgressBar = memo(function ProgressBar({
  progress,
  duration,
  onSeek,
}: {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const percent = duration > 0 ? (progress / duration) * 100 : 0;
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * duration);
  }, [duration, onSeek]);

  return (
    <div className="w-full flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-10 text-right tabular-nums">{formatTime(progress)}</span>
      <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative" onClick={handleClick}>
        <div
          className="h-full bg-white rounded-full group-hover:bg-green-400 transition-colors relative"
          style={{ width: `${percent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md" />
        </div>
      </div>
      <span className="text-[10px] text-white/40 w-10 tabular-nums">{formatTime(duration)}</span>
    </div>
  );
});

// Separate volume control to avoid full re-render
const VolumeControl = memo(function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
}) {
  const handleVolumeClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onVolumeChange(Math.max(0, Math.min(1, x / rect.width)));
  }, [onVolumeChange]);

  return (
    <div className="flex items-center gap-2 w-[180px] justify-end">
      <button onClick={onToggleMute} className="p-1 text-white/50 hover:text-white transition-colors" type="button">
        {isMuted || volume === 0 ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : volume < 0.5 ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>
      <div className="w-20 h-1 bg-white/10 rounded-full cursor-pointer group" onClick={handleVolumeClick}>
        <div
          className="h-full bg-white rounded-full group-hover:bg-green-400 transition-colors"
          style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
        />
      </div>
    </div>
  );
});

export const NowPlayingBar = memo(function NowPlayingBar() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);

  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setFullPlayerOpen = usePlayerStore((s) => s.setFullPlayerOpen);
  const toggleQueue = useUIStore((s) => s.toggleQueue);
  const isQueueOpen = useUIStore((s) => s.isQueueOpen);

  if (!currentTrack) {
    return (
      <div className="h-[72px] bg-[#111] border-t border-white/5 flex items-center justify-center">
        <span className="text-white/20 text-sm">Select a song to play</span>
      </div>
    );
  }

  return (
    <div className="h-[72px] bg-[#111] border-t border-white/5 flex items-center px-4 gap-4">
      {/* Track info */}
      <div className="flex items-center gap-3 w-[240px] min-w-0">
        <button
          onClick={() => setFullPlayerOpen(true)}
          className="w-12 h-12 rounded-md bg-white/10 flex-shrink-0 overflow-hidden hover:scale-105 transition-transform"
        >
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            </div>
          )}
        </button>
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{currentTrack.title}</div>
          <div className="text-xs text-white/50 truncate">{currentTrack.artist}</div>
        </div>
      </div>

      {/* Center controls */}
      <div className="flex-1 flex flex-col items-center gap-1 max-w-[600px] mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={toggleShuffle} className={`p-1.5 rounded-full transition-colors ${isShuffle ? 'text-green-400' : 'text-white/50 hover:text-white'}`} title="Shuffle" type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4l3 8-3 8H4m16-16h-4l-3 8 3 8h4M4 12h16" />
            </svg>
          </button>
          <button onClick={previousTrack} className="p-1.5 text-white/70 hover:text-white transition-colors" title="Previous" type="button">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
          </button>
          <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform" title={isPlaying ? 'Pause' : 'Play'} type="button">
            {isPlaying ? (
              <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button onClick={nextTrack} className="p-1.5 text-white/70 hover:text-white transition-colors" title="Next" type="button">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
          </button>
          <button onClick={cycleRepeat} className={`p-1.5 rounded-full transition-colors ${repeatMode !== 'off' ? 'text-green-400' : 'text-white/50 hover:text-white'}`} title={`Repeat: ${repeatMode}`} type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[8px] text-green-400 font-bold">1</span>}
          </button>
        </div>
        <ProgressBar progress={progress} duration={duration} onSeek={seek} />
      </div>

      {/* Volume + Queue */}
      <div className="flex items-center gap-2 w-[180px] justify-end">
        <button onClick={toggleQueue} className={`p-1.5 transition-colors ${isQueueOpen ? 'text-green-400' : 'text-white/50 hover:text-white'}`} title="Queue" type="button">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
        <VolumeControl volume={volume} isMuted={isMuted} onVolumeChange={setVolume} onToggleMute={toggleMute} />
      </div>
    </div>
  );
});
