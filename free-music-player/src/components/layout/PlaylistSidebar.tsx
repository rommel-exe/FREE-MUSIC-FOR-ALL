import { useEffect, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { Plus, Play, Heart, Download, ListMusic, Trash2 } from 'lucide-react';
import { ipc } from '@/utils/ipc';
import type { Track } from '@/types';

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

/* ─── PlaylistSidebar ──────────────────────────────────────────────── */

export function PlaylistSidebar() {
  const { setPage, openModal, setSelectedPlaylistId, setLibraryTab } =
    useUIStore(
      useShallow((s) => ({
        setPage: s.setPage,
        openModal: s.openModal,
        setSelectedPlaylistId: s.setSelectedPlaylistId,
        setLibraryTab: s.setLibraryTab,
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
        const plTracks: Track[] = await ipc.playlist.getPlaylistTracks(playlistId);
        if (plTracks.length > 0) playTracks(plTracks);
      } catch (err) {
        console.error('Failed to play playlist:', err);
      }
    },
    [playTracks],
  );

  const likedCount = useMemo(() => tracks.filter((t) => t.isFavorite).length, [tracks]);

  const downloadedTracks = useMemo(
    () => tracks.filter((t) => Boolean(t.path) && t.source === 'local'),
    [tracks],
  );
  const downloadedCount = downloadedTracks.length;

  return (
    <aside className="w-[220px] h-full glass-sidebar flex flex-col pt-14 drag-region border-r border-white/[0.06] flex-shrink-0 relative z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 no-drag">
        <h3 className="text-[11px] font-semibold text-white/30 uppercase tracking-widest select-none">
          Playlists
        </h3>
        <button
          onClick={() => openModal('import')}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/25 hover:text-white/70 transition-colors duration-150"
          title="Import playlist"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Scrollable playlist list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 no-drag scrollbar-thin">
        <div className="space-y-px">
          {/* Liked Songs */}
          <DrawerPlaylistItem
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

          {/* Downloaded */}
          <DrawerPlaylistItem
            name="Downloaded"
            count={downloadedCount}
            isDownloaded
            onClick={() => {
              setLibraryTab('downloaded');
              setPage('library');
            }}
            onPlay={(e) => {
              e.stopPropagation();
              if (downloadedTracks.length > 0) playTracks(downloadedTracks);
            }}
          />

          {/* User playlists */}
          {playlists.map((pl) => (
            <DrawerPlaylistItem
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

      {/* Import button at bottom */}
      <div className="p-3 border-t border-white/[0.06] no-drag">
        <button
          onClick={() => openModal('import')}
          className="
            w-full flex items-center justify-center gap-2
            py-2 px-3 rounded-mac-sm
            bg-white/[0.04] hover:bg-white/[0.09]
            border border-white/[0.06] hover:border-white/[0.12]
            text-mac-footnote text-white/40 hover:text-white/70
            transition-all duration-200
            active:scale-[0.98]
          "
          type="button"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          Import playlist
        </button>
      </div>
    </aside>
  );
}

/* ─── DrawerPlaylistItem ─────────────────────────────────────────────── */

interface DrawerPlaylistItemProps {
  name: string;
  count: number;
  thumbnail?: string;
  id?: string;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
  isLiked?: boolean;
  isDownloaded?: boolean;
}

function DrawerPlaylistItem({
  name,
  count,
  thumbnail,
  id,
  onClick,
  onPlay,
  isLiked,
  isDownloaded,
}: DrawerPlaylistItemProps) {
  return (
    <button
      onClick={onClick}
      className="
        w-full flex items-center gap-3 px-2 py-[6px] rounded-mac-sm
        text-white/50 hover:text-white/80
        transition-colors duration-150 group relative
        hover:bg-white/[0.06] active:scale-[0.98]
      "
    >
      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded-[6px] overflow-hidden flex-shrink-0">
        {isLiked ? (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center">
            <Heart className="w-4 h-4 text-white fill-white" strokeWidth={0} />
          </div>
        ) : isDownloaded ? (
          <div className="w-full h-full bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 flex items-center justify-center">
            <Download className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
        ) : thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${playlistGradient(id ?? name)} flex items-center justify-center`}
          >
            <ListMusic className="w-4 h-4 text-white/50" strokeWidth={1.5} />
          </div>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
          <button
            onClick={onPlay}
            className="w-6 h-6 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 hover:scale-110 active:scale-95 transition-all duration-100"
          >
            <Play className="w-2.5 h-2.5 text-white fill-white ml-[1px]" strokeWidth={0} />
          </button>
        </div>
      </div>

      {/* Text */}
      <div className="text-left min-w-0 flex-1">
        <div className="text-[13px] leading-snug truncate">{name}</div>
        <div className="text-[11px] text-white/25 truncate mt-px">
          Playlist · {count} {count === 1 ? 'song' : 'songs'}
        </div>
      </div>

      {/* Delete button (hover reveal, not for Liked/Downloaded) */}
      {!isLiked && !isDownloaded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Delete logic would go here
          }}
          className="
            absolute right-2 p-1 rounded
            hover:bg-white/10 text-white/30 hover:text-mac-red
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
