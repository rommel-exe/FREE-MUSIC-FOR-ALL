import { memo, useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';
import type { Track } from '@/types';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Volume1, Heart, ListMusic, Music, Mic2,
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
    <div className="flex items-end gap-[2px] h-3.5 text-emerald">
      <motion.span
        className="w-[3px] rounded-full bg-current"
        animate={{ height: ['30%', '100%', '50%', '80%', '30%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        className="w-[3px] rounded-full bg-current"
        animate={{ height: ['60%', '30%', '100%', '40%', '60%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      />
      <motion.span
        className="w-[3px] rounded-full bg-current"
        animate={{ height: ['80%', '50%', '30%', '100%', '80%'] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      />
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
      className="w-16 h-1.5 bg-groove-600 rounded-full relative touch-none cursor-pointer group/vol"
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
        className="h-full bg-emerald rounded-full relative transition-[width] duration-100"
        style={{ width: `${percent}%` }}
      >
        {/* Thumb */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-groove-50 rounded-full shadow-md scale-0 group-hover/vol:scale-100 transition-transform duration-200" />
      </div>
      {/* Track highlight on hover */}
      <div className="absolute inset-0 rounded-full bg-groove-500/20 opacity-0 group-hover/vol:opacity-100 transition-opacity" />
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
        relative w-8 h-8 rounded-full flex items-center justify-center
        transition-all duration-apple ease-apple
        ${active
          ? 'text-emerald'
          : 'text-groove-300 hover:text-groove-100'
        }
        ${accent && active ? 'bg-emerald-subtle' : ''}
        hover:bg-groove-700 active:scale-90
        ${className}
      `}
    >
      {children}
      {active && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald shadow-emerald-glow" />
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
        w-9 h-9 rounded-full bg-emerald text-white
        flex items-center justify-center
        hover:bg-emerald-hover active:scale-95
        transition-all duration-apple ease-apple
        shadow-emerald-glow
      "
    >
      {isPlaying ? (
        <Pause className="w-4 h-4 fill-current" />
      ) : (
        <Play className="w-4 h-4 fill-current ml-0.5" />
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
        <Loader2 className="w-4 h-4 animate-spin text-emerald" />
      ) : isDownloaded ? (
        <Check className="w-4 h-4 text-emerald fill-current" />
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

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-[72px] bg-groove-900 border-t border-groove-700">
      {/* ── Progress bar — thin 2px line at the very top ── */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10">
        <ProgressBarInline progress={progress} duration={duration} onSeek={seek} />
      </div>

      {/* ── Main bar ── */}
      <div className="h-full px-4 flex items-center gap-0">
        {/* ── Left: Art + Info ── */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Album Art — 56×56 */}
          <button
            onClick={() => setFullPlayerOpen(true)}
            className="
              relative w-14 h-14 rounded-radius-sm overflow-hidden flex-shrink-0
              transition-all duration-apple ease-apple
              hover:scale-105 hover:shadow-lg hover:shadow-black/30
              active:scale-95
              ring-1 ring-groove-600
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
              <div className="w-full h-full bg-groove-700 flex items-center justify-center">
                <Music className="w-6 h-6 text-groove-400" />
              </div>
            )}
          </button>

          {/* Track Info */}
          <div className="flex flex-col min-w-0 gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-mac-headline text-groove-50 truncate">
                {currentTrack.title}
              </span>
              {isPlaying && <Equalizer />}
            </div>
            <span className="text-mac-body text-groove-300 truncate">
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
        <div className="flex items-center gap-0.5 flex-1 justify-end">
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

          {/* Separator */}
          <div className="w-px h-5 bg-groove-700 mx-1 flex-shrink-0" />

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
            <VolumeSlider volume={isMuted ? 0 : volume} onChange={setVolume} />
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-groove-700 mx-1 flex-shrink-0" />

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
    </div>
  );
});

/* ─── Inline Progress Bar (full-width, 2px height) ─── */

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
  const [scrubbing, setScrubbing] = useState(false);

  const commitSeek = useCallback(
    (fraction: number) => {
      onSeek(fraction * duration);
    },
    [duration, onSeek],
  );

  const { onPointerDown, onPointerMove, onPointerUp } = useSliderDrag(trackRef, commitSeek);

  return (
    <div
      ref={trackRef}
      className="w-full h-[2px] bg-groove-600 cursor-pointer group/pbar"
      onPointerDown={(e) => { setScrubbing(true); onPointerDown(e); }}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => { setScrubbing(false); onPointerUp(e); }}
      role="slider"
      aria-label="Playback progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      tabIndex={0}
    >
      {/* Fill — emerald */}
      <div
        className="h-full bg-emerald relative transition-[width] duration-75"
        style={{ width: `${percent}%` }}
      >
        {/* Thumb — visible on hover */}
        <div
          className="
            absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
            w-3 h-3 bg-groove-50 rounded-full
            opacity-0 group-hover/pbar:opacity-100
            transition-opacity duration-200
            pointer-events-none
            shadow-md
          "
        />
      </div>
    </div>
  );
});
