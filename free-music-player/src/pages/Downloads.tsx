import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDownloadStore } from '@/store/downloadStore';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { TrackRow } from '@/components/common/TrackRow';
import { Download, Music } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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
/*  DownloadsPage                                                       */
/* ------------------------------------------------------------------ */

export function DownloadsPage() {
  const { list, cancelDownload, deleteDownload, retryDownload } = useDownloadStore(
    useShallow((s) => ({
      list: s.list,
      cancelDownload: s.cancelDownload,
      deleteDownload: s.deleteDownload,
      retryDownload: s.retryDownload,
    })),
  );
  const libraryTracks = useLibraryStore((s) => s.tracks);
  const { playTracks, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({
      playTracks: s.playTracks,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
    })),
  );
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  /* Build a map for quick track lookups */
  const trackMap = useMemo(() => {
    const m = new Map<string, (typeof libraryTracks)[number]>();
    for (const t of libraryTracks) m.set(t.id, t);
    return m;
  }, [libraryTracks]);

  const activeDownloads = useMemo(() => list.filter((e) => e.status === 'downloading'), [list]);
  const completedDownloads = useMemo(() => list.filter((e) => e.status === 'completed'), [list]);
  const failedDownloads = useMemo(() => list.filter((e) => e.status === 'failed'), [list]);

  const hasAny = list.length > 0;

  return (
    <div className="h-full overflow-y-auto relative z-10 pb-32">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-8 pt-14 pb-6 drag-region">
        <h1 className="text-[28px] font-bold text-white/90 tracking-tight mb-1 no-drag">
          Downloads
        </h1>
        <p className="text-sm text-white/30 no-drag">
          Manage your offline music
        </p>
      </div>

      {!hasAny ? (
        /* ── Empty state ─────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4 ring-1 ring-white/[0.06]">
            <Download className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/50 font-medium text-mac-body">No downloads yet</p>
          <p className="text-sm text-white/25 mt-1.5 max-w-xs text-center leading-relaxed">
            Click the download icon on any track to save it for offline listening
          </p>
        </div>
      ) : (
        <div className="px-8 animate-fade-in space-y-8">
          {/* ── Active downloads ─────────────────────────────── */}
          {activeDownloads.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
                Downloading ({activeDownloads.length})
              </h2>
              <div className="glass-card rounded-mac-lg p-1">
                {activeDownloads.map((entry, i) => {
                  const track = trackMap.get(entry.trackId);
                  return (
                    <ActiveDownloadRow
                      key={entry.trackId}
                      entry={entry}
                      track={track}
                      onCancel={() => cancelDownload(entry.trackId)}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Failed downloads ─────────────────────────────── */}
          {failedDownloads.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
                Failed ({failedDownloads.length})
              </h2>
              <div className="glass-card rounded-mac-lg p-1">
                {failedDownloads.map((entry, i) => {
                  const track = trackMap.get(entry.trackId);
                  return (
                    <FailedDownloadRow
                      key={entry.trackId}
                      entry={entry}
                      track={track}
                      onRetry={() => {
                        if (track) retryDownload(track);
                      }}
                      onDelete={() => deleteDownload(entry.trackId)}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Completed downloads ──────────────────────────── */}
          {completedDownloads.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
                Downloaded ({completedDownloads.length})
              </h2>
              <div className="glass-card rounded-mac-lg p-1">
                {completedDownloads.map((entry, i) => {
                  const track = trackMap.get(entry.trackId);
                  // Build a fake Track for TrackRow
                  const displayTrack = track ?? {
                    id: entry.trackId,
                    title: entry.title,
                    artist: entry.artist,
                    album: '',
                    duration: entry.duration,
                    thumbnail: entry.thumbnail,
                    path: entry.filePath ?? '',
                    youtubeId: entry.videoId,
                    source: 'local' as const,
                    isFavorite: false,
                    playCount: 0,
                    createdAt: entry.createdAt ?? '',
                    updatedAt: '',
                  };
                  const isCurrent = currentTrack?.id === entry.trackId;
                  const downloadMeta = [
                    formatFileSize(entry.fileSize ?? 0),
                    formatRelativeDate(entry.completedAt),
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  // Find the index in the completed list for playback
                  const completedTracksForPlay = completedDownloads
                    .map((e) => trackMap.get(e.trackId))
                    .filter(Boolean) as any[];
                  const playIndex = completedTracksForPlay.findIndex(
                    (t: any) => t?.id === entry.trackId,
                  );

                  return (
                    <TrackRow
                      key={entry.trackId}
                      track={displayTrack}
                      index={i}
                      isActive={isCurrent}
                      isPlaying={isCurrent && isPlaying}
                      isDownloaded
                      onPlay={() => {
                        if (playIndex >= 0) {
                          playTracks(completedTracksForPlay, playIndex);
                        } else if (track) {
                          playTracks([track], 0);
                        }
                      }}
                      onToggleFavorite={track ? () => toggleFavorite(track.id) : undefined}
                      downloadMeta={downloadMeta}
                      showArtist
                      showDuration
                      showIndex
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ActiveDownloadRow — shown while a download is in progress           */
/* ------------------------------------------------------------------ */

function ActiveDownloadRow({
  entry,
  track,
  onCancel,
}: {
  entry: { title: string; artist: string; thumbnail: string; progress: number; trackId: string };
  track?: { thumbnail: string };
  onCancel: () => void;
}) {
  const pct = Math.round(entry.progress * 100);

  return (
    <div className="flex items-center gap-3.5 px-3 py-3 rounded-mac hover:bg-white/[0.03] transition-colors">
      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-mac-sm bg-white/10 flex-shrink-0 overflow-hidden">
        {(track?.thumbnail || entry.thumbnail) ? (
          <img
            src={track?.thumbnail || entry.thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.06]">
            <Download className="w-5 h-5 text-white/30" />
          </div>
        )}
      </div>

      {/* Info + progress */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate leading-tight">
          {entry.title}
        </div>
        <div className="text-xs text-white/45 truncate mt-0.5">{entry.artist}</div>
        {/* Progress bar */}
        <div className="mt-1.5 h-1 bg-white/[0.08] rounded-full overflow-hidden">
          <div
            className="h-full bg-mac-blue rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Cancel button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="mac-button-ghost p-1.5 rounded-md text-white/45 hover:text-mac-red transition-colors"
        type="button"
        title="Cancel download"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FailedDownloadRow                                                   */
/* ------------------------------------------------------------------ */

function FailedDownloadRow({
  entry,
  track,
  onRetry,
  onDelete,
}: {
  entry: { title: string; artist: string; thumbnail: string; error?: string };
  track?: { thumbnail: string };
  onRetry: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3.5 px-3 py-3 rounded-mac hover:bg-white/[0.03] transition-colors">
      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-mac-sm bg-white/10 flex-shrink-0 overflow-hidden">
        {(track?.thumbnail || entry.thumbnail) ? (
          <img
            src={track?.thumbnail || entry.thumbnail}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.06]">
            <Music className="w-5 h-5 text-white/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate leading-tight">
          {entry.title}
        </div>
        <div className="text-xs text-mac-red/70 truncate mt-0.5">
          {entry.error ?? 'Download failed'}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="mac-button-ghost p-1.5 rounded-md text-white/45 hover:text-mac-blue transition-colors"
          type="button"
          title="Retry download"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 4v6h6M23 20v-6h-6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mac-button-ghost p-1.5 rounded-md text-white/45 hover:text-mac-red transition-colors"
          type="button"
          title="Remove"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
