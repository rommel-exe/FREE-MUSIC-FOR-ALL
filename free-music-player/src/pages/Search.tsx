import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { ipc } from '@/utils/ipc';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { queryEngine } from '@/engine/queryEngine';
import type { SearchResult, Track } from '@/types';

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

// Memoized search result item
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
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors group"
    >
      <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 overflow-hidden">
        {result.thumbnail ? (
          <img src={result.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-white truncate">{result.title}</div>
        <div className="text-xs text-white/50 truncate">{result.artist}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/30 tabular-nums">
          {Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, '0')}
        </span>
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
});

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
      } catch (err) {
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

  return (
    <div className="h-full overflow-y-auto">
      {/* Search header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-xl p-6 pb-4">
        <div className="relative max-w-xl">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/10 rounded-full text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>

      <div className="px-6 pb-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-white/50">No results found for &quot;{query}&quot;</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-1">
            {results.map((result, i) => (
              <SearchResultItem key={result.id} result={result} index={i} onPlay={handlePlay} />
            ))}
          </div>
        )}

        {!searched && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-white/50">Search for songs, artists, or albums</p>
          </div>
        )}
      </div>
    </div>
  );
}
