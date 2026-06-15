import { useEffect, useMemo, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import {
  Home,
  Search,
  Library,
  Plus,
  Play,
  Heart,
  ListMusic,
  Download,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { ipc } from '@/utils/ipc';
import { useUpdateStore } from '@/store/updateStore';
import type { Track } from '@/types';

/* ─── Navigation ─────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'library', label: 'Your Library', Icon: Library },
  { id: 'downloads', label: 'Downloads', Icon: Download },
] as const;

/* ─── Gradient Helpers ───────────────────────────────────────────────── */

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

/* ─── Sidebar ────────────────────────────────────────────────────────── */

export function Sidebar() {
  const { currentPage, setPage, openModal, setSelectedPlaylistId } = useUIStore(
    useShallow((s) => ({
      currentPage: s.currentPage,
      setPage: s.setPage,
      openModal: s.openModal,
      setSelectedPlaylistId: s.setSelectedPlaylistId,
    })),
  );

  const tracks = useLibraryStore((s) => s.tracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists);
  const playTracks = usePlayerStore((s) => s.playTracks);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handlePlaylistClick = useCallback(
    (playlistId: string) => {
      setSelectedPlaylistId(playlistId);
      setPage('playlist');
    },
    [setSelectedPlaylistId, setPage],
  );

  const handlePlayPlaylist = useCallback(
    async (playlistId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const tracks: Track[] = await ipc.playlist.getPlaylistTracks(playlistId);
        if (tracks.length > 0) playTracks(tracks);
      } catch (err) {
        console.error('Failed to play playlist:', err);
      }
    },
    [playTracks],
  );

  const likedCount = tracks.filter((t) => t.isFavorite).length;

  const downloadedTracks = useMemo(
    () => tracks.filter((t) => Boolean(t.path) && t.source === 'local'),
    [tracks],
  );
  const downloadedCount = downloadedTracks.length;

  return (
    <aside className="w-60 glass-sidebar flex flex-col h-full pt-12 drag-region relative z-20">
      {/* ── Navigation ── */}
      <nav className="px-2 pt-1 pb-2 space-y-0.5 no-drag">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = currentPage === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`
                w-full flex items-center gap-3 px-3 py-[7px] rounded-radius-sm
                text-mac-body font-medium transition-colors duration-150
                group relative active:scale-[0.98]
                ${isActive
                  ? 'text-emerald bg-emerald-subtle'
                  : 'text-groove-300 hover:text-groove-100 hover:bg-groove-700'
                }
              `}
            >
              <Icon
                className={`w-[18px] h-[18px] flex-shrink-0 transition-colors duration-150 ${
                  isActive ? 'text-emerald' : 'text-groove-400 group-hover:text-groove-200'
                }`}
                strokeWidth={1.8}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Divider ── */}
      <div className="mx-4 border-t border-groove-500/30" />

      {/* ── Playlists ── */}
      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-2 no-drag scrollbar-thin">
        {/* Header row */}
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-[11px] font-semibold text-groove-400 uppercase tracking-widest select-none">
            Playlists
          </h3>
          <button
            onClick={() => openModal('import')}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-groove-700 text-groove-400 hover:text-groove-200 transition-colors duration-150"
            title="Import playlist"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-px">
          {/* Liked Songs — special entry */}
          <SidebarPlaylistItem
            name="Liked Songs"
            count={likedCount}
            isLiked
            onClick={() => {
              setSelectedPlaylistId('__liked__');
              setPage('playlist');
            }}
            onPlay={(e) => {
              e.stopPropagation();
              const favs = tracks.filter((t) => t.isFavorite);
              if (favs.length > 0) playTracks(favs);
            }}
          />

          {/* Downloaded — special entry */}
          <SidebarPlaylistItem
            name="Downloaded"
            count={downloadedCount}
            isDownloaded
            onClick={() => {
              setPage('downloads');
            }}
            onPlay={(e) => {
              e.stopPropagation();
              if (downloadedTracks.length > 0) playTracks(downloadedTracks);
            }}
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

      {/* ── Footer Buttons ── */}
      <div className="p-3 border-t border-groove-500/30 no-drag space-y-2">
        <button
          onClick={() => openModal('import')}
          className="
            w-full flex items-center justify-center gap-2
            py-2 px-3 rounded-radius-sm
            bg-groove-700 hover:bg-groove-600
            border border-groove-500/30 hover:border-groove-500/50
            text-mac-body text-groove-300 hover:text-groove-100
            transition-all duration-200
            active:scale-[0.98]
          "
          type="button"
        >
          <Plus className="w-3.5 h-3.5 text-emerald" strokeWidth={2} />
          Import playlist
        </button>

        <button
          onClick={() => useUpdateStore.getState().checkForUpdates()}
          className="
            w-full flex items-center justify-center gap-2
            py-2 px-3 rounded-radius-sm
            bg-groove-700/50 hover:bg-groove-600/80
            border border-groove-500/20 hover:border-groove-500/40
            text-mac-body text-groove-400 hover:text-groove-200
            transition-all duration-200
            active:scale-[0.98]
          "
          type="button"
        >
          <RefreshCw className="w-3.5 h-3.5 text-groove-400" strokeWidth={2} />
          Check for updates
        </button>
      </div>
    </aside>
  );
}

/* ─── SidebarPlaylistItem ────────────────────────────────────────────── */

interface SidebarPlaylistItemProps {
  name: string;
  count: number;
  thumbnail?: string;
  id?: string;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
  isLiked?: boolean;
  isDownloaded?: boolean;
}

function SidebarPlaylistItem({
  name,
  count,
  thumbnail,
  id,
  onClick,
  onPlay,
  isLiked,
  isDownloaded,
}: SidebarPlaylistItemProps) {
  return (
    <button
      onClick={onClick}
      className="
        w-full flex items-center gap-3 px-2 py-[6px] rounded-radius-sm
        text-groove-200 hover:text-groove-100
        transition-colors duration-150 group relative
        hover:bg-groove-700 active:scale-[0.98]
      "
    >
      {/* ── Thumbnail ── */}
      <div className="relative w-11 h-11 rounded-[6px] overflow-hidden flex-shrink-0">
        {isLiked ? (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white fill-white" strokeWidth={0} />
          </div>
        ) : isDownloaded ? (
          <div className="w-full h-full bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 flex items-center justify-center">
            <Download className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
        ) : thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${playlistGradient(id ?? name)} flex items-center justify-center`}
          >
            <ListMusic className="w-5 h-5 text-white/50" strokeWidth={1.5} />
          </div>
        )}

        {/* ── Hover play overlay (CSS opacity) ── */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
          <button
            onClick={onPlay}
            className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-100"
          >
            <Play className="w-3 h-3 text-white fill-white ml-[1px]" strokeWidth={0} />
          </button>
        </div>
      </div>

      {/* ── Text ── */}
      <div className="text-left min-w-0 flex-1">
        <div className="text-[13px] leading-snug truncate">{name}</div>
        <div className="text-[11px] text-groove-400 truncate mt-px">
          Playlist · {count} {count === 1 ? 'song' : 'songs'}
        </div>
      </div>

      {/* ── Delete button (hover reveal via CSS) ── */}
      {!isLiked && !isDownloaded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Delete logic would go here
          }}
          className="
            absolute right-2 p-1 rounded
            hover:bg-groove-600 text-groove-400 hover:text-danger
            transition-all duration-100
            opacity-0 group-hover:opacity-100
          "
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      )}
    </button>
  );
}
