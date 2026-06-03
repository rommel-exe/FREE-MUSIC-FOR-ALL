import React, { useState, useMemo } from 'react';
import { Search, Grid, List, ArrowUpDown, Music } from 'lucide-react';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { TrackItem } from '@/components/common/TrackItem';
import { EmptyState } from '@/components/common/EmptyState';
import { TrackSkeleton } from '@/components/common/Skeleton';
import { Input } from '@/components/common/Input';

export function LibraryPage() {
  const {
    tracks, searchQuery, sortBy, sortOrder, loading,
    loadTracks, setSearchQuery, setSortBy, toggleSortOrder, getFilteredTracks, toggleFavorite,
  } = useLibraryStore();
  const { playTracks } = usePlayerStore();
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  React.useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  const filteredTracks = useMemo(() => getFilteredTracks(), [tracks, searchQuery, sortBy, sortOrder]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-mac-title-1 text-surface-50">Library</h1>
          <span className="text-[13px] text-surface-400">{filteredTracks.length} tracks</span>
        </div>

        <div className="flex items-center gap-2">
          <Input
            icon={<Search size={14} />}
            placeholder="Search your library..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="flex-1"
          />
          <div className="flex glass-control rounded-mac-sm overflow-hidden">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-r border-mac-separator px-2.5 py-1 text-[13px] text-surface-300 focus:outline-none cursor-pointer"
            >
              <option value="createdAt">Date Added</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
              <option value="playCount">Most Played</option>
            </select>
            <button
              type="button"
              onClick={toggleSortOrder}
              className="px-2 py-1 text-surface-400 hover:text-surface-100 transition-colors duration-150 cursor-pointer"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="p-1.5 glass-control rounded-mac-sm text-surface-400 hover:text-surface-100 transition-colors duration-150 cursor-pointer"
          >
            {viewMode === 'list' ? <Grid size={14} /> : <List size={14} />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {loading ? (
          <TrackSkeleton count={8} />
        ) : filteredTracks.length === 0 ? (
          <EmptyState
            icon={<Music size={28} />}
            title={searchQuery ? 'No matching tracks' : 'Your library is empty'}
            description={searchQuery ? 'Try a different search term' : 'Search YouTube to add music'}
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-0.5">
            {filteredTracks.map((track, index) => (
              <TrackItem
                key={track.id}
                track={track}
                index={index}
                showIndex
                showAlbum
                onPlay={(t) => playTracks(filteredTracks, index)}
                onFavorite={(t) => toggleFavorite(t.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {filteredTracks.map((track, index) => (
              <div key={track.id} className="cursor-pointer group" onClick={() => playTracks(filteredTracks, index)}>
                <div className="aspect-square rounded-mac overflow-hidden bg-surface-700 mb-2">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><span className="text-2xl text-surface-500">♪</span></div>
                  )}
                </div>
                <p className="text-[13px] text-surface-100 truncate">{track.title}</p>
                <p className="text-[11px] text-surface-400 truncate">{track.artist}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
