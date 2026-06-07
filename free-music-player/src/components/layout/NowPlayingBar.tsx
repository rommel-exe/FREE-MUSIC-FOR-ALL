import { memo, useCallback, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Volume1, Heart, ListMusic, Music, ChevronUp, Mic2,
} from 'lucide-react';

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Progress bar                                                        */
/* ------------------------------------------------------------------ */

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

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      onSeek((x / rect.width) * duration);
    },
    [duration, onSeek],
  );

  return (
    <div className="w-full flex items-center gap-2.5 group/prog">
      <span className="text-[11px] text-white/40 w-10 text-right tabular-nums font-medium">
        {formatTime(progress)}
      </span>
      <div
        className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer relative group/bar"
        onClick={handleClick}
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(progress)}
        aria-valuemax={Math.round(duration)}
        tabIndex={0}
      >
        <div
          className="h-full bg-white group-hover/bar:bg-green-400 rounded-full transition-colors relative"
          style={{ width: `${percent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity shadow-lg shadow-black/50 scale-75 group-hover/bar:scale-100" />
        </div>
      </div>
      <span className="text-[11px] text-white/40 w-10 tabular-nums font-medium">
        {formatTime(duration)}
      </span>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Volume control                                                      */
/* ------------------------------------------------------------------ */

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
  const handleVolumeClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      onVolumeChange(Math.max(0, Math.min(1, x / rect.width)));
    },
    [onVolumeChange],
  );

  const effectiveVolume = isMuted ? 0 : volume;

  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.4 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleMute}
        className="p-1.5 text-white/50 hover:text-white transition-colors rounded-md hover:bg-white/5"
        type="button"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon className="w-4 h-4" />
      </button>
      <div
        className="w-[90px] h-1.5 bg-white/10 rounded-full cursor-pointer group/vol"
        onClick={handleVolumeClick}
        role="slider"
        aria-label="Volume"
        aria-valuenow={Math.round(effectiveVolume * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
      >
        <div
          className="h-full bg-white group-hover/vol:bg-green-400 rounded-full transition-colors relative"
          style={{ width: `${effectiveVolume * 100}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/vol:opacity-100 transition-opacity shadow-md" />
        </div>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Now Playing Bar                                                     */
/* ------------------------------------------------------------------ */

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
  const toggleLyrics = useUIStore((s) => s.toggleLyrics);
  const isLyricsOpen = useUIStore((s) => s.isLyricsOpen);

  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const tracks = useLibraryStore((s) => s.tracks);
  const [hoveringTrack, setHoveringTrack] = useState(false);

  // Look up the current track's favorite state from the library (not the
  // stale player-store copy) so toggling the heart icon reflects instantly.
  const libraryTrack = currentTrack ? tracks.find((t) => t.id === currentTrack.id) : undefined;
  const isFavorited = libraryTrack?.isFavorite ?? currentTrack?.isFavorite ?? false;

  if (!currentTrack) {
    return (
      <div className="h-[80px] bg-[#0c0c0c] border-t border-white/5 flex items-center justify-center">
        <span className="text-white/20 text-sm">Select a song to play</span>
      </div>
    );
  }

  return (
    <div className="h-[80px] bg-[#0c0c0c] border-t border-white/[0.06] flex items-center px-4 gap-4">
      {/* ── Left: Track info ── */}
      <div
        className="flex items-center gap-3 w-[30%] min-w-0"
        onMouseEnter={() => setHoveringTrack(true)}
        onMouseLeave={() => setHoveringTrack(false)}
      >
        <button
          onClick={() => setFullPlayerOpen(true)}
          className="w-14 h-14 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden hover:scale-105 transition-transform shadow-lg shadow-black/30"
          type="button"
        >
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5">
              <Music className="w-6 h-6 text-white/25" />
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{currentTrack.title}</div>
          <div className="text-xs text-white/50 truncate">{currentTrack.artist}</div>
        </div>
        <button
          onClick={() => toggleFavorite(currentTrack.id)}
          className={`p-1.5 rounded-md transition-all duration-150 ${
            hoveringTrack ? 'opacity-100' : 'opacity-0'
          } ${isFavorited ? '!opacity-100' : ''}`}
          type="button"
          title={isFavorited ? 'Unlike' : 'Like'}
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isFavorited
                ? 'text-green-400 fill-green-400'
                : 'text-white/50 hover:text-white'
            }`}
          />
        </button>
      </div>

      {/* ── Center: Controls + Progress ── */}
      <div className="flex-1 flex flex-col items-center gap-1.5 max-w-[700px] mx-auto">
        {/* Transport controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleShuffle}
            className={`p-1.5 rounded-full transition-colors ${
              isShuffle ? 'text-green-400' : 'text-white/50 hover:text-white'
            }`}
            title={isShuffle ? 'Shuffle on' : 'Shuffle off'}
            type="button"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={previousTrack}
            className="p-1.5 text-white/70 hover:text-white transition-colors"
            title="Previous track"
            type="button"
          >
            <SkipBack className="w-5 h-5 fill-white/70" />
          </button>

          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-150 shadow-lg shadow-white/10"
            title={isPlaying ? 'Pause' : 'Play'}
            type="button"
          >
            {isPlaying ? (
              <Pause className="w-4.5 h-4.5 text-black fill-black" />
            ) : (
              <Play className="w-4.5 h-4.5 text-black fill-black ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-1.5 text-white/70 hover:text-white transition-colors"
            title="Next track"
            type="button"
          >
            <SkipForward className="w-5 h-5 fill-white/70" />
          </button>

          <button
            onClick={cycleRepeat}
            className={`relative p-1.5 rounded-full transition-colors ${
              repeatMode !== 'off' ? 'text-green-400' : 'text-white/50 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
            type="button"
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Progress bar */}
        <ProgressBar progress={progress} duration={duration} onSeek={seek} />
      </div>

      {/* ── Right: Queue + Volume ── */}
      <div className="flex items-center gap-1.5 w-[30%] justify-end">
        <button
          onClick={toggleLyrics}
          className={`p-1.5 rounded-md transition-colors ${
            isLyricsOpen ? 'text-green-400 bg-green-400/10' : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
          title="Lyrics"
          type="button"
        >
          <Mic2 className="w-4 h-4" />
        </button>
        <button
          onClick={toggleQueue}
          className={`p-1.5 rounded-md transition-colors ${
            isQueueOpen ? 'text-green-400 bg-green-400/10' : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
          title="Queue"
          type="button"
        >
          <ListMusic className="w-4 h-4" />
        </button>
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
        />
      </div>
    </div>
  );
});
