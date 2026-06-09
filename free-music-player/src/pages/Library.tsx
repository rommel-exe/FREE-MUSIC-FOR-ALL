import { useShallow } from 'zustand/react/shallow';
import { useLibraryStore } from '@/store/libraryStore';
import { useDownloadStore } from '@/store/downloadStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { mediaResolver } from '@/services/mediaResolver';
import { useState, useEffect, useMemo } from 'react';

import { Music, Heart, Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { ipc } from '@/utils/ipc';
import { TrackRow } from '@/components/common/TrackRow';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type SortField = 'title' | 'artist' | 'createdAt' | 'playCount';
type TabFilter = 'all' | 'liked' | 'downloaded';

const TAB_ITEMS: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'liked', label: 'Liked' },
  { id: 'downloaded', label: 'Downloaded' },
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

/* ------------------------------------------------------------------ */
/*  Empty state icon                                                   */
/* ------------------------------------------------------------------ */

function TabEmptyIcon({ tab }: { tab: TabFilter }) {
  const iconClass = 'w-7 h-7';
  return (
    <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4 ring-1 ring-white/[0.06]">
      {tab === 'downloaded' ? (
        <Download className={`${iconClass} text-white/20`} />
      ) : tab === 'liked' ? (
        <Heart className={`${iconClass} text-mac-red/30`} />
      ) : (
        <Music className={`${iconClass} text-white/20`} />
      )}
    </div>
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
  const tab = useUIStore((s) => s.libraryTab);
  const setTab = useUIStore((s) => s.setLibraryTab);
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
      <div className="px-8 pt-14 pb-0 drag-region">
        <h1 className="text-[28px] font-bold text-white/90 tracking-tight mb-5 no-drag">
          Your Library
        </h1>

        {/* ── Tab chips ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4 no-drag">
          {TAB_ITEMS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`glass-tab relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'active bg-white text-black shadow-mac-sm'
                    : 'text-white/70 hover:text-white'
                }`}
                type="button"
              >
                {item.label}
                <span
                  className={`ml-1.5 text-[10px] font-semibold ${
                    active ? 'text-black/40' : 'text-white/30'
                  }`}
                >
                  {tabCount(item.id)}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Search + Sort row ─────────────────────────────── */}
        <div className="flex items-center gap-3 mb-1 no-drag">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in library..."
              className="w-full pl-9 pr-4 py-2 mac-input text-sm rounded-mac"
            />
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-1">
            {(
              [
                ['title', 'Title'],
                ['artist', 'Artist'],
                ['playCount', 'Plays'],
              ] as const
            ).map(([field, label]) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                  sortBy === field
                    ? 'bg-white/12 text-white'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
                }`}
                type="button"
              >
                {label}
                {sortBy === field && (
                  <span className="flex items-center">
                    {sortOrder === 'asc' ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Column headers ──────────────────────────────────── */}
      <div className="flex items-center gap-3 px-8 py-2 mx-8 mt-2 border-b border-white/[0.06]">
        <span className="w-8 text-[10px] text-white/30 text-right uppercase tracking-wider font-semibold">
          #
        </span>
        <span className="w-11 flex-shrink-0" /> {/* thumbnail spacer */}
        <span className="flex-1 text-[10px] text-white/30 uppercase tracking-wider font-semibold">
          Title
        </span>
        <span className="w-36 hidden lg:block text-[10px] text-white/30 uppercase tracking-wider font-semibold">
          Artist
        </span>
        {tab === 'downloaded' ? (
          <span className="w-24 text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold hidden md:block">
            Size
          </span>
        ) : showDurationColumn(tab) ? (
          <span className="w-14 text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold hidden sm:block">
            Time
          </span>
        ) : null}
        <span className="w-10" /> {/* action spacer */}
      </div>

      {/* ── Track list (CSS entrance, no framer-motion) ──────── */}
      <div className="flex-1 overflow-y-auto scroll-edge-bottom">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <TabEmptyIcon tab={tab} />
            <p className="text-white/50 font-medium text-mac-body">
              {searchQuery
                ? 'No songs match your search'
                : tab === 'liked'
                  ? 'No liked songs yet'
                  : tab === 'downloaded'
                    ? 'No downloaded songs yet'
                    : 'Your library is empty'}
            </p>
            <p className="text-sm text-white/25 mt-1.5 max-w-xs text-center leading-relaxed">
              {tab === 'liked'
                ? 'Heart a song to add it here'
                : tab === 'downloaded'
                  ? 'Click the download icon on any track to save it for offline listening'
                  : 'Search for music to get started'}
            </p>
          </div>
        ) : (
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function showDurationColumn(tab: TabFilter): boolean {
  return tab !== 'downloaded';
}
