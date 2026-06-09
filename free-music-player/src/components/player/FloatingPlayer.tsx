import { memo, useCallback, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';
import type { Track } from '@/types';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Volume1, Heart, ListMusic, Music, Mic2, Maximize2,
  Download, Check, Loader2
} from 'lucide-react';
import { useDownloadStore } from '@/store/downloadStore';

/* ─── Helpers ─── */

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* ─── Slider Hook ─── */

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

/* ─── Playing Indicator (Equalizer) ─── */

const Equalizer = memo(function Equalizer() {
  return (
    <div className="playing-indicator text-mac-accent">
      <span /><span /><span /><span />
    </div>
  );
});

/* ─── Volume Slider ─── */

const VolumeSlider = memo(function VolumeSlider({
  volume,
  onChange,
}: {
  volume: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const percent = volume * 100;

  const commitVolume = useCallback((fraction: number) => {
    onChange(Math.max(0, Math.min(1, fraction)));
  }, [onChange]);

  const { onPointerDown, onPointerMove, onPointerUp } = useSliderDrag(trackRef, commitVolume);

  return (
    <div
      ref={trackRef}
      className="w-20 h-1.5 bg-white/15 rounded-full relative touch-none cursor-pointer group/vol"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="slider"
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      tabIndex={0}
    >
      {/* Fill */}
      <div
        className="h-full bg-white/50 rounded-full relative transition-[width] duration-100"
        style={{ width: `${percent}%` }}
      >
        {/* Thumb */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover/vol:scale-100 transition-transform duration-200" />
      </div>
      {/* Track highlight on hover */}
      <div className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover/vol:opacity-100 transition-opacity" />
    </div>
  );
});

/* ─── Control Button ─── */

const CtrlButton = memo(function CtrlButton({
  onClick,
  label,
  active,
  accent,
  children,
  className = '',
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  accent?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`
        relative w-9 h-9 rounded-full flex items-center justify-center
        transition-all duration-200 ease-out
        ${active
          ? 'text-mac-accent'
          : 'text-white/60 hover:text-white'
        }
        ${accent && active ? 'bg-white/10' : ''}
        hover:bg-white/10 active:scale-90
        ${className}
      `}
    >
      {children}
      {active && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mac-accent" />
      )}
    </button>
  );
});

/* ─── Play Button ─── */

const PlayButton = memo(function PlayButton({
  isPlaying,
  onClick,
}: {
  isPlaying: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      className="
        w-11 h-11 rounded-full bg-white text-black
        flex items-center justify-center
        hover:scale-105 active:scale-95
        transition-all duration-200 ease-out
        shadow-lg shadow-white/10
      "
    >
      {isPlaying ? (
        <Pause className="w-5 h-5 fill-current" />
      ) : (
        <Play className="w-5 h-5 fill-current ml-0.5" />
      )}
    </button>
  );
});

/* ─── Download Button ─── */

const DownloadBtn = memo(function DownloadBtn({ track }: { track: Track }) {
  const downloadTrack = useDownloadStore((s) => s.downloadTrack);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const deleteDownload = useDownloadStore((s) => s.deleteDownload);
  const entries = useDownloadStore((s) => s.entries);

  const entry = track ? entries.get(track.id) : undefined;
  const isDownloading = entry?.status === 'downloading';
  const isDownloaded = entry?.status === 'completed';
  const { addToast } = useUIStore.getState();

  const handleClick = useCallback(() => {
    if (!track || !track.youtubeId) {
      addToast('No video source available for download', 'error');
      return;
    }
    if (isDownloaded) {
      deleteDownload(track.id);
      addToast('Download removed', 'info');
    } else if (isDownloading) {
      cancelDownload(track.id);
      addToast('Download cancelled', 'info');
    } else {
      downloadTrack(track);
    }
  }, [track, isDownloaded, isDownloading, downloadTrack, cancelDownload, deleteDownload, addToast]);

  const label = isDownloaded ? 'Remove download' : isDownloading ? 'Cancel download' : 'Download';
  const disabled = !track?.youtubeId && !isDownloaded && !isDownloading;

  return (
    <CtrlButton
      onClick={handleClick}
      label={label}
      active={isDownloaded}
      accent
      className={isDownloading ? 'pointer-events-auto' : ''}
    >
      {isDownloading ? (
        <Loader2 className="w-4 h-4 animate-spin text-mac-accent" />
      ) : isDownloaded ? (
        <Check className="w-4 h-4 text-mac-green fill-current" />
      ) : (
        <Download className={`w-4 h-4 ${disabled ? 'opacity-30' : ''}`} />
      )}
    </CtrlButton>
  );
});

/* ─── Main Component ─── */

export const FloatingPlayer = memo(function FloatingPlayer() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const seek = usePlayerStore((s) => s.seek);
  const setFullPlayerOpen = usePlayerStore((s) => s.setFullPlayerOpen);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  const isQueueOpen = useUIStore((s) => s.isQueueOpen);
  const toggleQueue = useUIStore((s) => s.toggleQueue);
  const isLyricsOpen = useUIStore((s) => s.isLyricsOpen);
  const toggleLyrics = useUIStore((s) => s.toggleLyrics);

  const tracks = useLibraryStore((s) => s.tracks);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const isFavorite = currentTrack
    ? tracks.find((t) => t.id === currentTrack.id)?.isFavorite
    : false;

  const [isHovered, setIsHovered] = useState(false);

  if (!currentTrack) return null;

  const percent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(720px,calc(100vw-48px))]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Main bar ── */}
      <div
        className="
          glass-popover rounded-3xl
          flex flex-col
          shadow-mac-xl
          transition-all duration-300 ease-out
          group
        "
      >
        {/* ── Controls row ── */}
        <div className="flex items-center gap-0 px-2 pt-2 pb-1">
          {/* ── Left: Art + Info ── */}
          <div className="flex items-center gap-3 min-w-0 flex-1 pl-1">
            {/* Album Art — square with rounded corners */}
            <button
              onClick={() => setFullPlayerOpen(true)}
              className="
                relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0
                group/art
                transition-all duration-300 ease-out
                hover:scale-105 hover:shadow-lg hover:shadow-black/30
                active:scale-95
                ring-1 ring-white/10
              "
              aria-label="Open full player"
            >
              {currentTrack.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <Music className="w-6 h-6 text-white/40" />
                </div>
              )}
              {/* Hover overlay */}
              <div className="
                absolute inset-0 bg-black/50 backdrop-blur-sm
                flex items-center justify-center
                opacity-0 group-hover/art:opacity-100
                transition-opacity duration-200
              ">
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </button>

            {/* Track Info */}
            <div className="flex flex-col min-w-0 gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-mac-headline text-white truncate">
                  {currentTrack.title}
                </span>
                {isPlaying && <Equalizer />}
              </div>
              <span className="text-mac-caption text-mac-tertiary truncate">
                {currentTrack.artist}
              </span>
            </div>
          </div>

          {/* ── Center: Transport Controls ── */}
          <div className="flex items-center gap-1">
            <CtrlButton
              onClick={toggleShuffle}
              label={isShuffle ? 'Shuffle on' : 'Shuffle off'}
              active={isShuffle}
            >
              <Shuffle className="w-4 h-4" />
            </CtrlButton>

            <CtrlButton onClick={previousTrack} label="Previous track">
              <SkipBack className="w-4 h-4 fill-current" />
            </CtrlButton>

            <PlayButton isPlaying={isPlaying} onClick={togglePlay} />

            <CtrlButton onClick={nextTrack} label="Next track">
              <SkipForward className="w-4 h-4 fill-current" />
            </CtrlButton>

            <CtrlButton
              onClick={cycleRepeat}
              label={`Repeat ${repeatMode === 'one' ? 'one' : repeatMode === 'all' ? 'all' : 'off'}`}
              active={repeatMode !== 'off'}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </CtrlButton>
          </div>

          {/* ── Right: Secondary Controls ── */}
          <div className={`
            flex items-center gap-0.5
            transition-all duration-300 ease-out
            overflow-hidden
            ${isHovered ? 'opacity-100 max-w-[260px]' : 'opacity-0 max-w-0 pointer-events-none'}
          `}>
            {/* Separator */}
            <div className="w-px h-5 bg-white/10 mx-1 flex-shrink-0" />

            {/* Favorite */}
            <CtrlButton
              onClick={() => { if (currentTrack) toggleFavorite(currentTrack.id); }}
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              active={isFavorite}
              accent
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </CtrlButton>

            {/* Download */}
            <DownloadBtn track={currentTrack} />

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol-wrap">
              <CtrlButton
                onClick={toggleMute}
                label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </CtrlButton>
              <div className={`
                transition-all duration-300 ease-out
                ${isHovered ? 'w-20 opacity-100' : 'w-0 opacity-0'}
              `}>
                <VolumeSlider volume={isMuted ? 0 : volume} onChange={setVolume} />
              </div>
            </div>

            {/* Separator */}
            <div className="w-px h-5 bg-white/10 mx-1 flex-shrink-0" />

            {/* Queue */}
            <CtrlButton
              onClick={toggleQueue}
              label={isQueueOpen ? 'Close queue' : 'Open queue'}
              active={isQueueOpen}
            >
              <ListMusic className="w-4 h-4" />
            </CtrlButton>

            {/* Lyrics */}
            <CtrlButton
              onClick={toggleLyrics}
              label={isLyricsOpen ? 'Close lyrics' : 'Open lyrics'}
              active={isLyricsOpen}
            >
              <Mic2 className="w-4 h-4" />
            </CtrlButton>
          </div>
        </div>

        {/* ── Progress bar at bottom of bar ── */}
        <div className="px-3 pb-2.5">
          <ProgressBarInline progress={progress} duration={duration} onSeek={seek} />
        </div>
      </div>
    </div>
  );
});

/* ─── Inline Progress Bar (full-width, above the bar) ─── */

const ProgressBarInline = memo(function ProgressBarInline({
  progress,
  duration,
  onSeek,
}: {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
}) {
  const percent = duration > 0 ? (progress / duration) * 100 : 0;
  const trackRef = useRef<HTMLDivElement>(null);

  const commitSeek = useCallback(
    (fraction: number) => {
      onSeek(fraction * duration);
    },
    [duration, onSeek],
  );

  const { onPointerDown, onPointerMove, onPointerUp } = useSliderDrag(trackRef, commitSeek);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-white/40 w-8 text-right tabular-nums select-none font-mono">
        {formatTime(progress)}
      </span>

      <div
        ref={trackRef}
        className="flex-1 h-5 flex items-center touch-none cursor-pointer group/pbar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        tabIndex={0}
      >
        <div className="w-full h-1 bg-white/10 rounded-full relative overflow-visible">
          {/* Fill */}
          <div
            className="h-full bg-white/70 rounded-full relative transition-[width] duration-75"
            style={{ width: `${percent}%` }}
          >
            {/* Glow */}
            <div className="absolute inset-0 rounded-full bg-white/20 blur-sm" />
          </div>
          {/* Thumb */}
          <div
            className="
              absolute top-1/2 -translate-y-1/2 -translate-x-1/2
              w-3 h-3 bg-white rounded-full shadow-md
              opacity-0 group-hover/pbar:opacity-100
              transition-opacity duration-200
              pointer-events-none
            "
            style={{ left: `${percent}%` }}
          />
        </div>
      </div>

      <span className="text-[10px] text-white/40 w-8 tabular-nums select-none font-mono">
        {formatTime(duration)}
      </span>
    </div>
  );
});
