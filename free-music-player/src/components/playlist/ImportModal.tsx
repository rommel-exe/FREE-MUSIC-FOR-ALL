import React, { useState } from 'react';
import { Link, Loader2, Music, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { ipc } from '@/utils/ipc';
import { useUIStore } from '@/store/uiStore';
import { usePlaylistStore } from '@/store/playlistStore';
import { usePlayerStore } from '@/store/playerStore';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { SpotifyImportResult, YouTubeImportResult, Track } from '@/types';

type ImportStep = 'url' | 'preview' | 'importing' | 'done';

export function ImportModal() {
  const { modalOpen, closeModal, addToast } = useUIStore();
  const { createPlaylist, selectPlaylist } = usePlaylistStore();
  const { playTracks } = usePlayerStore();
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<ImportStep>('url');
  const [source, setSource] = useState<'spotify' | 'youtube' | null>(null);
  const [previewData, setPreviewData] = useState<(SpotifyImportResult | YouTubeImportResult) | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>('');
  const [importProgress, setImportProgress] = useState(0);

  const isOpen = modalOpen === 'import';

  const detectSource = (u: string): 'spotify' | 'youtube' | null => {
    if (u.includes('spotify.com') || u.includes('open.spotify.com')) return 'spotify';
    if (u.includes('youtube.com') || u.includes('music.youtube.com') || u.includes('youtu.be')) return 'youtube';
    return null;
  };

  const handleFetchPreview = async () => {
    const detected = detectSource(url);
    if (!detected) {
      addToast('Please enter a valid Spotify or YouTube Music URL', 'error');
      return;
    }
    setSource(detected);
    setStep('preview');
    try {
      if (detected === 'spotify') {
        const data = await ipc.import.importSpotifyPlaylist(url);
        setPreviewData(data);
        setNewPlaylistName(data.name);
      } else {
        const data = await ipc.import.importYouTubePlaylist(url);
        setPreviewData(data);
        setNewPlaylistName(data.name);
      }
    } catch (e: any) {
      addToast(`Failed to fetch playlist: ${e.message}`, 'error');
      setStep('url');
    }
  };

  const handleImport = async () => {
    if (!previewData) return;
    setStep('importing');
    try {
      let playlistId = targetPlaylistId;
      if (!playlistId) {
        const playlist = await createPlaylist(newPlaylistName || 'Imported Playlist');
        if (playlist) playlistId = playlist.id;
      }

      const tracks = previewData.tracks.map((t) => ({
        title: t.title,
        artist: t.artist,
        album: (t as any).album || '',
        duration: t.duration || 0,
      }));

      await ipc.import.importTracks(tracks, playlistId);
      setStep('done');
      addToast('Playlist imported successfully!', 'success');
      if (playlistId) selectPlaylist(playlistId);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (e: any) {
      addToast(`Import failed: ${e.message}`, 'error');
      setStep('preview');
    }
  };

  const handleClose = () => {
    setUrl('');
    setStep('url');
    setSource(null);
    setPreviewData(null);
    setNewPlaylistName('');
    setTargetPlaylistId('');
    closeModal();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Playlist" size="md">
      {step === 'url' && (
        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            Paste a Spotify or YouTube Music playlist URL to import tracks.
          </p>
          <Input
            icon={<Link size={16} />}
            placeholder="https://open.spotify.com/playlist/..."
            value={url}
            onChange={setUrl}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={handleFetchPreview} disabled={!url.trim()}>
              Fetch Playlist
            </Button>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50">
            {previewData.thumbnail && (
              <img src={previewData.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover" />
            )}
            <div>
              <p className="text-xs text-primary-400 uppercase">{source === 'spotify' ? 'Spotify' : 'YouTube Music'}</p>
              <p className="text-sm font-medium text-white">{previewData.name}</p>
              <p className="text-xs text-surface-500">{previewData.tracks.length} tracks</p>
            </div>
          </div>

          <Input
            label="Playlist Name"
            placeholder="Imported Playlist"
            value={newPlaylistName}
            onChange={setNewPlaylistName}
          />

          <div className="max-h-48 overflow-y-auto space-y-1">
            {previewData.tracks.slice(0, 20).map((track, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-xs">
                <span className="text-surface-600 w-6">{i + 1}</span>
                <span className="text-white truncate flex-1">{track.title}</span>
                <span className="text-surface-500 truncate">{track.artist}</span>
              </div>
            ))}
            {previewData.tracks.length > 20 && (
              <p className="text-xs text-surface-600 text-center py-2">
                ...and {previewData.tracks.length - 20} more
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep('url')}>Back</Button>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={handleImport}>
              Import {previewData.tracks.length} Tracks
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <Loader2 size={32} className="text-primary-400 animate-spin" />
          <p className="text-sm text-surface-300">Importing tracks...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center py-8 gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check size={24} className="text-green-400" />
          </div>
          <p className="text-sm text-white font-medium">Import Complete!</p>
        </div>
      )}
    </Modal>
  );
}
