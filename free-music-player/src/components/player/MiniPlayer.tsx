import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '@/store/playerStore';

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MiniPlayer() {
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

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-0 bg-[#111] z-50 flex flex-col">
      {/* Track info */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-48 h-48 rounded-xl bg-white/10 overflow-hidden shadow-2xl mb-6">
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            </div>
          )}
        </div>

        <div className="text-center mb-6">
          <div className="text-xl font-bold text-white truncate max-w-xs">{currentTrack.title}</div>
          <div className="text-sm text-white/50 mt-1 truncate max-w-xs">{currentTrack.artist}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-8 pb-8">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-white/40 w-10 text-right tabular-nums">{formatTime(progress)}</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-xs text-white/40 w-10 tabular-nums">{formatTime(duration)}</span>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center justify-center gap-6">
          <button onClick={previousTrack} className="p-2 text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button onClick={nextTrack} className="p-2 text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Back to main view */}
        <button
          onClick={() => setFullPlayerOpen(false)}
          className="w-full mt-4 py-2 text-white/40 hover:text-white text-sm transition-colors"
        >
          Back to Player
        </button>
      </div>
    </div>
  );
}
