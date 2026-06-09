import { useState, useEffect, useCallback, useRef } from 'react';
import { ipc } from '@/utils/ipc';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useDownloadStore } from '@/store/downloadStore';
import { useUIStore } from '@/store/uiStore';
import { mediaResolver } from '@/services/mediaResolver';
import { Playlist, Track } from '@/types';
import {
  Play,
  Shuffle,
  ListMusic,
  Music,
  Disc3,
  Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { TrackRow } from '@/components/common/TrackRow';

/* ------------------------------------------------------------------ */
/*  Deterministic gradient palette                                      */
/* ------------------------------------------------------------------ */

const GRADIENT_PRESETS = [
  { from: '#7c3aed', to: '#4f46e5' },
  { from: '#db2777', to: '#e11d48' },
  { from: '#14b8a6', to: '#059669' },
  { from: '#f97316', to: '#dc2626' },
  { from: '#0ea5e9', to: '#2563eb' },
  { from: '#d946ef', to: '#9333ea' },
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

function sourceLabel(source?: string): string {
  if (!source || source === 'local') return 'Local';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/* ------------------------------------------------------------------ */
/*  PlaylistPage                                                        */
/* ------------------------------------------------------------------ */

export function PlaylistPage() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setPage = useUIStore((s) => s.setPage);
  const downloadEntries = useDownloadStore((s) => s.entries);
  const downloadTrack = useDownloadStore((s) => s.downloadTrack);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);

  /* ── Sidebar selection via uiStore ─────────────────────────── */
  const selectedPlaylistId = useUIStore((s) => s.selectedPlaylistId);
  const setSelectedPlaylistId = useUIStore((s) => s.setSelectedPlaylistId);

  useEffect(() => {
    if (!selectedPlaylistId) return;
    const id = selectedPlaylistId;
    setSelectedPlaylistId(null);

    (async () => {
      if (id === '__liked__') {
        const tracks = useLibraryStore.getState().tracks.filter((t) => t.isFavorite);
        setSelectedPlaylist({
          id: '__liked__',
          name: 'Liked Songs',
          description: '',
          thumbnail: '',
          source: 'local',
          sourceUrl: '',
          trackCount: tracks.length,
          createdAt: '',
          updatedAt: '',
        });
        setPlaylistTracks(tracks);
        return;
      }

      const allPlaylists = await ipc.playlist.getPlaylists();
      const match = allPlaylists.find((p: Playlist) => p.id === id);
      if (match) {
        await handleSelectPlaylist(match);
      }
    })();
  }, [selectedPlaylistId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Select a playlist ─────────────────────────────────────── */
  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    if (playlist.id === '__liked__') {
      const tracks = useLibraryStore.getState().tracks.filter((t) => t.isFavorite);
      setPlaylistTracks(tracks);
      return;
    }
    try {
      const tracks = await ipc.playlist.getPlaylistTracks(playlist.id);
      setPlaylistTracks(tracks);
    } catch (err) {
      console.error('Failed to load playlist tracks:', err);
      setPlaylistTracks([]);
    }
  };

  // Pre-resolve playlist tracks so clicking play is instant
  useEffect(() => {
    const ids = playlistTracks.slice(0, 10).map(t => t.youtubeId).filter(Boolean) as string[];
    if (ids.length > 0) mediaResolver.prefetchBatch(ids);
  }, [playlistTracks]);

  /* ── Derived state ─────────────────────────────────────────── */
  const gradient = selectedPlaylist ? playlistGradient(selectedPlaylist.id) : GRADIENT_PRESETS[0];
  const gradientBg = `linear-gradient(180deg, ${gradient.from}40 0%, transparent 70%)`;
  const isLikedPlaylist = selectedPlaylist?.id === '__liked__';
  const canReorder = !!selectedPlaylist && !isLikedPlaylist;

  /* ── Drag-and-drop state ───────────────────────────────────── */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragItemRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = dragItemRef.current;
      setDragIndex(null);
      setDragOverIndex(null);
      dragItemRef.current = null;
      if (fromIndex === null || fromIndex === toIndex || !selectedPlaylist || !canReorder) return;

      setPlaylistTracks((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });

      try {
        await ipc.playlist.reorderPlaylistTracks(selectedPlaylist.id, fromIndex, toIndex);
      } catch (err) {
        console.error('Failed to reorder playlist tracks:', err);
        try {
          const tracks = await ipc.playlist.getPlaylistTracks(selectedPlaylist.id);
          setPlaylistTracks(tracks);
        } catch {
          /* noop */
        }
      }
    },
    [selectedPlaylist, canReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  }, []);

  /* ── Remove track from playlist ────────────────────────────── */
  const handleRemoveTrack = useCallback(
    async (trackId: string) => {
      if (!selectedPlaylist) return;

      if (isLikedPlaylist) {
        try {
          await useLibraryStore.getState().toggleFavorite(trackId);
          setPlaylistTracks(useLibraryStore.getState().tracks.filter((t) => t.isFavorite));
        } catch (err) {
          console.error('Failed to unlike track:', err);
        }
        return;
      }

      setPlaylistTracks((prev) => prev.filter((t) => t.id !== trackId));
      try {
        await ipc.playlist.removeTrackFromPlaylist(selectedPlaylist.id, trackId);
      } catch (err) {
        console.error('Failed to remove track from playlist:', err);
        try {
          const tracks = await ipc.playlist.getPlaylistTracks(selectedPlaylist.id);
          setPlaylistTracks(tracks);
        } catch {
          /* noop */
        }
      }
    },
    [selectedPlaylist, isLikedPlaylist],
  );

  return (
    <div className="h-full overflow-y-auto relative z-10 pb-32 scrollbar-thin">
      {selectedPlaylist ? (
        <motion.div
          key={selectedPlaylist.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {/* ── Hero section ──────────────────────────────── */}
          <div
            className="relative px-8 pt-16 pb-8 drag-region"
            style={{ background: gradientBg }}
          >
            <div className="flex items-end gap-7 no-drag">
              {/* Large cover art */}
              <div className="relative w-56 h-56 rounded-mac-xl overflow-hidden shadow-2xl flex-shrink-0 ring-1 ring-white/[0.08] animate-fade-in">
                {selectedPlaylist.thumbnail ? (
                  <img
                    src={selectedPlaylist.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                    }}
                  >
                    <ListMusic className="w-16 h-16 text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>

              {/* Playlist info */}
              <motion.div
                className="flex-1 min-w-0 pb-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50 mb-2">
                  Playlist
                </p>
                <h1 className="text-[40px] font-bold text-white leading-[1.1] tracking-tight mb-3 line-clamp-2">
                  {selectedPlaylist.name}
                </h1>
                <p className="text-sm text-white/45">
                  {playlistTracks.length}{' '}
                  {playlistTracks.length === 1 ? 'song' : 'songs'}
                  {selectedPlaylist.source && selectedPlaylist.source !== 'local' && (
                    <span className="text-white/25"> · {sourceLabel(selectedPlaylist.source)}</span>
                  )}
                </p>
              </motion.div>
            </div>
          </div>

          {/* ── Actions bar ───────────────────────────────── */}
          {playlistTracks.length > 0 && (
            <motion.div
              className="px-8 py-4 flex items-center gap-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 }}
            >
              <button
                onClick={() => playTracks(playlistTracks)}
                className="mac-button-primary rounded-full px-6 py-2 shadow-mac-sm"
                type="button"
              >
                <Play className="w-4 h-4 fill-current" />
                Play All
              </button>
              <button
                onClick={() => {
                  const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
                  playTracks(shuffled);
                }}
                className="mac-button rounded-full px-5 py-2"
                type="button"
              >
                <Shuffle className="w-4 h-4" />
                Shuffle
              </button>
            </motion.div>
          )}

          {/* ── Track list ────────────────────────────────── */}
          {playlistTracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mb-4 ring-1 ring-white/[0.06]">
                <Disc3 className="w-7 h-7 text-white/15" />
              </div>
              <p className="text-white/45 font-medium text-mac-body">This playlist is empty</p>
              <p className="text-sm text-white/25 mt-1.5 max-w-xs leading-relaxed">
                Search for music and add tracks to build your collection
              </p>
            </div>
          ) : (
            <div className="px-4 pb-8">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-6 py-2 border-b border-white/[0.06] mb-0.5">
                <span className="w-8 text-[10px] text-white/30 text-right uppercase tracking-wider font-semibold">
                  #
                </span>
                <span className="w-11 flex-shrink-0" /> {/* thumbnail spacer */}
                <span className="flex-1 text-[10px] text-white/30 uppercase tracking-wider font-semibold">
                  Title
                </span>
                <span className="w-14 text-right text-[10px] text-white/30 uppercase tracking-wider font-semibold">
                  Time
                </span>
                <span className="w-8" /> {/* action spacer */}
              </div>

              {/* Track rows */}
              {playlistTracks.map((track, i) => {
                const dlEntry = downloadEntries.get(track.id);
                const isTrackDownloaded = dlEntry?.status === 'completed' || Boolean(track.path && track.source === 'local');
                const isTrackDownloading = dlEntry?.status === 'downloading';
                return (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    isActive={currentTrack?.id === track.id}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    canReorder={canReorder}
                    onPlay={() => playTracks(playlistTracks, i)}
                    onRemove={handleRemoveTrack}
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
                    showArtist={true}
                    showDuration={true}
                    showIndex={true}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    dragIndex={dragIndex}
                    dragOverIndex={dragOverIndex}
                  />
                );
              })}
            </div>
          )}
        </motion.div>
      ) : (
        /* ── Empty state — no playlist selected ──────────────── */
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <motion.div
            className="w-20 h-20 rounded-full bg-gradient-to-br from-white/[0.04] to-transparent flex items-center justify-center mb-5 ring-1 ring-white/[0.06]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Music className="w-8 h-8 text-white/15" />
          </motion.div>
          <h3 className="text-xl font-semibold text-white/50 mb-2">Select a playlist</h3>
          <p className="text-sm text-white/25 max-w-xs leading-relaxed">
            Choose a playlist from the dock to see its tracks, or import a playlist from
            YouTube or Spotify.
          </p>
          <button
            onClick={() => setPage('search')}
            className="mt-6 mac-button rounded-full px-5 py-2"
            type="button"
          >
            <Plus className="w-4 h-4" />
            Find music to add
          </button>
        </div>
      )}
    </div>
  );
}
