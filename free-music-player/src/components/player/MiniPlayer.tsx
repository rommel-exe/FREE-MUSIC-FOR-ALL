import { memo, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '@/store/playerStore';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Music } from 'lucide-react';

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function useSliderDrag(
  trackRef: React.RefObject<HTMLDivElement | null>,
  onCommit: (fraction: number) => void,
) {
  const draggingRef = useRef(false);

  const getFraction = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, [trackRef]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onCommit(getFraction(e.clientX));
  }, [getFraction, onCommit]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    onCommit(getFraction(e.clientX));
  }, [getFraction, onCommit]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onCommit(getFraction(e.clientX));
  }, [getFraction, onCommit]);

  return { onPointerDown, onPointerMove, onPointerUp };
}

export const MiniPlayer = memo(function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    togglePlay,
    nextTrack,
    previousTrack,
    setFullPlayerOpen,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      progress: s.progress,
      duration: s.duration,
      togglePlay: s.togglePlay,
      nextTrack: s.nextTrack,
      previousTrack: s.previousTrack,
      setFullPlayerOpen: s.setFullPlayerOpen,
    })),
  );

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const trackRef = useRef<HTMLDivElement>(null);

  const commitSeek = useCallback(
    (fraction: number) => {
      usePlayerStore.getState().seek(fraction * duration);
    },
    [duration],
  );

  const { onPointerDown, onPointerMove, onPointerUp } = useSliderDrag(trackRef, commitSeek);

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-0 glass-content z-50 flex flex-col">
      {/* Header — back button */}
      <div className="px-mac-xl pt-14 pb-2 flex items-center justify-between">
        <button
          onClick={() => setFullPlayerOpen(false)}
          className="flex items-center gap-1 text-white/40 hover:text-white/70 transition-colors duration-mac"
          aria-label="Back to player"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Track info */}
      <div className="flex-1 flex flex-col items-center justify-center px-mac-2xl">
        <div className="w-52 h-52 rounded-mac-2xl bg-white/10 overflow-hidden shadow-2xl mb-8 ring-1 ring-white/[0.06]">
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-16 h-16 text-white/20" />
            </div>
          )}
        </div>

        <div className="text-center mb-6">
          <div className="text-xl font-bold text-white truncate max-w-xs">{currentTrack.title}</div>
          <div className="text-sm text-mac-tertiary mt-1 truncate max-w-xs">{currentTrack.artist}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-mac-2xl pb-12">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs text-white/40 w-10 text-right tabular-nums font-mono">{formatTime(progress)}</span>
          <div
            ref={trackRef}
            className="flex-1 h-5 flex items-center touch-none cursor-pointer group/pbar"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <div className="w-full h-1.5 bg-white/10 rounded-full relative overflow-visible group-hover/pbar:h-2 transition-all duration-150">
              <div
                className="h-full bg-mac-blue rounded-full relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 rounded-full bg-mac-blue/30 blur-sm" />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-mac-glow opacity-0 group-hover/pbar:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-white/40 w-10 tabular-nums font-mono">{formatTime(duration)}</span>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={previousTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-mac active:scale-95"
            aria-label="Previous track"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-mac shadow-lg shadow-white/10"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-black fill-current" />
            ) : (
              <Play className="w-6 h-6 text-black fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-mac active:scale-95"
            aria-label="Next track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Back to main view */}
        <button
          onClick={() => setFullPlayerOpen(false)}
          className="w-full mt-5 py-2 text-white/35 hover:text-white text-sm transition-colors duration-mac"
        >
          Back to Player
        </button>
      </div>
    </div>
  );
});
