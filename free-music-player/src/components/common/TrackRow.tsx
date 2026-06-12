import { useState, useCallback, memo } from 'react';
import {
  Play,
  Heart,
  Download,
  GripVertical,
  X,
  ListPlus,
  SkipForward,
} from 'lucide-react';
import type { Track } from '@/types';
import { thumbGradient, thumbLetter } from '@/utils/thumb';
import { ContextMenu } from '@/components/common/ContextMenu';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface TrackRowProps {
  track: Track;
  index: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay: () => void;
  onRemove?: (trackId: string) => void;
  onAddToQueue?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onRemoveFromQueue?: (track: Track) => void;
  onToggleFavorite?: () => void;
  onDownload?: (e: React.MouseEvent) => void;
  isDownloaded?: boolean;
  isDownloading?: boolean;
  isInQueue?: boolean;
  isFavorite?: boolean;
  showArtist?: boolean;
  showAlbum?: boolean;
  showDuration?: boolean;
  showIndex?: boolean;
  canReorder?: boolean;
  dragOverlay?: boolean;
  size?: 'sm' | 'md' | 'lg';

  /** Download metadata shown below the artist (for the Downloaded tab). */
  downloadMeta?: string;

  /** Callback for drag events — the parent handles state. */
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  dragIndex?: number | null;
  dragOverIndex?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Equalizer bars (playing indicator)                                 */
/* ------------------------------------------------------------------ */

function EqualizerBars({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-end gap-[2px] h-3 ${className}`}>
      <span className="w-[2.5px] bg-accent rounded-full animate-equalizer" style={{ animationDelay: '0s' }} />
      <span className="w-[2.5px] bg-accent rounded-full animate-equalizer" style={{ animationDelay: '0.2s' }} />
      <span className="w-[2.5px] bg-accent rounded-full animate-equalizer" style={{ animationDelay: '0.4s' }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

/* ------------------------------------------------------------------ */
/*  TrackRow — memoized to prevent re-renders on queue/index changes   */
/* ------------------------------------------------------------------ */

export const TrackRow = memo(function TrackRow({
  track,
  index,
  isActive = false,
  isPlaying = false,
  onPlay,
  onRemove,
  onAddToQueue,
  onPlayNext,
  onRemoveFromQueue,
  onToggleFavorite,
  onDownload,
  isDownloaded = false,
  isDownloading = false,
  isInQueue = false,
  isFavorite,
  showArtist = true,
  showAlbum = false,
  showDuration = true,
  showIndex = true,
  canReorder = false,
  dragOverlay = false,
  size = 'md',
  downloadMeta,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragIndex,
  dragOverIndex,
}: TrackRowProps) {
  const [hovered, setHovered] = useState(false);

  const trackFavorite = isFavorite ?? track.isFavorite;

  const handleFavoriteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFavorite?.();
    },
    [onToggleFavorite],
  );

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.(track.id);
    },
    [onRemove, track.id],
  );

  /* ── Determine what the number column shows ─────────────────────── */
  const showGrip = canReorder && hovered;
  const showPlayOnHover = !canReorder && hovered && !showGrip;
  const showEqualizer = isActive && isPlaying;

  /* ── Drag styling ───────────────────────────────────────────────── */
  const isDragged = dragIndex === index;
  const isDragOver = dragOverIndex === index;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canReorder}
      onDragStart={(e) => onDragStart?.(e, index)}
      onDragOver={(e) => onDragOver?.(e, index)}
      onDrop={(e) => onDrop?.(e, index)}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (dragIndex == null) onPlay();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && dragIndex == null) {
          e.preventDefault();
          onPlay();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`track-row group h-10 px-3 py-2 flex items-center gap-3 rounded-radius-sm ${
        canReorder ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragged ? 'opacity-40' : ''} ${
        isActive
          ? 'bg-accent/[0.06] border-l-2 border-accent'
          : 'border-l-2 border-transparent'
      } ${
        hovered && !isActive ? 'bg-dark-quinary' : ''
      } ${
        isDragOver
          ? 'relative before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-green-500 before:z-10'
          : ''
      } ${dragOverlay ? 'glass-content rounded-radius-sm shadow-lg shadow-black/30' : ''}`}
      style={{
        animationDelay: dragOverlay ? undefined : `${Math.min(index * 16, 300)}ms`,
      }}
    >
      {/* ── Number / Play / Equalizer / Drag handle ─────────────── */}
      {showIndex && (
        <span className="track-number w-7 text-mac-caption text-label-dark-quaternary text-right tabular-nums font-mono flex items-center justify-end flex-shrink-0">
          {showEqualizer ? (
            <EqualizerBars />
          ) : showGrip ? (
            <GripVertical className="w-4 h-4 text-white/40" />
          ) : showPlayOnHover ? (
            <Play className="w-4 h-4 text-white fill-white" />
          ) : (
            <span className={isActive ? 'text-accent' : 'text-label-dark-quaternary'}>
              {index + 1}
            </span>
          )}
        </span>
      )}

      {/* ── Thumbnail ──────────────────────────────────────────── */}
      <div className="w-6 h-6 rounded-radius-sm bg-white/[0.06] flex-shrink-0 overflow-hidden ring-1 ring-white/[0.04]">
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = (
                e.currentTarget as HTMLImageElement
              ).src.replace('maxresdefault', 'hqdefault');
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: thumbGradient(track.id) }}
          >
            <span className="text-white/30 font-bold text-xs select-none">
              {thumbLetter(track.title)}
            </span>
          </div>
        )}
      </div>

      {/* ── Title + Artist ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 text-left">
        <div
          className={`text-mac-body truncate leading-tight ${
            isActive ? 'text-accent' : 'text-label-dark-primary'
          }`}
        >
          {track.title}
        </div>
        {(showArtist || showAlbum) && (
          <div className="text-mac-subhead text-label-dark-tertiary truncate mt-0.5 leading-tight">
            {showArtist && track.artist}
            {showArtist && showAlbum && track.album ? ' \u00b7 ' : ''}
            {showAlbum && track.album}
            {downloadMeta && (
              <span className="ml-1.5 text-label-dark-quaternary">
                {'\u00b7'} {downloadMeta}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Duration ───────────────────────────────────────────── */}
      {showDuration && (
        <span className="text-mac-caption text-label-dark-quaternary tabular-nums font-mono w-14 text-right flex-shrink-0">
          {formatDuration(track.duration || 0)}
        </span>
      )}

      {/* ── Action buttons ─────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {hovered ? (
          <>
            {/* Favorite */}
            {onToggleFavorite && (
              <button
                onClick={handleFavoriteClick}
                className="p-1.5 rounded-radius-sm hover:bg-white/[0.08] active:scale-95 transition-all duration-apple ease-apple"
                type="button"
                title={trackFavorite ? 'Unlike' : 'Like'}
              >
                <Heart
                  className={`w-4 h-4 transition-all duration-apple ${
                    trackFavorite
                      ? 'text-red-400 fill-current'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                />
              </button>
            )}

            {/* Download — only shown when onDownload is provided */}
            {onDownload && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(e);
                }}
                className="p-1.5 rounded-radius-sm hover:bg-white/[0.08] active:scale-95 transition-all duration-apple ease-apple"
                type="button"
                title={
                  isDownloading
                    ? 'Downloading...'
                    : isDownloaded
                      ? 'Remove download'
                      : 'Download'
                }
              >
                <Download
                  className={`w-4 h-4 transition-colors ${
                    isDownloading
                      ? 'text-white animate-pulse'
                      : isDownloaded
                        ? 'text-green-500'
                        : 'text-white/45 hover:text-white/70'
                  }`}
                />
              </button>
            )}

            {/* Context menu */}
            <ContextMenu
              title="More options"
              items={[
                {
                  label: 'Add to queue',
                  icon: <ListPlus className="w-4 h-4" />,
                  onSelect: () => onAddToQueue?.(track),
                  disabled: isInQueue,
                },
                {
                  label: 'Play next',
                  icon: <SkipForward className="w-4 h-4" />,
                  onSelect: () => onPlayNext?.(track),
                },
                ...(onRemoveFromQueue
                  ? [
                      {
                        label: 'Remove from queue',
                        icon: <X className="w-4 h-4" />,
                        onSelect: () => onRemoveFromQueue(track),
                        disabled: !isInQueue,
                        danger: true as const,
                        separatorAfter: true as const,
                      } as const,
                    ]
                  : []),
                {
                  label: trackFavorite ? 'Unlike' : 'Like',
                  icon: (
                    <Heart
                      className={`w-4 h-4 ${
                        trackFavorite ? 'text-red-400 fill-current' : ''
                      }`}
                    />
                  ),
                  onSelect: () => onToggleFavorite?.(),
                },
              ]}
            />
          </>
        ) : (
          <>
            {/* Idle state indicators */}
            {isDownloaded && (
              <Download className="w-4 h-4 text-green-500/60" />
            )}
            {trackFavorite && !isDownloaded && (
              <Heart className="w-4 h-4 text-red-400/50 fill-current" />
            )}
          </>
        )}
      </div>

      {/* ── Remove button (for Playlist context) ───────────────── */}
      {onRemove && (
        <button
          onClick={handleRemoveClick}
          className={`p-1.5 rounded-radius-sm flex-shrink-0 transition-opacity duration-apple ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
          type="button"
          title="Remove from playlist"
        >
          <X className="w-4 h-4 text-white/45 hover:text-red-400" />
        </button>
      )}
    </div>
  );
});
