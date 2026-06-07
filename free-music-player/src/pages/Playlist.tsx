import { useState, useEffect, useCallback } from 'react';
import { ipc } from '@/utils/ipc';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { Playlist, Track } from '@/types';
import { Play, Shuffle, ListMusic, Music, Trash2, Plus, Heart, Disc3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Deterministic gradient palette                                      */
/* ------------------------------------------------------------------ */

const GRADIENT_PRESETS = [
  { from: '#7c3aed', to: '#4f46e5' }, // violet → indigo
  { from: '#db2777', to: '#e11d48' }, // pink → rose
  { from: '#14b8a6', to: '#059669' }, // teal → emerald
  { from: '#f97316', to: '#dc2626' }, // orange → red
  { from: '#0ea5e9', to: '#2563eb' }, // sky → blue
  { from: '#d946ef', to: '#9333ea' }, // fuchsia → purple
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
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const setPage = useUIStore((s) => s.setPage);
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists);

  const reloadPlaylists = useCallback(async () => {
    try {
      const pls = await ipc.playlist.getPlaylists();
      setPlaylists(pls);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  }, []);

  useEffect(() => {
    reloadPlaylists();
  }, [reloadPlaylists]);

  // Pick up sidebar selection via uiStore
  const selectedPlaylistId = useUIStore((s) => s.selectedPlaylistId);
  const setSelectedPlaylistId = useUIStore((s) => s.setSelectedPlaylistId);

  useEffect(() => {
    if (!selectedPlaylistId) return;
    const id = selectedPlaylistId;
    setSelectedPlaylistId(null); // consume the selection

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

      const match = playlists.find((p: Playlist) => p.id === id);
      if (match) {
        await handleSelectPlaylist(match);
      } else {
        await reloadPlaylists();
        const refreshed = await ipc.playlist.getPlaylists();
        setPlaylists(refreshed);
        const retry = refreshed.find((p: Playlist) => p.id === id);
        if (retry) {
          await handleSelectPlaylist(retry);
        }
      }
    })();
  }, [selectedPlaylistId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleCreatePlaylist = async () => {
    if (!newName.trim()) return;
    try {
      await ipc.playlist.createPlaylist(newName.trim());
      setNewName('');
      setShowCreate(false);
      reloadPlaylists();
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    try {
      await ipc.playlist.deletePlaylist(id);
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
        setPlaylistTracks([]);
      }
      reloadPlaylists();
      loadPlaylists();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  const gradient = selectedPlaylist ? playlistGradient(selectedPlaylist.id) : GRADIENT_PRESETS[0];
  const gradientBg = `linear-gradient(180deg, ${gradient.from}33 0%, transparent 60%)`;

  return (
    <div className="h-full flex">
      {/* Playlist list sidebar */}
      <div className="w-64 border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Playlists</h2>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors duration-150"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 pb-1">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                    placeholder="Playlist name"
                    className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20"
                    autoFocus
                  />
                  <button
                    onClick={handleCreatePlaylist}
                    className="px-3 py-1.5 bg-white text-black text-sm font-medium rounded hover:bg-white/90 transition-colors duration-150"
                  >
                    Create
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <ListMusic className="w-5 h-5 text-white/25" />
              </div>
              <p className="text-sm text-white/30">No playlists yet</p>
              <p className="text-xs text-white/20 mt-1">Import one or create a new one</p>
            </div>
          ) : (
            playlists.map((playlist) => (
              <div
                key={playlist.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors duration-150 group ${
                  selectedPlaylist?.id === playlist.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/50 hover:text-white'
                }`}
                onClick={() => handleSelectPlaylist(playlist)}
              >
                {/* 48px thumbnail */}
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                  {playlist.thumbnail ? (
                    <img src={playlist.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${playlistGradient(playlist.id)} flex items-center justify-center`}
                    >
                      <ListMusic className="w-4 h-4 text-white/60" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{playlist.name}</div>
                  <div className="text-xs text-white/30 truncate">{playlist.trackCount ?? 0} songs</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(playlist.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all duration-150"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white/50" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Playlist content */}
      <div className="flex-1 overflow-y-auto">
        {selectedPlaylist ? (
          <div>
            {/* Hero */}
            <div
              className="relative px-8 pt-8 pb-6"
              style={{ background: gradientBg }}
            >
              <div className="flex items-end gap-6">
                {/* Large cover thumbnail */}
                <div className="relative w-56 h-56 rounded-lg overflow-hidden shadow-2xl flex-shrink-0">
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
                      <ListMusic className="w-16 h-16 text-white/40" />
                    </div>
                  )}
                  {/* Subtle overlay for text contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-2">Playlist</p>
                  <h1 className="text-5xl font-bold text-white leading-tight tracking-tight mb-3 line-clamp-2">
                    {selectedPlaylist.name}
                  </h1>
                  <p className="text-sm text-white/50">
                    {playlistTracks.length} {playlistTracks.length === 1 ? 'song' : 'songs'}
                    {selectedPlaylist.source && selectedPlaylist.source !== 'local' && (
                      <span> · {sourceLabel(selectedPlaylist.source)}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {playlistTracks.length > 0 && (
              <div className="px-8 py-4 flex items-center gap-3">
                <button
                  onClick={() => playTracks(playlistTracks)}
                  className="flex items-center gap-2 px-7 py-2.5 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-full hover:scale-[1.03] active:scale-[0.98] transition-all duration-150"
                >
                  <Play className="w-4.5 h-4.5 fill-black" />
                  Play All
                </button>
                <button
                  onClick={() => {
                    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
                    playTracks(shuffled);
                  }}
                  className="flex items-center gap-2 px-7 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-full hover:scale-[1.03] active:scale-[0.98] transition-all duration-150"
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle
                </button>
              </div>
            )}

            {/* Track list */}
            {playlistTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Disc3 className="w-7 h-7 text-white/20" />
                </div>
                <p className="text-white/50 text-lg font-medium">This playlist is empty</p>
                <p className="text-sm text-white/30 mt-1.5 max-w-xs">
                  Search for music and add tracks to build your collection
                </p>
              </div>
            ) : (
              <div className="px-4 pb-8">
                {/* Column header */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 mb-1">
                  <span className="w-8 text-xs text-white/30 text-right tabular-nums">#</span>
                  <span className="w-12 h-12" /> {/* thumbnail spacer */}
                  <span className="flex-1 text-xs text-white/30 uppercase tracking-wider">Title</span>
                  <span className="text-xs text-white/30 uppercase tracking-wider w-16 text-right">Time</span>
                </div>

                {playlistTracks.map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    onPlay={() => playTracks(playlistTracks, i)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Empty state — no playlist selected */
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center mb-5 border border-white/5">
              <Music className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-xl font-semibold text-white/60 mb-2">Select a playlist</h3>
            <p className="text-sm text-white/30 max-w-xs leading-relaxed">
              Choose a playlist from the sidebar to see its tracks, or import a playlist from YouTube or Spotify.
            </p>
            <button
              onClick={() => setPage('search')}
              className="mt-6 flex items-center gap-2 px-5 py-2 bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-sm font-medium rounded-full transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              Find music to add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TrackRow                                                            */
/* ------------------------------------------------------------------ */

function TrackRow({ track, index, onPlay }: { track: Track; index: number; onPlay: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onPlay}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-4 py-2 rounded-md hover:bg-white/5 transition-colors duration-150 group"
    >
      {/* Number / Play icon */}
      <span className="w-8 text-sm text-right tabular-nums">
        {hovered ? (
          <Play className="w-3.5 h-3.5 text-white inline fill-white" />
        ) : (
          <span className="text-white/30">{index + 1}</span>
        )}
      </span>

      {/* Thumbnail — 48px */}
      <div className="w-12 h-12 rounded bg-white/10 flex-shrink-0 overflow-hidden">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-4 h-4 text-white/25" />
          </div>
        )}
      </div>

      {/* Title + Artist */}
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-white truncate">{track.title}</div>
        <div className="text-xs text-white/50 truncate">{track.artist}</div>
      </div>

      {/* Duration */}
      <span className="text-xs text-white/30 tabular-nums w-16 text-right">
        {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
      </span>
    </button>
  );
}
