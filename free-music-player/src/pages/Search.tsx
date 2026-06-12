import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useDownloadStore } from '@/store/downloadStore';
import { queryEngine } from '@/engine/queryEngine';
import { mediaResolver } from '@/services/mediaResolver';
import type { Track } from '@/types';
import { Search, Play, Disc3 } from 'lucide-react';
import { thumbGradient, thumbLetter } from '@/utils/thumb';
import { AnimatePresence, motion } from 'framer-motion';
import { SkeletonSearchResults } from '@/components/common/Skeleton';

interface SearchPageProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/* ------------------------------------------------------------------ */
/*  Debounce hook                                                      */
/* ------------------------------------------------------------------ */

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* ------------------------------------------------------------------ */
/*  Genre / mood tiles                                                  */
/* ------------------------------------------------------------------ */

const GENRE_TILES = [
  { label: 'Pop', color: '#3d2c2c' },
  { label: 'Hip Hop', color: '#3d352c' },
  { label: 'Rock', color: '#3d2c2c' },
  { label: 'R&B', color: '#2c2c3d' },
  { label: 'Electronic', color: '#2c3535' },
  { label: 'Classical', color: '#35302c' },
  { label: 'Jazz', color: '#3d352c' },
  { label: 'Latin', color: '#2c352c' },
  { label: 'Country', color: '#3d352c' },
  { label: 'Indie', color: '#2c3530' },
  { label: 'K-Pop', color: '#352c35' },
  { label: 'Podcasts', color: '#2c3035' },
];

const MOOD_PILLS = ['Chill', 'Energetic', 'Focus', 'Happy', 'Workout'];

/* ------------------------------------------------------------------ */
/*  Search result item                                                  */
/* ------------------------------------------------------------------ */

const SearchResultItem = memo(function SearchResultItem({
  result,
  index,
  onPlay,
  onDownload,
  isDownloaded,
  isDownloading,
  isActive,
}: {
  result: Track;
  index: number;
  onPlay: (result: Track, index: number) => void;
  onDownload?: (e: React.MouseEvent) => void;
  isDownloaded?: boolean;
  isDownloading?: boolean;
  isActive?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onPlay(result, index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-radius-sm transition-all duration-150 ease-apple group ${
        isActive ? 'bg-emerald-subtle border-l-2 border-emerald' : 'hover:bg-groove-700 border-l-2 border-transparent'
      }`}
      type="button"
    >
      {/* Thumbnail (48px) */}
      <div className="w-12 h-12 rounded-radius-sm bg-groove-700 flex-shrink-0 overflow-hidden shadow-sm">
        {result.thumbnail ? (
          <img
            src={result.thumbnail}
            alt={result.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: thumbGradient(result.id) }}>
            <span className="text-white/30 font-bold text-sm select-none">{thumbLetter(result.title)}</span>
          </div>
        )}
      </div>

      {/* Title + Artist */}
      <div className="flex-1 min-w-0 text-left">
        <div className={`text-sm font-medium truncate leading-snug ${isActive ? 'text-emerald' : 'text-groove-100'}`}>
          {result.title}
        </div>
        <div className="text-xs text-groove-300 truncate">{result.artist}</div>
      </div>

      {/* Duration */}
      <span className="text-mac-caption text-groove-400 tabular-nums font-mono shrink-0">
        {Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}
      </span>

      {/* Download button */}
      {onDownload && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(e); }}
          className="p-1.5 rounded-radius-sm hover:bg-groove-600 active:scale-95 transition-all duration-150 opacity-0 group-hover:opacity-100 shrink-0"
          type="button"
          title={isDownloading ? 'Downloading...' : isDownloaded ? 'Remove download' : 'Download'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-colors ${
              isDownloading
                ? 'text-emerald animate-pulse'
                : isDownloaded
                  ? 'text-emerald'
                  : 'text-groove-400 hover:text-groove-200'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      )}

      {/* Play button */}
      <div className={`w-9 h-9 rounded-full bg-emerald text-white flex items-center justify-center transition-all duration-150 shrink-0 ${
        hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}>
        <Play className="w-4 h-4 fill-current ml-0.5" />
      </div>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  Search page                                                         */
/* ------------------------------------------------------------------ */

export function SearchPage({ inputRef: externalRef }: SearchPageProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef || internalRef;
  const playTracks = usePlayerStore((s) => s.playTracks);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const addTrack = useLibraryStore((s) => s.addTrack);
  const downloadEntries = useDownloadStore((s) => s.entries);
  const downloadTrack = useDownloadStore((s) => s.downloadTrack);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  // Debounced search
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    let cancelled = false;

    async function search() {
      setLoading(true);
      setSearched(true);
      try {
        const res = await queryEngine.search(debouncedQuery, 20);
        if (!cancelled) {
          setResults(res);
          // Pre-resolve first N results so clicking play is instant
          const ids = res.slice(0, 5).map(r => r.youtubeId).filter(Boolean) as string[];
          if (ids.length > 0) mediaResolver.prefetchBatch(ids);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    search();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handlePlay = useCallback(
    async (result: Track, index: number) => {
      await addTrack({
        title: result.title,
        artist: result.artist,
        duration: result.duration,
        thumbnail: result.thumbnail,
        youtubeId: result.youtubeId,
        source: 'youtube',
      });
      playTracks(results, index);
    },
    [results, playTracks, addTrack],
  );

  const handleGenreClick = (genre: string) => {
    setQuery(genre);
    inputRef.current?.focus();
  };

  const handleMoodClick = (mood: string) => {
    setQuery(mood);
    inputRef.current?.focus();
  };

  const hasResults = !loading && results.length > 0;
  const noResults = !loading && searched && results.length === 0;
  const showBrowse = !searched && !loading;

  return (
    <div className="h-full overflow-y-auto overscroll-contain relative z-10 pb-32">
      {/* ── Search input (pill) ──────────────────────────────────── */}
      <div className="px-6 pt-14 pb-4 drag-region">
        <div className="relative max-w-2xl no-drag">
          {/* Search icon */}
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-groove-400 pointer-events-none" />

          {/* Input — full-width pill */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="What do you want to hear?"
            className={`w-full h-12 pl-12 pr-12 rounded-full text-groove-50 placeholder-groove-400 text-sm font-medium transition-all duration-150 ease-apple outline-none bg-groove-700 border ${
              inputFocused
                ? 'border-emerald shadow-emerald-glow'
                : 'border-groove-500/30 hover:border-groove-500/50'
            }`}
          />

          {/* Clear button */}
          <AnimatePresence>
            {query.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-groove-600 flex items-center justify-center hover:bg-groove-500 transition-colors text-groove-300 hover:text-groove-100"
                type="button"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        {/* Loading state */}
        {loading && (
          <div className="py-6">
            <SkeletonSearchResults />
          </div>
        )}

        {/* No results */}
        {noResults && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-radius-xl bg-groove-700 flex items-center justify-center border border-groove-600/50">
                <Disc3 className="w-8 h-8 text-groove-400" />
              </div>
            </div>
            <h3 className="text-mac-headline text-groove-100 mb-1.5">No results found</h3>
            <p className="text-sm text-groove-300 max-w-sm leading-relaxed">
              We couldn&apos;t find anything for &quot;{query}&quot;. Try different keywords or check the spelling.
            </p>
          </div>
        )}

        {/* Search results — clean list */}
        {hasResults && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-mac-headline text-groove-50 tracking-tight">Songs</h3>
              <span className="text-mac-caption text-groove-400 tabular-nums">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-0.5">
              {results.map((result, i) => {
                const dlEntry = downloadEntries.get(result.id);
                const isResDownloaded = dlEntry?.status === 'completed';
                const isResDownloading = dlEntry?.status === 'downloading';
                const isActive = currentTrack?.id === result.id;
                return (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    index={i}
                    onPlay={handlePlay}
                    onDownload={(e) => {
                      if (isResDownloading) {
                        cancelDownload(result.id);
                      } else if (isResDownloaded) {
                        useDownloadStore.getState().deleteDownload(result.id);
                      } else {
                        downloadTrack(result);
                      }
                    }}
                    isDownloaded={isResDownloaded}
                    isDownloading={isResDownloading}
                    isActive={isActive}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Browse all / Genre tiles + Mood pills */}
        {showBrowse && (
          <div>
            {/* Genre tiles */}
            <div className="mb-8">
              <div className="mb-5">
                <h2 className="text-mac-title text-groove-50 tracking-tight">Browse all</h2>
                <p className="text-mac-body text-groove-300 mt-1">Explore by genre</p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {GENRE_TILES.map((genre) => (
                  <button
                    key={genre.label}
                    onClick={() => handleGenreClick(genre.label)}
                    className="relative overflow-hidden rounded-radius-md h-28 text-left p-4 group/tile transition-all duration-200 hover:shadow-warm-sm hover:brightness-110 active:scale-[0.97] transform-gpu"
                    style={{ backgroundColor: genre.color }}
                    type="button"
                  >
                    <span className="text-mac-title text-groove-50 relative z-10">{genre.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Browse by Mood */}
            <div>
              <div className="mb-5">
                <h2 className="text-mac-title text-groove-50 tracking-tight">Browse by mood</h2>
              </div>
              <div className="flex gap-2.5 flex-wrap">
                {MOOD_PILLS.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => handleMoodClick(mood)}
                    className="px-5 py-2.5 rounded-full bg-groove-700 text-groove-200 text-sm font-medium hover:bg-groove-600 transition-all duration-150 active:scale-95"
                    type="button"
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
