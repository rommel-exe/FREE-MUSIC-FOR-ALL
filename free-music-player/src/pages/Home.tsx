import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { Play, Pause, SkipBack, SkipForward, ChevronRight, Heart, Disc3, Search } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { mediaResolver } from '@/services/mediaResolver';
import type { Track } from '@/types';
import { thumbGradient, thumbLetter } from '@/utils/thumb';

/* ------------------------------------------------------------------ */
/*  Gradient palette for playlist cards without thumbnails              */
/* ------------------------------------------------------------------ */

const GRADIENT_PRESETS = [
  'from-violet-600 to-indigo-700',
  'from-pink-600 to-rose-700',
  'from-teal-500 to-emerald-600',
  'from-orange-500 to-red-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function playlistGradient(id: string) {
  return GRADIENT_PRESETS[hashId(id) % GRADIENT_PRESETS.length];
}

/* ------------------------------------------------------------------ */
/*  Scrollable row component                                           */
/* ------------------------------------------------------------------ */

function ScrollRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateScrollState); ro.disconnect(); };
  }, []);

  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <div className={`relative group/row ${className}`}>
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-groove-700 text-groove-200 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-150 ease-apple hover:scale-110 hover:bg-groove-600 active:scale-95 shadow-warm-md"
          type="button"
          aria-label="Scroll left"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
      )}
      <div ref={ref} className="flex gap-3 overflow-x-auto overflow-y-hidden scroll-smooth pb-2 scrollbar-hide overscroll-contain" style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-groove-700 text-groove-200 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-150 ease-apple hover:scale-110 hover:bg-groove-600 active:scale-95 shadow-warm-md"
          type="button"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Now Playing Hero                                                   */
/* ------------------------------------------------------------------ */

function NowPlayingHero() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const seek = usePlayerStore((s) => s.seek);

  if (!currentTrack) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    seek(pct * duration);
  };

  return (
    <div className="mb-8 flex flex-col items-center text-center">
      {/* Album art */}
      <div className="w-[200px] h-[200px] rounded-radius-lg shadow-warm-lg overflow-hidden mb-6">
        {currentTrack.thumbnail ? (
          <img
            src={currentTrack.thumbnail}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: thumbGradient(currentTrack.id) }}
          >
            <span className="text-white/30 font-bold text-4xl select-none">
              {thumbLetter(currentTrack.title)}
            </span>
          </div>
        )}
      </div>

      {/* Track info */}
      <h2 className="text-mac-hero text-groove-50 tracking-tight mb-1 max-w-md truncate">
        {currentTrack.title}
      </h2>
      <p className="text-mac-headline text-groove-300 mb-5 max-w-sm truncate">
        {currentTrack.artist}
      </p>

      {/* Progress bar */}
      <div
        className="w-full max-w-md h-[3px] bg-groove-600 rounded-full cursor-pointer mb-5 group/progress"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-emerald rounded-full transition-[width] duration-200 relative"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-warm-sm" />
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={previousTrack}
          className="text-groove-300 hover:text-groove-50 transition-colors active:scale-90"
          type="button"
          aria-label="Previous track"
        >
          <SkipBack className="w-6 h-6 fill-current" />
        </button>

        <button
          onClick={togglePlay}
          className="w-14 h-14 rounded-full bg-emerald flex items-center justify-center hover:bg-emerald-hover active:bg-emerald-active transition-all shadow-emerald-glow active:scale-95"
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white fill-white" />
          ) : (
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          )}
        </button>

        <button
          onClick={nextTrack}
          className="text-groove-300 hover:text-groove-50 transition-colors active:scale-90"
          type="button"
          aria-label="Next track"
        >
          <SkipForward className="w-6 h-6 fill-current" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Square card (for Recently Played, Playlists)                       */
/* ------------------------------------------------------------------ */

function SquareCard({
  thumbnail,
  title,
  subtitle,
  gradient,
  onClick,
  variant = 'default',
}: {
  thumbnail?: string;
  title: string;
  subtitle?: string;
  gradient?: string;
  onClick?: () => void;
  onPlay?: () => void;
  variant?: 'default' | 'liked';
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex-shrink-0 w-[160px] text-left cursor-pointer active:scale-[0.97] transition-all duration-150 ease-apple group/card"
    >
      <div className="relative w-[160px] h-[160px] rounded-radius-md overflow-hidden mb-2.5 shadow-warm-sm group-hover/card:shadow-warm-md transition-shadow duration-200 group-hover/card:scale-[1.02]">
        {variant === 'liked' ? (
          <div className="w-full h-full bg-gradient-to-br from-groove-600 via-groove-500 to-groove-700 flex items-center justify-center">
            <Heart className="w-10 h-10 text-emerald fill-emerald/80" />
          </div>
        ) : thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : gradient ? (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-white/40 font-bold text-2xl select-none">{thumbLetter(title)}</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: thumbGradient(title) }}>
            <span className="text-white/30 font-bold text-2xl select-none">{thumbLetter(title)}</span>
          </div>
        )}

        {/* Hover play button overlay */}
        <div
          className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-all duration-200 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-full bg-emerald text-white flex items-center justify-center shadow-warm-lg transition-all duration-150 ease-out ${
              hovered ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-90'
            }`}
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0 px-0.5">
        <div className="text-sm font-semibold text-groove-100 truncate leading-snug">{title}</div>
        {subtitle && <div className="text-xs text-groove-300 truncate mt-0.5">{subtitle}</div>}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Top Song row (clean numbered list)                                 */
/* ------------------------------------------------------------------ */

function TopSongRow({
  track,
  index,
  isActive,
  onPlay,
}: {
  track: Track;
  index: number;
  isActive: boolean;
  onPlay: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-radius-sm transition-all duration-150 ease-apple group ${
        isActive
          ? 'bg-emerald-subtle'
          : 'hover:bg-groove-700'
      }`}
    >
      {/* Number / Play icon */}
      <span className={`w-7 text-center text-sm tabular-nums shrink-0 font-mono ${
        isActive ? 'text-emerald' : hovered ? 'text-emerald' : 'text-groove-400'
      }`}>
        {hovered ? (
          <Play className="w-4 h-4 inline fill-current" />
        ) : (
          index + 1
        )}
      </span>

      {/* Thumbnail (48px) */}
      <div className="w-12 h-12 rounded-radius-sm bg-groove-700 flex-shrink-0 overflow-hidden shadow-sm">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: thumbGradient(track.id) }}>
            <span className="text-white/30 font-bold text-lg select-none">{thumbLetter(track.title)}</span>
          </div>
        )}
      </div>

      {/* Title + Artist */}
      <div className="flex-1 min-w-0 text-left">
        <div className={`text-sm font-medium truncate leading-snug ${isActive ? 'text-emerald' : 'text-groove-100'}`}>
          {track.title}
        </div>
        <div className="text-xs text-groove-300 truncate">{track.artist}</div>
      </div>

      {/* Play count */}
      <span className="text-xs text-groove-400 tabular-nums shrink-0 font-mono">
        {track.playCount.toLocaleString()} plays
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Section header                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, showAll, onShowAll }: { title: string; showAll?: boolean; onShowAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-mac-title text-groove-50 tracking-tight">{title}</h2>
      {showAll && (
        <button onClick={onShowAll} className="flex items-center gap-2 rounded-radius-sm hover:bg-groove-700 px-2 py-1.5 transition-all duration-150 text-mac-caption uppercase tracking-widest font-semibold text-groove-300 hover:text-groove-100" type="button">
          Show all
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Home page                                                          */
/* ------------------------------------------------------------------ */

export function HomePage() {
  const tracks = useLibraryStore((s) => s.tracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const setPage = useUIStore((s) => s.setPage);
  const setSelectedPlaylistId = useUIStore((s) => s.setSelectedPlaylistId);

  // Load recently played on mount
  const loadRecentlyPlayed = useLibraryStore((s) => s.loadRecentlyPlayed);
  useEffect(() => {
    loadRecentlyPlayed();
  }, [loadRecentlyPlayed]);

  // Pick the best data sources
  const recentTracks = useMemo(() => {
    if (recentlyPlayed.length > 0) return recentlyPlayed.slice(0, 10);
    return [...tracks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [tracks, recentlyPlayed]);

  const topTracks = useMemo(
    () => [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 10),
    [tracks],
  );

  const jumpBackTracks = useMemo(() => {
    return recentlyPlayed.slice(1, 6);
  }, [recentlyPlayed]);

  const isEmpty = tracks.length === 0;

  // Pre-resolve visible tracks so clicking them is instant
  useEffect(() => {
    if (tracks.length === 0) return;
    const ids: string[] = [];
    for (const t of recentTracks.slice(0, 6)) if (t.youtubeId) ids.push(t.youtubeId);
    for (const t of topTracks) if (t.youtubeId && !ids.includes(t.youtubeId)) ids.push(t.youtubeId);
    if (ids.length > 0) mediaResolver.prefetchBatch(ids.slice(0, 10));
  }, [recentTracks, topTracks, tracks.length]);

  return (
    <div className="h-full overflow-y-auto overscroll-contain relative z-10 pb-32">
      {/* ── Header ── */}
      <div className="relative z-10 px-6 pt-14 pb-2 drag-region">
        <h1 className="text-mac-hero text-groove-50 tracking-tight no-drag">
          Listen Now
        </h1>
        <p className="text-mac-subhead text-groove-400 mt-1 no-drag">
          Discover your next favorite track
        </p>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 px-6 animate-fade-in">
        {/* ── Now Playing Hero ── */}
        {currentTrack && <NowPlayingHero />}

        {/* ── Sections ── */}
        <div className="space-y-8 pb-8">
          {/* Recently Played → 4-column grid */}
          {recentTracks.length > 0 && (
            <section>
              <SectionHeader title="Recently played" />
              <div className="grid grid-cols-4 gap-3">
                {recentTracks.slice(0, 8).map((track, i) => (
                  <button
                    key={track.id}
                    onClick={() => playTracks(recentTracks, i)}
                    className="group/card"
                  >
                    <div className="relative w-full aspect-square rounded-radius-md overflow-hidden mb-2 shadow-warm-sm group-hover/card:shadow-warm-md transition-all duration-200 group-hover/card:scale-[1.02]">
                      {track.thumbnail ? (
                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: thumbGradient(track.id) }}>
                          <span className="text-white/30 font-bold text-2xl select-none">{thumbLetter(track.title)}</span>
                        </div>
                      )}

                      {/* Hover play overlay */}
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
                        <div className="w-11 h-11 rounded-full bg-emerald text-white flex items-center justify-center shadow-warm-lg translate-y-2 group-hover/card:translate-y-0 opacity-0 group-hover/card:opacity-100 transition-all duration-200">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 px-0.5">
                      <div className="text-sm font-semibold text-groove-100 truncate leading-snug">{track.title}</div>
                      <div className="text-xs text-groove-300 truncate mt-0.5">{track.artist}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Your Playlists → Horizontal scroll with larger cards */}
          {playlists.length > 0 && (
            <section>
              <SectionHeader title="Your playlists" showAll onShowAll={() => setPage('library')} />
              <ScrollRow>
                <button
                  className="flex-shrink-0 text-left cursor-pointer active:scale-[0.97] transition-all duration-150 ease-apple group/card"
                  onClick={() => {
                    setSelectedPlaylistId('__liked__');
                    setPage('playlist');
                  }}
                >
                  <div className="w-[120px] h-[120px] rounded-radius-md overflow-hidden mb-2 shadow-warm-sm group-hover/card:shadow-warm-md transition-shadow duration-200">
                    <div className="w-full h-full bg-gradient-to-br from-groove-600 via-groove-500 to-groove-700 flex items-center justify-center">
                      <Heart className="w-8 h-8 text-emerald fill-emerald/80" />
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-groove-100 truncate max-w-[120px]">Liked Songs</div>
                  <div className="text-xs text-groove-300 truncate max-w-[120px]">{tracks.filter((t) => t.isFavorite).length} songs</div>
                </button>

                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    className="flex-shrink-0 text-left cursor-pointer active:scale-[0.97] transition-all duration-150 ease-apple group/card"
                    onClick={() => {
                      setSelectedPlaylistId(pl.id);
                      setPage('playlist');
                    }}
                  >
                    <div className="w-[120px] h-[120px] rounded-radius-md overflow-hidden mb-2 shadow-warm-sm group-hover/card:shadow-warm-md transition-shadow duration-200">
                      {pl.thumbnail ? (
                        <img src={pl.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${playlistGradient(pl.id)} flex items-center justify-center`}>
                          <span className="text-white/40 font-bold text-xl select-none">{thumbLetter(pl.name)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-groove-100 truncate max-w-[120px]">{pl.name}</div>
                    <div className="text-xs text-groove-300 truncate max-w-[120px]">{pl.trackCount ?? 0} songs</div>
                  </button>
                ))}
              </ScrollRow>
            </section>
          )}

          {/* Your Top Songs → Clean numbered list */}
          {topTracks.length > 0 && (
            <section>
              <SectionHeader title="Your top songs" />
              <div className="space-y-0.5">
                {topTracks.map((track, i) => (
                  <TopSongRow
                    key={track.id}
                    track={track}
                    index={i}
                    isActive={currentTrack?.id === track.id}
                    onPlay={() => playTracks(topTracks, i)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Empty state ── */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-8">
                <div className="w-28 h-28 rounded-radius-xl bg-groove-700 flex items-center justify-center border border-groove-600/50">
                  <Disc3 className="w-12 h-12 text-groove-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald/20 flex items-center justify-center">
                  <Play className="w-3 h-3 text-emerald fill-emerald" />
                </div>
              </div>
              <h2 className="text-mac-headline text-groove-100 mb-2">Start listening</h2>
              <p className="text-mac-body text-groove-300 mb-8 max-w-xs leading-relaxed">
                Search for songs to build your library and discover new music you&apos;ll love
              </p>
              <button
                onClick={() => setPage('search')}
                className="flex items-center gap-2 rounded-full bg-emerald text-white text-sm font-semibold px-8 py-3 hover:bg-emerald-hover active:bg-emerald-active transition-all duration-150 shadow-emerald-glow active:scale-[0.97]"
              >
                <Search className="w-4 h-4" />
                Search Music
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
