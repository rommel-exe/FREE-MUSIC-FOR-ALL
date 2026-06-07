import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { Play, Music, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import type { Track, Playlist } from '@/types';

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
/*  Time-of-day greeting                                               */
/* ------------------------------------------------------------------ */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#1a1a1a] border border-white/10 shadow-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-[#222]"
            type="button"
            aria-label="Scroll left"
          >
          <ChevronRight className="w-4 h-4 text-white rotate-180" />
        </button>
      )}
      <div ref={ref} className="flex gap-4 overflow-x-auto overflow-y-hidden scroll-smooth pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#1a1a1a] border border-white/10 shadow-xl flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 hover:scale-110 hover:bg-[#222]"
          type="button"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4 text-white" />
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
  onPlay,
}: {
  thumbnail?: string;
  title: string;
  subtitle?: string;
  gradient?: string;
  onClick?: () => void;
  onPlay?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex-shrink-0 w-[180px] bg-[#141414] hover:bg-[#1c1c1c] rounded-lg p-3 transition-all duration-200 group/card text-left"
    >
      <div className="relative w-full aspect-square rounded-md overflow-hidden mb-3 shadow-lg shadow-black/30">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : gradient ? (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Music className="w-10 h-10 text-white/40" />
          </div>
        ) : (
          <div className="w-full h-full bg-white/10 flex items-center justify-center">
            <Music className="w-10 h-10 text-white/20" />
          </div>
        )}

        {/* Hover play button overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end justify-end p-2 transition-all duration-300 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-500/30 transition-all duration-300 ${
              hovered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
          >
            <Play className="w-5 h-5 text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-white truncate leading-snug">{title}</div>
        {subtitle && <div className="text-xs text-white/50 truncate mt-1">{subtitle}</div>}
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
      className="w-full flex items-center gap-4 px-3 py-2.5 rounded-md hover:bg-white/5 transition-colors group"
    >
      <span className="w-6 text-sm text-white/30 text-right tabular-nums">
        {hovered ? <Play className="w-3.5 h-3.5 text-white inline fill-white" /> : index + 1}
      </span>
      <div className="w-12 h-12 rounded-md bg-white/10 flex-shrink-0 overflow-hidden">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-5 h-5 text-white/20" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-white truncate">{track.title}</div>
        <div className="text-xs text-white/50 truncate">{track.artist}</div>
      </div>
      <span className="text-xs text-white/30 tabular-nums">{track.playCount} plays</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Section header                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, showAll, onShowAll }: { title: string; showAll?: boolean; onShowAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {showAll && (
        <button
          onClick={onShowAll}
          className="text-xs font-semibold text-white/50 hover:text-white uppercase tracking-wider transition-colors"
          type="button"
        >
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
    // Fallback: most recently created tracks
    return [...tracks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  }, [tracks, recentlyPlayed]);

  const topTracks = useMemo(
    () => [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 10),
    [tracks],
  );

  const jumpBackTracks = useMemo(() => {
    // Last few distinct tracks from recently played (skip first one which is "now playing")
    return recentlyPlayed.slice(1, 6);
  }, [recentlyPlayed]);

  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="h-full overflow-y-auto">
      {/* Gradient hero background */}
      <div className="relative">
        <div className="absolute inset-0 h-[340px] bg-gradient-to-b from-[#2a1545]/60 via-[#0f0f1a]/40 to-transparent pointer-events-none" />

        <div className="relative px-6 pt-8 pb-4">
          {/* Greeting */}
          <h1 className="text-3xl font-bold text-white mb-6 tracking-tight">{greeting}</h1>

          {/* Quick-play grid (2x3 like Spotify) */}
          {recentTracks.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-8">
              {recentTracks.slice(0, 6).map((track, i) => (
                <button
                  key={track.id}
                  onClick={() => playTracks(recentTracks, i)}
                  className="flex items-center gap-0 bg-white/[0.06] hover:bg-white/[0.12] rounded-md overflow-hidden transition-colors group/quick h-12"
                >
                  <div className="w-12 h-12 flex-shrink-0 overflow-hidden">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <Music className="w-4 h-4 text-white/30" />
                      </div>
                    )}
                  </div>
                  <span className="flex-1 px-3 text-sm font-semibold text-white truncate text-left">{track.title}</span>
                  <div className="pr-3 opacity-0 group-hover/quick:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
                      <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-8 space-y-10">
        {/* Recently Played — horizontal scroll cards */}
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
              {/* Liked Songs card */}
              <SquareCard
                title="Liked Songs"
                subtitle={`${tracks.filter((t) => t.isFavorite).length} songs`}
                gradient="from-purple-600 via-pink-500 to-rose-500"
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
            <div className="space-y-0.5">
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

        {/* Empty state */}
        {tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5">
              <Music className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Start listening</h2>
            <p className="text-white/50 mb-6 max-w-sm">Search for songs to build your library and discover new music</p>
            <button
              onClick={() => setPage('search')}
              className="px-8 py-3 bg-white text-black font-semibold rounded-full hover:scale-105 active:scale-95 transition-all duration-150 text-sm"
            >
              Search Music
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
