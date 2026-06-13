import { useShallow } from 'zustand/react/shallow';
import { useLibraryStore } from '@/store/libraryStore';
import { useDownloadStore } from '@/store/downloadStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { mediaResolver } from '@/services/mediaResolver';
import { useState, useEffect, useMemo, useRef } from 'react';

import {
  Music,
  Heart,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import { ipc } from '@/utils/ipc';
import { TrackRow } from '@/components/common/TrackRow';
import { thumbGradient, thumbLetter } from '@/utils/thumb';
import type { Track } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type SortField = 'title' | 'artist' | 'album' | 'createdAt' | 'playCount' | 'duration';
type TabFilter = 'all' | 'liked' | 'downloaded';

const TAB_ITEMS: { id: TabFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Music className="w-4 h-4" /> },
  { id: 'liked', label: 'Liked', icon: <Heart className="w-4 h-4" /> },
  { id: 'downloaded', label: 'Saved', icon: <Download className="w-4 h-4" /> },
];

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'title', label: 'Title' },
  { field: 'artist', label: 'Artist' },
  { field: 'duration', label: 'Duration' },
  { field: 'playCount', label: 'Plays' },
];

/* ------------------------------------------------------------------ */
/*  Utility functions                                                  */
/* ------------------------------------------------------------------ */

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatRelativeDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z');
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Empty state icon                                                   */
/* ------------------------------------------------------------------ */

function TabEmptyIcon({ tab }: { tab: TabFilter }) {
  const iconClass = 'w-7 h-7';
  return (
    <div className="w-16 h-16 rounded-full bg-groove-700 flex items-center justify-center mb-4 ring-1 ring-groove-600">
      {tab === 'downloaded' ? (
        <Download className={`${iconClass} text-groove-400`} />
      ) : tab === 'liked' ? (
        <Heart className={`${iconClass} text-danger/40`} />
      ) : (
        <Music className={`${iconClass} text-groove-400`} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort Dropdown                                                      */
/* ------------------------------------------------------------------ */

function SortDropdown({
  sortBy,
  sortOrder,
  onSort,
}: {
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: SortField) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeLabel = SORT_OPTIONS.find((o) => o.field === sortBy)?.label ?? 'Sort';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-radius-sm bg-groove-700 text-groove-200 text-mac-body font-medium hover:bg-groove-600 transition-colors duration-150"
        type="button"
      >
        {activeLabel}
        {sortOrder === 'asc' ? (
          <ChevronUp className="w-3 h-3 text-groove-400" />
        ) : (
          <ChevronDown className="w-3 h-3 text-groove-400" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-radius-md bg-groove-700 border border-groove-600 shadow-warm-lg py-1 animate-fade-in">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.field}
              onClick={() => {
                onSort(option.field);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-mac-body text-left transition-colors duration-100 ${
                sortBy === option.field
                  ? 'text-emerald bg-emerald-subtle'
                  : 'text-groove-200 hover:bg-groove-600'
              }`}
              type="button"
            >
              {option.label}
              {sortBy === option.field && (
                <span className="text-emerald text-[10px] font-semibold">
                  {sortOrder === 'asc' ? 'ASC' : 'DESC'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid Card                                                          */
/* ------------------------------------------------------------------ */

function GridCard({
  track,
  isCurrent,
  isPlaying,
  onPlay,
}: {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const grad = thumbGradient(track.id);
  const letter = thumbLetter(track.title || track.artist || '?');

  return (
    <button
      onClick={onPlay}
      className={`group w-40 rounded-radius-md overflow-hidden transition-all duration-150 text-left ${
        isCurrent
          ? 'ring-2 ring-emerald shadow-emerald-glow'
          : 'hover:bg-groove-600'
      }`}
      type="button"
    >
      <div className="w-40 h-40 rounded-radius-md overflow-hidden bg-groove-700 mb-2">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: grad }}
          >
            <span className="text-white/50 text-2xl font-bold">{letter}</span>
          </div>
        )}
      </div>
      <div className="px-1 pb-1">
        <p
          className={`text-mac-body font-semibold truncate ${
            isCurrent ? 'text-emerald' : 'text-groove-100'
          }`}
        >
          {track.title || 'Untitled'}
        </p>
        <p className="text-mac-caption text-groove-400 truncate">
          {track.artist || 'Unknown'}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  LibraryPage                                                        */
/* ------------------------------------------------------------------ */

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
    prematching,
    prematchAll,
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
      prematching: s.prematching,
      prematchAll: s.prematchAll,
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
  const tab = useUIStore((s) => s.libraryTab);
  const setTab = useUIStore((s) => s.setLibraryTab);
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const downloadEntries = useDownloadStore((s) => s.entries);
  const downloadTrack = useDownloadStore((s) => s.downloadTrack);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);

  /* ── Download metadata map ──────────────────────────────────── */
  const [downloadsMap, setDownloadsMap] = useState<
    Map<string, { fileSize: number; completedAt: string | null }>
  >(new Map());

  useEffect(() => {
    if (tab !== 'downloaded') return;
    let cancelled = false;
    ipc.download
      .getAll()
      .then(({ downloads }) => {
        if (cancelled) return;
        const map = new Map<string, { fileSize: number; completedAt: string | null }>();
        for (const d of downloads) {
          if (d.status === 'completed') {
            map.set(d.trackId, {
              fileSize: Number(d.fileSize) || 0,
              completedAt: d.completedAt ?? null,
            });
          }
        }
        setDownloadsMap(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab]);

  /* ── Tab counts ─────────────────────────────────────────────── */
  const allCount = tracks.length;
  const likedCount = favorites.length;
  const downloadedCount = useMemo(
    () => tracks.filter((t) => Boolean(t.path) && t.source === 'local').length,
    [tracks],
  );

  /* ── Filtered tracks ────────────────────────────────────────── */
  const filteredTracks = useMemo(() => {
    if (tab === 'liked') return favorites;
    if (tab === 'downloaded') {
      return tracks
        .filter((t) => downloadsMap.has(t.id))
        .sort((a, b) => {
          const aDate = downloadsMap.get(a.id)?.completedAt ?? '';
          const bDate = downloadsMap.get(b.id)?.completedAt ?? '';
          return bDate.localeCompare(aDate);
        });
    }
    return getFilteredTracks();
  }, [tab, favorites, tracks, downloadsMap, getFilteredTracks]);

  // Pre-resolve visible library tracks so play is instant
  useEffect(() => {
    const ids = filteredTracks.slice(0, 10).map(t => t.youtubeId).filter(Boolean) as string[];
    if (ids.length > 0) mediaResolver.prefetchBatch(ids);
  }, [filteredTracks]);

  /* ── Sort handler ───────────────────────────────────────────── */
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      toggleSortOrder();
    } else {
      setSortBy(field);
    }
  };

  const tabCount = (id: TabFilter): number => {
    if (id === 'all') return allCount;
    if (id === 'liked') return likedCount;
    return downloadedCount;
  };

  return (
    <div className="h-full flex flex-col relative z-10 pb-32">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-6 pt-14 pb-0 drag-region">
        <h1 className="text-mac-hero text-groove-50 tracking-tight mb-5 no-drag">
          Your Collection
        </h1>

        {/* ── Tab cards ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4 no-drag">
          {TAB_ITEMS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex flex-col items-center justify-center w-20 h-[60px] rounded-radius-md transition-all duration-150 ease-apple ${
                  active
                    ? 'bg-emerald-subtle text-emerald'
                    : 'bg-groove-700 text-groove-300 hover:bg-groove-600'
                }`}
                type="button"
              >
                {item.icon}
                <span className="text-mac-body font-medium mt-1">{item.label}</span>
                <span className="text-mac-caption text-groove-400">{tabCount(item.id)}</span>
              </button>
            );
          })}
        </div>

        {/* ── Search + Sort + View row ─────────────────────── */}
        <div className="flex items-center gap-3 mb-1 no-drag">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-groove-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in collection..."
              className="w-full pl-9 pr-4 py-2 rounded-radius-sm bg-groove-700 text-groove-100 placeholder-groove-400 text-sm outline-none border border-groove-600 focus:border-emerald/50 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)] transition-all duration-150"
            />
          </div>

          {/* Sort dropdown */}
          <SortDropdown sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />

          {/* View toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className={`p-2 rounded-radius-sm transition-colors duration-150 ${
              viewMode === 'grid'
                ? 'text-emerald bg-emerald-subtle'
                : 'text-groove-300 hover:bg-groove-700'
            }`}
            type="button"
            title={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
          >
            {viewMode === 'list' ? (
              <LayoutGrid className="w-4 h-4" />
            ) : (
              <LayoutList className="w-4 h-4" />
            )}
          </button>

          {/* ── Pre-match YouTube IDs ──────────────────────── */}
          {!prematching && (
            <button
              onClick={() => prematchAll()}
              className="text-xs text-groove-400 hover:text-groove-200 transition-colors duration-150 px-2 py-1.5 rounded-radius-sm hover:bg-groove-700"
              type="button"
            >
              Re-match
            </button>
          )}
          {prematching && (
            <span className="text-xs text-groove-400 animate-pulse px-2">
              Pre-matching…
            </span>
          )}
        </div>
      </div>

      {/* ── Track list / Grid ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <TabEmptyIcon tab={tab} />
            <p className="text-groove-200 font-medium text-mac-body">
              {searchQuery
                ? 'No songs match your search'
                : tab === 'liked'
                  ? 'No liked songs yet'
                  : tab === 'downloaded'
                    ? 'No saved songs yet'
                    : 'Your collection is empty'}
            </p>
            <p className="text-sm text-groove-400 mt-1.5 max-w-xs text-center leading-relaxed">
              {tab === 'liked'
                ? 'Heart a song to add it here'
                : tab === 'downloaded'
                  ? 'Click the download icon on any track to save it for offline listening'
                  : 'Search for music to get started'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── Grid view ──────────────────────────────────────── */
          <div className="grid grid-cols-4 gap-4 px-6 py-4 animate-fade-in">
            {filteredTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <GridCard
                  key={track.id}
                  track={track}
                  isCurrent={isCurrent}
                  isPlaying={isCurrent && isPlaying}
                  onPlay={() => {
                    const idx = filteredTracks.findIndex((t) => t.id === track.id);
                    playTracks(filteredTracks, idx >= 0 ? idx : 0);
                  }}
                />
              );
            })}
          </div>
        ) : (
          /* ── List view ──────────────────────────────────────── */
          <div className="animate-fade-in">
            {filteredTracks.map((track, i) => {
              const isCurrent = currentTrack?.id === track.id;
              const downloadInfo =
                tab === 'downloaded' ? downloadsMap.get(track.id) ?? null : null;
              const dlEntry = downloadEntries.get(track.id);
              const isTrackDownloaded = dlEntry?.status === 'completed' || Boolean(track.path && track.source === 'local');
              const isTrackDownloading = dlEntry?.status === 'downloading';

              const downloadMeta = downloadInfo
                ? [formatFileSize(downloadInfo.fileSize), formatRelativeDate(downloadInfo.completedAt)]
                    .filter(Boolean)
                    .join(' · ')
                : undefined;

              return (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  isActive={isCurrent}
                  isPlaying={isCurrent && isPlaying}
                  onPlay={() => playTracks(filteredTracks, i)}
                  onToggleFavorite={() => toggleFavorite(track.id)}
                  onDownload={() => {
                    if (isTrackDownloading) {
                      cancelDownload(track.id);
                    } else if (isTrackDownloaded) {
                      useDownloadStore.getState().deleteDownload(track.id);
                    } else {
                      downloadTrack(track);
                    }
                  }}
                  isDownloaded={isTrackDownloaded}
                  isDownloading={isTrackDownloading}
                  downloadMeta={downloadMeta}
                  showArtist={true}
                  showDuration={tab !== 'downloaded'}
                  showIndex={true}
                  canReorder={false}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


