import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useDownloadStore } from '@/store/downloadStore';
import { queryEngine } from '@/engine/queryEngine';
import { mediaResolver } from '@/services/mediaResolver';
import type { Track } from '@/types';
import { Search, Play, Download } from 'lucide-react';
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
  { label: 'Pop', color: 'from-pink-500 to-rose-600' },
  { label: 'Hip Hop', color: 'from-orange-500 to-amber-600' },
  { label: 'Rock', color: 'from-red-600 to-red-800' },
  { label: 'R&B', color: 'from-purple-500 to-indigo-600' },
  { label: 'Electronic', color: 'from-cyan-400 to-blue-600' },
  { label: 'Classical', color: 'from-slate-400 to-slate-600' },
  { label: 'Jazz', color: 'from-amber-600 to-yellow-700' },
  { label: 'Latin', color: 'from-green-500 to-emerald-600' },
  { label: 'Country', color: 'from-amber-500 to-orange-600' },
  { label: 'Indie', color: 'from-teal-400 to-cyan-600' },
  { label: 'K-Pop', color: 'from-violet-400 to-purple-600' },
  { label: 'Podcasts', color: 'from-sky-500 to-indigo-600' },
];

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
}: {
  result: Track;
  index: number;
  onPlay: (result: Track, index: number) => void;
  onDownload?: (e: React.MouseEvent) => void;
  isDownloaded?: boolean;
  isDownloading?: boolean;
}) {
  return (
    <button
      onClick={() => onPlay(result, index)}
      className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-mac hover:bg-white/[0.04] transition-all duration-mac ease-mac group"
      type="button"
    >
      {/* Thumbnail (44px rounded) */}
      <div className="w-11 h-11 rounded-mac-sm bg-white/10 flex-shrink-0 overflow-hidden shadow-sm shadow-black/20">
        {result.thumbnail ? (
          <img
            src={result.thumbnail}
            alt={result.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: thumbGradient(result.id) }}>
            <span className="text-white/30 font-bold text-base select-none">{thumbLetter(result.title)}</span>
          </div>
        )}
      </div>

      {/* Title + Artist */}
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-white truncate leading-snug">
          {result.title}
        </div>
        <div className="text-xs text-mac-tertiary truncate">{result.artist}</div>
      </div>

      {/* Download button */}
      {onDownload && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(e); }}
          className="mac-button-ghost p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-mac"
          type="button"
          title={isDownloading ? 'Downloading...' : isDownloaded ? 'Remove download' : 'Download'}
        >
          <Download
            className={`w-3.5 h-3.5 transition-colors ${
              isDownloading
                ? 'text-white animate-pulse'
                : isDownloaded
                  ? 'text-mac-green'
                  : 'text-white/45 hover:text-white/70'
            }`}
          />
        </button>
      )}

      {/* Duration (monospace) + Play button */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-mac-quaternary tabular-nums font-mono">
          {Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}
        </span>
        <div className="w-8 h-8 rounded-full bg-mac-accent-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-mac ease-mac shadow-lg shadow-mac-accent-green/25 scale-90 group-hover:scale-100">
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        </div>
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

  const hasResults = !loading && results.length > 0;
  const noResults = !loading && searched && results.length === 0;
  const showBrowse = !searched && !loading;

  return (
    <div className="h-full overflow-y-auto overscroll-contain relative z-10 pb-32">
      {/* ── Search header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-mac-bg-primary/80 backdrop-blur-xl px-mac-xl pt-14 pb-4 drag-region">
        {/* Page header */}
        <div className="no-drag">
          <div className="mb-3">
            <h1 className="text-mac-large-title text-white/90 tracking-tight">
              Search
            </h1>
            <p className="text-mac-footnote text-white/30 mt-1">
              Find music you love
            </p>
          </div>
        </div>

        <div className="relative max-w-2xl no-drag">
          {/* Search icon */}
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 pointer-events-none" />

          {/* Input — Spotlight-style */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="What do you want to listen to?"
            className={`w-full pl-12 pr-5 py-3.5 rounded-full text-white placeholder-white/30 text-sm font-medium transition-all duration-mac ease-mac outline-none ${
              inputFocused
                ? 'bg-white/[0.12] border border-mac-blue/40 shadow-mac-glow'
                : 'bg-white/[0.06] border border-transparent hover:bg-white/[0.08]'
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
                className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-white/50 hover:text-white/80"
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
      <div className="px-mac-xl pb-6">
        {/* Loading state */}
        {loading && (
          <div className="py-6">
            <SkeletonSearchResults />
          </div>
        )}

        {/* No results */}
        {noResults && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-mac-xl bg-gradient-to-br from-mac-tertiary/60 to-mac-quaternary/40 flex items-center justify-center border border-white/[0.06]">
                <Search className="w-8 h-8 text-white/20" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-mac-blue/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-mac-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h3 className="text-mac-headline text-white mb-1.5">No results found</h3>
            <p className="text-sm text-mac-tertiary max-w-sm leading-relaxed">
              We couldn&apos;t find anything for &quot;{query}&quot;. Try different keywords or check the spelling.
            </p>
          </div>
        )}

        {/* Search results */}
        {hasResults && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-mac-headline text-white tracking-tight">Songs</h3>
              <span className="text-mac-caption text-mac-quaternary tabular-nums">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="glass-card rounded-mac-lg p-2">
              {results.map((result, i) => {
                const dlEntry = downloadEntries.get(result.id);
                const isResDownloaded = dlEntry?.status === 'completed';
                const isResDownloading = dlEntry?.status === 'downloading';
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
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Browse all / Genre tiles */}
        {showBrowse && (
          <div>
            <div className="mb-6">
              <h2 className="text-mac-title-1 text-white tracking-tight">Browse all</h2>
              <p className="text-mac-body text-mac-tertiary mt-1">Explore by genre and mood</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {GENRE_TILES.map((genre) => (
                <button
                  key={genre.label}
                  onClick={() => handleGenreClick(genre.label)}
                  className="relative overflow-hidden rounded-mac-xl h-[140px] text-left p-5 group/tile transition-all duration-200 hover:shadow-lg hover:shadow-black/20 hover:scale-[1.03] active:scale-[0.97] transform-gpu"
                  type="button"
                >
                  {/* Background gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${genre.color}`} />

                  {/* Hover brightness overlay */}
                  <div className="absolute inset-0 bg-white/0 group-hover/tile:bg-white/[0.08] transition-colors duration-300" />

                  {/* Noise texture overlay */}
                  <div className="absolute inset-0 opacity-[0.08] mix-blend-overlay noise-texture" />

                  {/* Content */}
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <span className="text-xl font-bold text-white drop-shadow-sm">{genre.label}</span>
                  </div>

                  {/* Decorative rotated rectangle */}
                  <div className="absolute -bottom-3 -right-5 w-24 h-24 rounded-mac bg-black/10 rotate-[25deg] transition-transform duration-300 group-hover/tile:rotate-[30deg] group-hover/tile:scale-110" />

                  {/* Decorative circle */}
                  <div className="absolute top-3 right-4 w-3 h-3 rounded-full bg-white/15 transition-transform duration-300 group-hover/tile:scale-150" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
