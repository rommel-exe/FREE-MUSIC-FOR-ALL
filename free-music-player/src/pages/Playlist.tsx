import { useState, useEffect } from 'react';
import { ipc } from '@/utils/ipc';
import { usePlayerStore } from '@/store/playerStore';
import { Playlist, Track } from '@/types';

export function PlaylistPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const playTracks = usePlayerStore((s) => s.playTracks);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      const pls = await ipc.playlist.getPlaylists();
      setPlaylists(pls);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  };

  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
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
      loadPlaylists();
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
      loadPlaylists();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  };

  return (
    <div className="h-full flex">
      {/* Playlist list */}
      <div className="w-64 border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Playlists</h2>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {showCreate && (
            <div className="flex gap-2">
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
                className="px-3 py-1.5 bg-white text-black text-sm font-medium rounded hover:bg-white/90 transition-colors"
              >
                Create
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {playlists.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">No playlists yet</p>
          ) : (
            playlists.map((playlist) => (
              <div
                key={playlist.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors group ${
                  selectedPlaylist?.id === playlist.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => handleSelectPlaylist(playlist)}
              >
                <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{playlist.name}</div>
                  <div className="text-xs text-white/30">Playlist</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(playlist.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                >
                  <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Playlist content */}
      <div className="flex-1 overflow-y-auto">
        {selectedPlaylist ? (
          <div className="p-6">
            <div className="flex items-end gap-4 mb-6">
              <div className="w-40 h-40 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-xl">
                <svg className="w-16 h-16 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-white/60">Playlist</p>
                <h1 className="text-4xl font-bold text-white mt-1">{selectedPlaylist.name}</h1>
                <p className="text-sm text-white/50 mt-2">{playlistTracks.length} songs</p>
              </div>
            </div>

            {playlistTracks.length > 0 && (
              <button
                onClick={() => playTracks(playlistTracks)}
                className="mb-4 px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-semibold rounded-full hover:scale-105 transition-all"
              >
                Play All
              </button>
            )}

            {playlistTracks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/50">This playlist is empty</p>
                <p className="text-sm text-white/30 mt-1">Add songs from the search or library</p>
              </div>
            ) : (
              <div className="space-y-1">
                {playlistTracks.map((track, i) => (
                  <button
                    key={track.id}
                    onClick={() => playTracks(playlistTracks, i)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors group"
                  >
                    <span className="w-6 text-sm text-white/30 text-right tabular-nums">{i + 1}</span>
                    <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 overflow-hidden">
                      {track.thumbnail ? (
                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-white truncate">{track.title}</div>
                      <div className="text-xs text-white/50 truncate">{track.artist}</div>
                    </div>
                    <span className="text-xs text-white/30 tabular-nums">
                      {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            </div>
            <p className="text-white/50">Select a playlist to view its tracks</p>
          </div>
        )}
      </div>
    </div>
  );
}
