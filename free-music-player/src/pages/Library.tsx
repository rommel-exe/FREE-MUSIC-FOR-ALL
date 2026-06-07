import { useShallow } from 'zustand/react/shallow';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useState } from 'react';
import { Play, Music, Heart, MoreHorizontal, Search } from 'lucide-react';
import type { Track } from '@/types';

type SortField = 'title' | 'artist' | 'createdAt' | 'playCount';
type TabFilter = 'all' | 'playlists' | 'artists' | 'albums' | 'liked';

const TAB_ITEMS: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'liked', label: 'Liked' },
];

export function LibraryPage() {
  const {
    tracks,
    favorites,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    toggleSortOrder,
    sortOrder,
    getFilteredTracks,
  } = useLibraryStore(
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
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const [tab, setTab] = useState<TabFilter>('all');

  const filteredTracks = tab === 'liked' ? favorites : getFilteredTracks();

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
      <div className="p-6 pb-3">
        <h1 className="text-3xl font-bold text-white mb-5 tracking-tight">Your Library</h1>

        {/* Tab chips */}
        <div className="flex items-center gap-2 mb-4">
          {TAB_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                tab === item.id
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
              type="button"
            >
              {item.label}
              <span className="ml-1.5 text-xs opacity-70">
                {item.id === 'liked' ? favorites.length : tracks.length}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Sort row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in library..."
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all duration-150"
            />
          </div>
          <div className="flex items-center gap-1">
            {([
              ['title', 'Title'],
              ['artist', 'Artist'],
              ['playCount', 'Plays'],
            ] as const).map(([field, label]) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  sortBy === field
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
                type="button"
              >
                {label}
                {sortBy === field && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="px-6 flex items-center gap-4 text-xs text-white/40 border-b border-white/5 pb-2.5 mx-6">
        <span className="w-8 text-right">#</span>
        <span className="flex-1 min-w-0">Title</span>
        <span className="w-32 hidden lg:block">Artist</span>
        <span className="w-16 text-right hidden sm:block">Duration</span>
        <span className="w-8" />
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
              <Music className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/50 font-medium">
              {searchQuery ? 'No songs match your search' : tab === 'liked' ? 'No liked songs yet' : 'Your library is empty'}
            </p>
            <p className="text-sm text-white/30 mt-1">
              {tab === 'liked' ? 'Heart a song to add it here' : 'Search for music to get started'}
            </p>
          </div>
        ) : (
          filteredTracks.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id;
            return (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                isCurrent={isCurrent}
                isPlaying={isPlaying}
                onPlay={() => playTracks(filteredTracks, i)}
                onToggleFavorite={() => toggleFavorite(track.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TrackRow                                                            */
/* ------------------------------------------------------------------ */

function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onToggleFavorite,
}: {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`w-full flex items-center gap-4 px-6 py-2 transition-colors group ${
        isCurrent ? 'bg-white/5' : 'hover:bg-white/5'
      }`}
      type="button"
    >
      {/* Number / Play / Playing indicator */}
      <span className="w-8 text-sm text-right tabular-nums">
        {isCurrent && isPlaying ? (
          <Music className="w-3.5 h-3.5 text-green-400 inline animate-pulse" />
        ) : hovered ? (
          <Play className="w-3.5 h-3.5 text-white inline fill-white" />
        ) : (
          <span className="text-white/30">{index + 1}</span>
        )}
      </span>

      {/* Thumbnail — 48px */}
      <div className="w-12 h-12 rounded-md bg-white/10 flex-shrink-0 overflow-hidden">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-5 h-5 text-white/20" />
          </div>
        )}
      </div>

      {/* Title + Artist */}
      <div className="flex-1 min-w-0 text-left">
        <div className={`text-sm font-medium truncate ${isCurrent ? 'text-green-400' : 'text-white'}`}>
          {track.title}
        </div>
        <div className="text-xs text-white/50 truncate">{track.artist}</div>
      </div>

      {/* Artist (desktop) */}
      <span className="w-32 text-sm text-white/50 truncate hidden lg:block">{track.artist}</span>

      {/* Duration */}
      <span className="w-16 text-sm text-white/30 text-right tabular-nums hidden sm:block">
        {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
      </span>

      {/* Actions on hover */}
      <div className="w-8 flex justify-end">
        {hovered ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              type="button"
              title={track.isFavorite ? 'Unlike' : 'Like'}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-colors ${
                  track.isFavorite ? 'text-green-400 fill-green-400' : 'text-white/50 hover:text-white'
                }`}
              />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              type="button"
              title="More options"
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>
        ) : track.isFavorite ? (
          <Heart className="w-3.5 h-3.5 text-green-400 fill-green-400" />
        ) : null}
      </div>
    </button>
  );
}
