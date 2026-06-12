import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDownloadStore } from '@/store/downloadStore';
import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { TrackRow } from '@/components/common/TrackRow';
import { Download, Music, Disc3, RefreshCw, Trash2 } from 'lucide-react';


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
  if (Number.isNaN(date.getTime())) return '';
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
/*  DownloadsPage — "The Crate"                                        */
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
    <div className="h-full overflow-y-auto overscroll-contain relative z-10 pb-32">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-6 pt-14 pb-6 drag-region">
        <h1 className="text-mac-hero text-groove-50 tracking-tight mb-1 no-drag">
          Your Crate
        </h1>
        <p className="text-mac-subhead text-groove-300 no-drag">
          Your offline collection
        </p>
      </div>

      {!hasAny ? (
        /* ── Empty state ─────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-groove-700 flex items-center justify-center mb-4 ring-1 ring-groove-600">
            <Disc3 className="w-7 h-7 text-groove-400" />
          </div>
          <p className="text-groove-200 font-medium text-mac-body">Your crate is empty</p>
          <p className="text-sm text-groove-400 mt-1.5 max-w-xs text-center leading-relaxed">
            Download songs to listen offline
          </p>
        </div>
      ) : (
        <div className="px-6 animate-fade-in space-y-8">
          {/* ── Active downloads — card layout ──────────────── */}
          {activeDownloads.length > 0 && (
            <section>
              <h2 className="text-mac-caption font-semibold text-groove-300 uppercase tracking-wider mb-3">
                Downloading ({activeDownloads.length})
              </h2>
              <div className="space-y-3">
                {activeDownloads.map((entry) => {
                  const track = trackMap.get(entry.trackId);
                  return (
                    <ActiveDownloadCard
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

          {/* ── Failed downloads — inline error rows ────────── */}
          {failedDownloads.length > 0 && (
            <section>
              <h2 className="text-mac-caption font-semibold text-groove-300 uppercase tracking-wider mb-3">
                Failed ({failedDownloads.length})
              </h2>
              <div className="space-y-1">
                {failedDownloads.map((entry) => {
                  const track = trackMap.get(entry.trackId);
                  return (
                    <div
                      key={entry.trackId}
                      className="flex items-center gap-3 px-4 py-3 rounded-radius-md bg-groove-700/50 border border-danger/10 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="w-11 h-11 rounded-radius-sm bg-groove-600 flex-shrink-0 overflow-hidden">
                        {(track?.thumbnail || entry.thumbnail) ? (
                          <img
                            src={track?.thumbnail || entry.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-5 h-5 text-groove-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-groove-100 truncate leading-tight">
                          {entry.title}
                        </div>
                        <div className="text-xs text-danger truncate mt-0.5">
                          {entry.error ?? 'Download failed'}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (track) retryDownload(track);
                          }}
                          className="p-1.5 rounded-md text-groove-400 hover:text-emerald hover:bg-groove-600 transition-all duration-150"
                          type="button"
                          title="Retry download"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDownload(entry.trackId);
                          }}
                          className="p-1.5 rounded-md text-groove-400 hover:text-danger hover:bg-groove-600 transition-all duration-150"
                          type="button"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Completed downloads — clean list ────────────── */}
          {completedDownloads.length > 0 && (
            <section>
              <h2 className="text-mac-caption font-semibold text-groove-300 uppercase tracking-wider mb-3">
                Downloaded ({completedDownloads.length})
              </h2>
              <div>
                {completedDownloads.map((entry) => {
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
                      index={completedDownloads.indexOf(entry)}
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
/*  ActiveDownloadCard — card-based design for in-progress downloads   */
/* ------------------------------------------------------------------ */

function ActiveDownloadCard({
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
    <div className="rounded-radius-lg bg-groove-700 border border-groove-500/20 p-4 transition-colors">
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-radius-sm bg-groove-600 flex-shrink-0 overflow-hidden">
          {(track?.thumbnail || entry.thumbnail) ? (
            <img
              src={track?.thumbnail || entry.thumbnail}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Download className="w-5 h-5 text-groove-400" />
            </div>
          )}
        </div>

        {/* Info + progress */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-groove-100 truncate leading-tight">
            {entry.title}
          </div>
          <div className="text-xs text-groove-300 truncate mt-0.5">{entry.artist}</div>
          {/* Progress bar */}
          <div className="mt-2 h-2 bg-groove-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald rounded-full transition-all duration-300 shadow-emerald-glow"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-mac-caption text-groove-400 tabular-nums font-mono mt-1 inline-block">
            {pct}%
          </span>
        </div>

        {/* Cancel button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="p-2 rounded-md text-groove-400 hover:text-danger hover:bg-groove-600 transition-all duration-150"
          type="button"
          title="Cancel download"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
