import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import {
  Compass,
  ScanSearch,
  Disc3,
  ListMusic,
  Play,
  Heart,
  Download,
  Plus,
} from 'lucide-react';

/* ─── Navigation ─────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { id: 'home', label: 'Home', Icon: Compass },
  { id: 'search', label: 'Search', Icon: ScanSearch },
  { id: 'library', label: 'Library', Icon: Disc3 },
  { id: 'downloads', label: 'Downloads', Icon: Download },
] as const;

/* ─── Gradient Helpers ─────────────────────────────────────────────────── */

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

/* ─── CompactNav ─────────────────────────────────────────────────────── */

export function CompactNav() {
  const { currentPage, setPage, openModal, setSelectedPlaylistId, setLibraryTab } = useUIStore(
    useShallow((s) => ({
      currentPage: s.currentPage,
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

  const [showPlaylists, setShowPlaylists] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  /* ── Close popover on outside click ── */
  useEffect(() => {
    if (!showPlaylists) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPlaylists(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPlaylists]);

  const likedCount = tracks.filter((t) => t.isFavorite).length;
  const downloadedCount = tracks.filter((t) => Boolean(t.path) && t.source === 'local').length;

  return (
    <aside className="w-[72px] h-full glass-sidebar flex flex-col items-center pt-14 drag-region relative z-30">
      {/* ── Nav items + Playlist button ── */}
      <div className="flex flex-col items-center gap-1.5 no-drag">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = currentPage === id;
          return (
            <div key={id} className="relative group">
              <button
                onClick={() => setPage(id)}
                className={`
                  w-12 h-12 flex items-center justify-center rounded-mac
                  transition-all duration-mac ease-mac
                  group relative active:scale-[0.95]
                  ${isActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                  }
                `}
              >
                <Icon
                  className={`w-[22px] h-[22px] transition-colors duration-mac ${
                    isActive ? 'text-mac-blue' : ''
                  }`}
                  strokeWidth={1.8}
                />
              </button>
              {isActive && (
                <span className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-mac-blue shadow-[0_0_6px_rgba(10,132,255,0.6)]" />
              )}
              {/* Tooltip with glass effect */}
              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-mac-sm glass-elevated text-white/90 text-xs no-drag whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-mac ease-mac pointer-events-none shadow-mac-lg z-50">
                {label}
              </span>
            </div>
          );
        })}

        {/* ── Separator line ── */}
        <div className="w-6 h-px bg-white/[0.08] my-1" />

        {/* ── Playlist button (among nav items) ── */}
        <div className="relative">
          <div className="relative group">
            <button
              onClick={() => setShowPlaylists(!showPlaylists)}
              className={`w-12 h-12 flex items-center justify-center rounded-mac transition-all duration-mac ease-mac active:scale-[0.95] ${
                showPlaylists
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
              }`}
              type="button"
            >
              <ListMusic className="w-[22px] h-[22px]" strokeWidth={1.8} />
            </button>
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-mac-sm glass-elevated text-white/90 text-xs no-drag whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-mac ease-mac pointer-events-none shadow-mac-lg z-50">
              Playlists
            </span>
          </div>

          {/* ── Popover — macOS-style dropdown ── */}
          {showPlaylists && (
            <div
              ref={popoverRef}
              className="absolute left-full ml-2 top-0 w-[240px] max-h-[70vh] glass-popover rounded-mac-xl overflow-hidden flex flex-col z-50"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06]">
                <span className="text-mac-caption-2 font-semibold text-white/40 uppercase tracking-widest select-none">
                  Playlists
                </span>
                <button
                  onClick={() => openModal('create-playlist')}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                  type="button"
                  title="Create playlist"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>

              <div className="overflow-y-auto py-1 scrollbar-thin overscroll-contain">
                {/* Liked Songs */}
                <button
                  onClick={() => { setSelectedPlaylistId('__liked__'); setPage('playlist'); setShowPlaylists(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/[0.06] text-white/70 hover:text-white transition-all duration-mac ease-mac text-left"
                  type="button"
                >
                  <div className="w-8 h-8 rounded-mac-sm bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-3.5 h-3.5 text-white fill-white" strokeWidth={0} />
                  </div>
                  <span className="text-sm truncate flex-1">Liked Songs</span>
                  <span className="text-mac-caption-2 text-white/30 tabular-nums font-mono">{likedCount}</span>
                </button>

                {/* Downloaded */}
                <button
                  onClick={() => { setLibraryTab('downloaded'); setPage('library'); setShowPlaylists(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/[0.06] text-white/70 hover:text-white transition-all duration-mac ease-mac text-left"
                  type="button"
                >
                  <div className="w-8 h-8 rounded-mac-sm bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Download className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                  </div>
                  <span className="text-sm truncate flex-1">Downloaded</span>
                  <span className="text-mac-caption-2 text-white/30 tabular-nums font-mono">{downloadedCount}</span>
                </button>

                {/* Separator */}
                <div className="mx-3 my-1 h-px bg-white/[0.06]" />

                {/* Playlists */}
                {playlists.length > 0 ? (
                  playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => { setSelectedPlaylistId(pl.id); setPage('playlist'); setShowPlaylists(false); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-white/[0.06] text-white/70 hover:text-white transition-all duration-mac ease-mac text-left"
                      type="button"
                    >
                      <div className={`w-8 h-8 rounded-mac-sm bg-gradient-to-br ${playlistGradient(pl.id)} flex items-center justify-center flex-shrink-0`}>
                        <ListMusic className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
                      </div>
                      <span className="text-sm truncate flex-1">{pl.name}</span>
                      <span className="text-mac-caption-2 text-white/30 tabular-nums font-mono">{pl.trackCount ?? 0}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3.5 py-6 text-center">
                    <p className="text-xs text-white/30">No playlists yet</p>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="p-2 border-t border-white/[0.06] flex gap-1">
                <button
                  onClick={() => openModal('create-playlist')}
                  className="flex-1 py-2 rounded-mac text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-mac"
                  type="button"
                >
                  + New playlist
                </button>
                <button
                  onClick={() => openModal('import')}
                  className="flex-1 py-2 rounded-mac text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-mac"
                  type="button"
                >
                  + Import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />
    </aside>
  );
}
