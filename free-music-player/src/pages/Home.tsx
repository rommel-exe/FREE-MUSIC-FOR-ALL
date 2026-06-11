import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { Play, ChevronRight, Heart, Sparkles, Search } from 'lucide-react';
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
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass-elevated flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-mac ease-mac hover:scale-110 active:scale-95 shadow-mac-lg"
          type="button"
          aria-label="Scroll left"
        >
          <ChevronRight className="w-4 h-4 text-white/80 rotate-180" />
        </button>
      )}
      <div ref={ref} className="flex gap-3 overflow-x-auto overflow-y-hidden scroll-smooth pb-2 scrollbar-hide overscroll-contain" style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full glass-elevated flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-mac ease-mac hover:scale-110 active:scale-95 shadow-mac-lg"
          type="button"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4 text-white/80" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Square card (for Recently Played, Playlists, Jump Back In)         */
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
      className="flex-shrink-0 w-[180px] glass-card rounded-mac-lg p-3 group/card text-left cursor-pointer active:scale-[0.97] transition-all duration-mac ease-mac"
    >
      <div className="relative w-full aspect-square rounded-mac overflow-hidden mb-3 shadow-mac-lg">
        {variant === 'liked' ? (
          <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 flex items-center justify-center">
            <Heart className="w-10 h-10 text-white fill-white/80" />
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
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end justify-end p-2.5 transition-all duration-300 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full bg-mac-accent-green text-black flex items-center justify-center shadow-xl shadow-black/40 transition-all duration-mac ease-mac-bounce ${
              hovered ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-90'
            }`}
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-white truncate leading-snug">{title}</div>
        {subtitle && <div className="text-xs text-mac-tertiary truncate mt-1">{subtitle}</div>}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Top Song row (horizontal, with thumbnail)                          */
/* ------------------------------------------------------------------ */

function TopSongRow({
  track,
  index,
  onPlay,
}: {
  track: Track;
  index: number;
  onPlay: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-4 px-3 py-2.5 rounded-mac hover:bg-white/[0.04] transition-all duration-mac ease-mac group"
    >
      {/* Number / Play icon */}
      <span className="w-7 text-center text-sm tabular-nums shrink-0 font-mono">
        {hovered ? (
          <Play className="w-4 h-4 text-mac-accent-green inline fill-mac-accent-green" />
        ) : (
          <span className="text-mac-quaternary">{index + 1}</span>
        )}
      </span>

      {/* Thumbnail (48px) */}
      <div className="w-12 h-12 rounded-mac-sm bg-white/10 flex-shrink-0 overflow-hidden shadow-sm shadow-black/20">
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
        <div className="text-sm font-medium text-white truncate leading-snug">{track.title}</div>
        <div className="text-xs text-mac-tertiary truncate">{track.artist}</div>
      </div>

      {/* Play count */}
      <span className="text-xs text-mac-quaternary tabular-nums shrink-0 font-mono">
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
      <h2 className="text-mac-title-2 text-white tracking-tight">{title}</h2>
      {showAll && (
        <button onClick={onShowAll} className="mac-button-ghost text-mac-caption uppercase tracking-widest font-semibold hover:text-white/80" type="button">
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
      {/* ── Gradient hero background ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 right-0 h-[420px] bg-gradient-to-b from-[#2a1545]/50 via-[#1a0f30]/30 to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-mac-blue/5 rounded-full blur-[120px]" />
        <div className="absolute top-20 right-1/4 w-72 h-72 bg-mac-purple/5 rounded-full blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 px-mac-xl pt-14 pb-2 drag-region">
        <h1 className="text-mac-large-title text-white/90 tracking-tight no-drag">
          Listen Now
        </h1>
        <p className="text-mac-footnote text-white/30 mt-1 no-drag">
          Discover your next favorite track
        </p>
      </div>

      {/* ── Main content (CSS entrance animation) ── */}
      <div className="relative z-10 px-mac-xl animate-fade-in">
        {/* ── Quick-play grid (2x3) ── */}
        {recentTracks.length > 0 && (
          <div className="mb-mac-2xl">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {recentTracks.slice(0, 6).map((track, i) => (
                <button
                  key={track.id}
                  onClick={() => playTracks(recentTracks, i)}
                  className="flex items-center gap-0 glass-card rounded-mac overflow-hidden h-[52px] group/quick hover:bg-white/[0.08] active:scale-[0.98] transition-all duration-mac ease-mac"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-13 h-13 flex-shrink-0 overflow-hidden shadow-sm shadow-black/20">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: thumbGradient(track.id) }}>
                        <span className="text-white/30 font-bold text-lg select-none">{thumbLetter(track.title)}</span>
                      </div>
                    )}
                  </div>
                  <span className="flex-1 px-3.5 text-sm font-semibold text-white truncate text-left">
                    {track.title}
                  </span>
                  <div className="pr-3 opacity-0 group-hover/quick:opacity-100 transition-all duration-mac ease-mac group-hover/quick:translate-x-0 -translate-x-1">
                    <div className="w-9 h-9 rounded-full bg-mac-accent-green text-black flex items-center justify-center shadow-lg shadow-black/30">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Sections ── */}
        <div className="space-y-mac-2xl pb-8">
          {/* Recently Played */}
          {recentTracks.length > 0 && (
            <section>
              <SectionHeader title="Recently played" />
              <ScrollRow>
                {recentTracks.map((track, i) => (
                  <SquareCard
                    key={track.id}
                    thumbnail={track.thumbnail}
                    title={track.title}
                    subtitle={track.artist}
                    onClick={() => playTracks(recentTracks, i)}
                    onPlay={() => playTracks(recentTracks, i)}
                  />
                ))}
              </ScrollRow>
            </section>
          )}

          {/* Your Playlists */}
          {playlists.length > 0 && (
            <section>
              <SectionHeader title="Your playlists" showAll onShowAll={() => setPage('library')} />
              <ScrollRow>
                <SquareCard
                  title="Liked Songs"
                  subtitle={`${tracks.filter((t) => t.isFavorite).length} songs`}
                  variant="liked"
                  onClick={() => {
                    setSelectedPlaylistId('__liked__');
                    setPage('playlist');
                  }}
                />
                {playlists.map((pl) => (
                  <SquareCard
                    key={pl.id}
                    thumbnail={pl.thumbnail}
                    title={pl.name}
                    subtitle={`${pl.trackCount ?? 0} songs`}
                    gradient={playlistGradient(pl.id)}
                    onClick={() => {
                      setSelectedPlaylistId(pl.id);
                      setPage('playlist');
                    }}
                  />
                ))}
              </ScrollRow>
            </section>
          )}

          {/* Jump Back In */}
          {jumpBackTracks.length > 0 && (
            <section>
              <SectionHeader title="Jump back in" />
              <ScrollRow>
                {jumpBackTracks.map((track, i) => (
                  <SquareCard
                    key={`jb-${track.id}`}
                    thumbnail={track.thumbnail}
                    title={track.title}
                    subtitle={track.artist}
                    onClick={() => playTracks(jumpBackTracks, i)}
                    onPlay={() => playTracks(jumpBackTracks, i)}
                  />
                ))}
              </ScrollRow>
            </section>
          )}

          {/* Your Top Songs */}
          {topTracks.length > 0 && (
            <section>
              <SectionHeader title="Your top songs" />
              <div className="glass-card rounded-mac-lg p-2">
                {topTracks.map((track, i) => (
                  <TopSongRow
                    key={track.id}
                    track={track}
                    index={i}
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
                <div className="w-28 h-28 rounded-mac-2xl bg-gradient-to-br from-mac-blue/20 via-mac-purple/20 to-mac-accent-green/10 flex items-center justify-center border border-white/[0.06]">
                  <Sparkles className="w-12 h-12 text-mac-blue/60" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-mac-accent-green/20 flex items-center justify-center">
                  <Play className="w-3 h-3 text-mac-accent-green fill-mac-accent-green" />
                </div>
              </div>
              <h2 className="text-mac-title-1 text-white mb-2">Start listening</h2>
              <p className="text-mac-body text-mac-tertiary mb-8 max-w-xs leading-relaxed">
                Search for songs to build your library and discover new music you&apos;ll love
              </p>
              <button
                onClick={() => setPage('search')}
                className="mac-button-primary rounded-full px-8 py-3 shadow-mac-sm text-sm font-semibold active:scale-[0.97] transition-transform duration-mac"
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
