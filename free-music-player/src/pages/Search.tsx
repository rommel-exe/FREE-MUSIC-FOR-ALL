import React, { useState, useCallback } from 'react';
import { Search as SearchIcon, Play, Plus, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { ipc } from '@/utils/ipc';
import { SearchResult } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { useDownloadStore } from '@/store/downloadStore';
import { Input } from '@/components/common/Input';
import { TrackSkeleton } from '@/components/common/Skeleton';
import { formatDuration } from '@/utils/formatters';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { playTrack, addToQueue } = usePlayerStore();
  const { addToast } = useUIStore();
  const { startDownload } = useDownloadStore();

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await ipc.search.searchYouTube(query.trim());
      setResults(res);
    } catch {
      addToast('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, addToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  const handlePlay = (result: SearchResult) => {
    const track = {
      id: result.id,
      title: result.title,
      artist: result.artist,
      album: '',
      duration: result.duration,
      thumbnail: result.thumbnail,
      path: '',
      youtubeId: result.id,
      source: 'youtube' as const,
      isFavorite: false,
      playCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    playTrack(track);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-5 pb-4 space-y-4">
        <h1 className="text-mac-title-1 text-surface-50">Search</h1>
        <div className="flex gap-2.5">
          <Input
            icon={<SearchIcon size={14} />}
            placeholder="Search YouTube for music..."
            value={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <button
            type="button"
            onClick={doSearch}
            disabled={loading || !query.trim()}
            className="h-7 px-5 bg-mac-blue hover:bg-[#0070E0] disabled:opacity-40 text-white rounded-mac-sm text-[13px] font-medium transition-colors duration-150 cursor-pointer"
          >
            Search
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <TrackSkeleton count={8} />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            {!searched ? (
              <>
                <div className="w-16 h-16 rounded-mac-lg bg-mac-fill/30 flex items-center justify-center mb-4">
                  <SearchIcon size={28} className="text-surface-500" />
                </div>
                <h3 className="text-[17px] font-semibold text-surface-300 mb-1">Search YouTube</h3>
                <p className="text-[13px] text-surface-500">Find any song and play it instantly</p>
              </>
            ) : (
              <>
                <h3 className="text-[17px] font-semibold text-surface-300 mb-1">No results found</h3>
                <p className="text-[13px] text-surface-500">Try a different search term</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center gap-3 p-2 rounded-mac-sm hover:bg-white/5 cursor-pointer group transition-colors duration-150"
              >
                <div
                  className="w-10 h-10 rounded-mac-sm overflow-hidden bg-surface-700 flex-shrink-0"
                  onClick={() => handlePlay(result)}
                >
                  {result.thumbnail ? (
                    <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-500">♪</div>
                  )}
                </div>

                <div className="flex-1 min-w-0" onClick={() => handlePlay(result)}>
                  <p className="text-[13px] font-medium text-surface-100 truncate group-hover:text-mac-blue transition-colors duration-150">
                    {result.title}
                  </p>
                  <p className="text-[11px] text-surface-400 truncate">{result.artist}</p>
                </div>

                <span className="text-[11px] text-surface-500 font-mono tabular-nums">{formatDuration(result.duration)}</span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePlay(result); }}
                    className="p-1.5 rounded-mac-sm bg-mac-blue hover:bg-[#0070E0] text-white transition-colors duration-150"
                  >
                    <Play size={12} fill="white" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); addToQueue({
                      id: result.id, title: result.title, artist: result.artist, album: '', duration: result.duration,
                      thumbnail: result.thumbnail, path: '', youtubeId: result.id, source: 'youtube',
                      isFavorite: false, playCount: 0, createdAt: '', updatedAt: '',
                    }); addToast('Added to queue'); }}
                    className="p-1.5 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-surface-100 transition-colors duration-150"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startDownload(result.id, result.title, result.artist, result.thumbnail); addToast('Download started'); }}
                    className="p-1.5 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-surface-100 transition-colors duration-150"
                  >
                    <Download size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
