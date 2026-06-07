import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { ipc } from '@/utils/ipc';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { queryEngine } from '@/engine/queryEngine';
import type { Track } from '@/types';
import { Search, Music, Clock, Disc3, ListMusic } from 'lucide-react';

interface SearchPageProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

// Debounce hook
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
}: {
  result: Track;
  index: number;
  onPlay: (result: Track, index: number) => void;
}) {
  return (
    <button
      onClick={() => onPlay(result, index)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 transition-colors group"
      type="button"
    >
      <div className="w-12 h-12 rounded-md bg-white/10 flex-shrink-0 overflow-hidden">
        {result.thumbnail ? (
          <img src={result.thumbnail} alt={result.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-5 h-5 text-white/25" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-white truncate">{result.title}</div>
        <div className="text-xs text-white/50 truncate">{result.artist}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/30 tabular-nums">
          {Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}
        </span>
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 shadow-lg shadow-green-500/20">
          <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
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
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef || internalRef;
  const playTracks = usePlayerStore((s) => s.playTracks);
  const addTrack = useLibraryStore((s) => s.addTrack);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  // Debounced search
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) return;

    let cancelled = false;

    async function search() {
      setLoading(true);
      setSearched(true);
      try {
        const res = await queryEngine.search(debouncedQuery, 20);
        if (!cancelled) setResults(res);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    search();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handlePlay = useCallback(async (result: Track, index: number) => {
    await addTrack({
      title: result.title,
      artist: result.artist,
      duration: result.duration,
      thumbnail: result.thumbnail,
      youtubeId: result.youtubeId,
      source: 'youtube',
    });

    playTracks(results, index);
  }, [results, playTracks, addTrack]);

  const handleGenreClick = (genre: string) => {
    setQuery(genre);
    inputRef.current?.focus();
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Search header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-xl p-6 pb-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/10 rounded-full text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 focus:bg-white/[0.12] transition-all duration-200"
          />
        </div>
      </div>

      <div className="px-6 pb-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
              <Search className="w-7 h-7 text-white/20" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1.5">No results found</h3>
            <p className="text-sm text-white/40 max-w-sm">
              We couldn't find anything for &quot;{query}&quot;. Try different keywords or check the spelling.
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-white mb-3">Songs</h3>
            <div className="space-y-0.5">
              {results.map((result, i) => (
                <SearchResultItem key={result.id} result={result} index={i} onPlay={handlePlay} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state — genre tiles */}
        {!searched && !loading && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Browse all</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {GENRE_TILES.map((genre) => (
                <button
                  key={genre.label}
                  onClick={() => handleGenreClick(genre.label)}
                  className="relative overflow-hidden rounded-lg h-28 text-left p-4 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150"
                  type="button"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${genre.color}`} />
                  <div className="relative z-10">
                    <span className="text-lg font-bold text-white">{genre.label}</span>
                  </div>
                  {/* Decorative rotated rectangle */}
                  <div className="absolute -bottom-2 -right-4 w-20 h-20 rounded-md bg-black/10 rotate-[25deg]" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
