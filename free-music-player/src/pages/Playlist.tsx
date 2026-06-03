import React, { useState } from 'react';
import { Plus, Play, Trash2, ArrowLeft, ListMusic, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlaylistStore } from '@/store/playlistStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { useDownloadStore } from '@/store/downloadStore';
import { TrackItem } from '@/components/common/TrackItem';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { TrackSkeleton } from '@/components/common/Skeleton';

export function PlaylistPage() {
  const {
    playlists, currentPlaylistId, currentPlaylistTracks, loading,
    loadPlaylists, createPlaylist, deletePlaylist, selectPlaylist, removeTrackFromPlaylist,
  } = usePlaylistStore();
  const { playTracks } = usePlayerStore();
  const { openModal, addToast } = useUIStore();
  const { downloadPlaylist, batchActive, batchProgress } = useDownloadStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  React.useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const currentPlaylist = playlists.find((p) => p.id === currentPlaylistId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPlaylist(newName.trim(), newDesc.trim());
    setShowCreateModal(false);
    setNewName('');
    setNewDesc('');
    addToast('Playlist created', 'success');
  };

  const handleDownloadAll = async () => {
    if (!currentPlaylist || currentPlaylistTracks.length === 0) return;
    const tracks = currentPlaylistTracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      thumbnail: t.thumbnail,
      youtubeId: t.youtubeId,
    }));
    if (tracks.length === 0) return;
    const missing = tracks.filter((t) => !t.youtubeId).length;
    addToast(
      `Downloading ${tracks.length} tracks${missing > 0 ? ` (searching YouTube for ${missing})` : ''}…`,
      'info',
    );
    const result = await downloadPlaylist(tracks);
    const parts: string[] = [];
    parts.push(`${result.success}/${tracks.length} downloaded`);
    if (result.skipped > 0) parts.push(`${result.skipped} already had files`);
    if (result.failed > 0) parts.push(`${result.failed} failed`);
    const summary = parts.join(', ');
    console.log('[Downloads] Final result:', result);

    if (result.failed > 0 && result.results) {
      const failed = result.results.filter((r: any) => !r.success).slice(0, 3);
      const failedNames = failed.map((r: any) => `${r.artist} - ${r.title}`).join('; ');
      console.warn(`[Downloads] Failed: ${failedNames}`);
      addToast(`${summary}. First failures: ${failedNames}`, 'error', 10000);
    } else {
      addToast(summary, result.failed === 0 ? 'success' : 'info');
    }
  };

  if (currentPlaylistId && currentPlaylist) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-5 pb-3">
          <button
            type="button"
            onClick={() => usePlaylistStore.setState({ currentPlaylistId: null })}
            className="flex items-center gap-2 text-[13px] text-surface-400 hover:text-surface-100 mb-4 transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to playlists
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-mac-lg bg-surface-700 flex items-center justify-center overflow-hidden">
              {currentPlaylist.thumbnail ? (
                <img src={currentPlaylist.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <ListMusic size={28} className="text-surface-500" />
              )}
            </div>
            <div>
              <h1 className="text-mac-title-1 text-surface-50">{currentPlaylist.name}</h1>
              {currentPlaylist.description && <p className="text-[13px] text-surface-400">{currentPlaylist.description}</p>}
              <p className="text-[11px] text-surface-500 mt-0.5">{currentPlaylistTracks.length} tracks</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 items-center flex-wrap">
            <Button
              variant="primary"
              icon={<Play size={12} />}
              onClick={() => playTracks(currentPlaylistTracks)}
              disabled={currentPlaylistTracks.length === 0}
            >
              Play All
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={12} />}
              onClick={handleDownloadAll}
              disabled={currentPlaylistTracks.length === 0 || batchActive}
            >
              {batchActive
                ? `Downloading ${batchProgress?.current || 0}/${batchProgress?.total || 0}…`
                : 'Download All'}
            </Button>
            <Button
              variant="secondary"
              icon={<Plus size={12} />}
              onClick={() => openModal('import')}
            >
              Add Tracks
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={12} />}
              onClick={async () => {
                await deletePlaylist(currentPlaylistId);
                addToast('Playlist deleted');
              }}
            >
              Delete
            </Button>
            {batchActive && batchProgress && (
              <div className="flex-1 min-w-[200px] h-1 bg-mac-fill/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-mac-blue transition-all duration-300"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <TrackSkeleton count={5} />
          ) : currentPlaylistTracks.length === 0 ? (
            <EmptyState
              title="No tracks in this playlist"
              description="Import from Spotify or YouTube to add tracks"
              actionLabel="Import Playlist"
              onAction={() => openModal('import')}
            />
          ) : (
            <div className="space-y-0.5">
              {currentPlaylistTracks.map((track, index) => (
                <TrackItem
                  key={track.id}
                  track={track}
                  index={index}
                  showIndex
                  showAlbum
                  onPlay={() => playTracks(currentPlaylistTracks, index)}
                  onRemove={() => removeTrackFromPlaylist(currentPlaylistId, track.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-5 pb-3 flex items-center justify-between">
        <h1 className="text-mac-title-1 text-surface-50">Playlists</h1>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Plus size={12} />} onClick={() => setShowCreateModal(true)}>
            New Playlist
          </Button>
          <Button variant="primary" icon={<Plus size={12} />} onClick={() => openModal('import')}>
            Import
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {playlists.length === 0 ? (
          <EmptyState
            icon={<ListMusic size={28} />}
            title="No playlists yet"
            description="Create a new playlist or import one from Spotify or YouTube Music"
            actionLabel="Create Playlist"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="p-3.5 rounded-mac bg-mac-fill/20 hover:bg-mac-fill/40 border border-mac-separator/50 cursor-pointer transition-all duration-150"
                onClick={() => selectPlaylist(playlist.id)}
              >
                <div className="aspect-square rounded-mac-sm bg-surface-700 mb-2.5 flex items-center justify-center overflow-hidden">
                  {playlist.thumbnail ? (
                    <img src={playlist.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic size={36} className="text-surface-500" />
                  )}
                </div>
                <p className="text-[13px] font-medium text-surface-100 truncate">{playlist.name}</p>
                <p className="text-[11px] text-surface-400">{playlist.trackCount || 0} tracks</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Playlist" size="sm">
        <div className="space-y-4">
          <Input label="Playlist Name" placeholder="My Playlist" value={newName} onChange={setNewName} />
          <Input label="Description (optional)" placeholder="Add a description" value={newDesc} onChange={setNewDesc} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
