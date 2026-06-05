import { useShallow } from 'zustand/react/shallow';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useState } from 'react';

type SortField = 'title' | 'artist' | 'createdAt' | 'playCount';

export function LibraryPage() {
  const { tracks, favorites, searchQuery, setSearchQuery, sortBy, setSortBy, toggleSortOrder, sortOrder, getFilteredTracks } = useLibraryStore(
    useShallow((s) => ({
      tracks: s.tracks,
      favorites: s.favorites,
      searchQuery: s.searchQuery,
      setSearchQuery: s.setSearchQuery,
      sortBy: s.sortBy,
      setSortBy: s.setSortBy,
      toggleSortOrder: s.toggleSortOrder,
      sortOrder: s.sortOrder,
      getFilteredTracks: s.getFilteredTracks,
    })),
  );
  const { playTracks, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      playTracks: s.playTracks,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    })),
  );
  const [tab, setTab] = useState<'all' | 'favorites'>('all');

  const filteredTracks = tab === 'favorites' ? favorites : getFilteredTracks();

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      toggleSortOrder();
    } else {
      setSortBy(field);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Your Library</h1>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === 'all' ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            All Songs ({tracks.length})
          </button>
          <button
            onClick={() => setTab('favorites')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === 'favorites' ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Liked ({favorites.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in library..."
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-md text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Sort headers */}
      <div className="px-6 flex items-center gap-4 text-xs text-white/40 border-b border-white/5 pb-2">
        <span className="w-8">#</span>
        <button onClick={() => handleSort('title')} className="flex-1 text-left hover:text-white/70 transition-colors">
          Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button onClick={() => handleSort('artist')} className="w-40 text-left hover:text-white/70 transition-colors">
          Artist {sortBy === 'artist' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button onClick={() => handleSort('playCount')} className="w-20 text-left hover:text-white/70 transition-colors">
          Plays {sortBy === 'playCount' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <span className="w-16 text-right">Duration</span>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-white/50">
              {searchQuery ? 'No songs match your search' : tab === 'favorites' ? 'No liked songs yet' : 'Your library is empty'}
            </p>
          </div>
        ) : (
          filteredTracks.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <button
                key={track.id}
                onClick={() => playTracks(filteredTracks, i)}
                className={`w-full flex items-center gap-4 px-6 py-2 hover:bg-white/5 transition-colors group ${
                  isCurrent ? 'bg-white/5' : ''
                }`}
              >
                <span className="w-8 text-sm text-white/30 text-right tabular-nums">
                  {isCurrent && isPlaying ? (
                    <svg className="w-4 h-4 text-green-400 inline" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="flex-1 min-w-0 text-left flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 overflow-hidden">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${isCurrent ? 'text-green-400' : 'text-white'}`}>
                      {track.title}
                    </div>
                    <div className="text-xs text-white/50 truncate">{track.artist}</div>
                  </div>
                </div>
                <span className="w-40 text-sm text-white/50 truncate">{track.artist}</span>
                <span className="w-20 text-sm text-white/30 tabular-nums">{track.playCount}</span>
                <span className="w-16 text-sm text-white/30 text-right tabular-nums">
                  {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
