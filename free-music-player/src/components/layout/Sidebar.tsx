import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { Plus, Play, Heart, ListMusic } from 'lucide-react';
import { ipc } from '@/utils/ipc';
import type { Track } from '@/types';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'library', label: 'Your Library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
];

/** Deterministic gradient palette keyed by a simple hash of the playlist id */
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
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function playlistGradient(id: string) {
  return GRADIENT_PRESETS[hashId(id) % GRADIENT_PRESETS.length];
}

export function Sidebar() {
  const { currentPage, setPage, openModal, setSelectedPlaylistId } = useUIStore(
    useShallow((s) => ({ currentPage: s.currentPage, setPage: s.setPage, openModal: s.openModal, setSelectedPlaylistId: s.setSelectedPlaylistId })),
  );
  const tracks = useLibraryStore((s) => s.tracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists);
  const playTracks = usePlayerStore((s) => s.playTracks);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handlePlaylistClick = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setPage('playlist');
  };

  const handlePlayPlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const tracks: Track[] = await ipc.playlist.getPlaylistTracks(playlistId);
      if (tracks.length > 0) playTracks(tracks);
    } catch (err) {
      console.error('Failed to play playlist:', err);
    }
  };

  const likedCount = tracks.filter((t) => t.isFavorite).length;

  return (
    <aside className="w-60 bg-[#0a0a0a] border-r border-white/5 flex flex-col h-full">
      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
              currentPage === item.id
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-white/5" />

      {/* Playlists */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Playlists</h3>
          <button
            onClick={() => openModal('import')}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors duration-150"
            title="Import playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-0.5">
          {/* Liked Songs — special entry */}
          <SidebarPlaylistItem
            name="Liked Songs"
            count={likedCount}
            onClick={() => {
              setSelectedPlaylistId('__liked__');
              setPage('playlist');
            }}
            onPlay={(e) => {
              e.stopPropagation();
              const favs = tracks.filter((t) => t.isFavorite);
              if (favs.length > 0) playTracks(favs);
            }}
            isLiked
          />

          {/* User playlists */}
          {playlists.map((pl) => (
            <SidebarPlaylistItem
              key={pl.id}
              name={pl.name}
              count={pl.trackCount ?? 0}
              thumbnail={pl.thumbnail}
              id={pl.id}
              onClick={() => handlePlaylistClick(pl.id)}
              onPlay={(e) => handlePlayPlaylist(pl.id, e)}
            />
          ))}
        </div>
      </div>

      {/* Import hint */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={() => openModal('import')}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-xs text-white/40 hover:text-white/70 transition-all duration-150"
          type="button"
        >
          <Plus className="w-3.5 h-3.5" />
          Import playlist
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  SidebarPlaylistItem                                                */
/* ------------------------------------------------------------------ */

interface SidebarPlaylistItemProps {
  name: string;
  count: number;
  thumbnail?: string;
  id?: string;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
  isLiked?: boolean;
}

function SidebarPlaylistItem({
  name,
  count,
  thumbnail,
  id,
  onClick,
  onPlay,
  isLiked,
}: SidebarPlaylistItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors duration-150 group"
    >
      {/* 64px thumbnail */}
      <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
        {isLiked ? (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center">
            <Heart className="w-7 h-7 text-white fill-white" />
          </div>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${playlistGradient(id ?? name)} flex items-center justify-center`}>
            <ListMusic className="w-6 h-6 text-white/60" />
          </div>
        )}

        {/* Hover overlay with play button */}
        <div
          className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-150 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={onPlay}
            className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors duration-150"
          >
            <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
          </button>
        </div>
      </div>

      {/* Text */}
      <div className="text-left min-w-0 flex-1">
        <div className="text-sm truncate leading-snug">{name}</div>
        <div className="text-xs text-white/30 truncate mt-0.5">
          Playlist · {count} {count === 1 ? 'song' : 'songs'}
        </div>
      </div>
    </button>
  );
}
