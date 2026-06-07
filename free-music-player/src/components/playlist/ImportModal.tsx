import React, { useState, useEffect, useRef } from 'react';
import { Link, Loader2, Check, X, ListMusic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';

type ImportState = 'idle' | 'loading' | 'done';

function detectSource(url: string): 'spotify' | 'youtube' | null {
  const u = url.trim();
  if (u.includes('open.spotify.com') || u.includes('spotify.com')) return 'spotify';
  if (
    u.includes('youtube.com/playlist') ||
    u.includes('youtu.be/') ||
    u.includes('music.youtube.com')
  )
    return 'youtube';
  return null;
}

function isValidPlaylistUrl(url: string): boolean {
  return detectSource(url) !== null;
}

export function ImportModal() {
  const { modalOpen, closeModal, addToast, setPage, setSelectedPlaylistId } = useUIStore();
  const importAsPlaylist = useLibraryStore((s) => s.importAsPlaylist);
  const isOpen = modalOpen === 'import';

  const [url, setUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [state, setState] = useState<ImportState>('idle');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{
    playlist: { id: string; name: string; trackCount: number };
    imported: number;
    total: number;
    failed: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && state === 'idle') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, state]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setPlaylistName('');
      setState('idle');
      setProgress('');
      setResult(null);
    }
  }, [isOpen]);

  const handleImport = async () => {
    const trimmed = url.trim();
    if (!isValidPlaylistUrl(trimmed)) {
      addToast('Please enter a valid YouTube or Spotify playlist URL', 'error');
      return;
    }

    setState('loading');
    setProgress('Fetching playlist...');

    try {
      const r = await importAsPlaylist(
        trimmed,
        playlistName.trim() || undefined,
        (msg: string) => setProgress(msg),
      );
      setResult(r);
      setState('done');

      if (r.failed > 0) {
        addToast(
          `Imported ${r.imported} of ${r.total} tracks to "${r.playlist.name}" (${r.failed} failed)`,
          r.imported > 0 ? 'success' : 'error',
        );
      } else {
        addToast(
          `Imported ${r.imported} tracks to "${r.playlist.name}"`,
          'success',
        );
      }

      // Auto-close after 3s
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err: any) {
      addToast(`Import failed: ${err.message}`, 'error');
      setState('idle');
      setProgress('');
    }
  };

  const handleClose = () => {
    setUrl('');
    setPlaylistName('');
    setState('idle');
    setProgress('');
    setResult(null);
    closeModal();
  };

  const handleViewPlaylist = () => {
    if (result) {
      // Navigate to playlist page — store the selected playlist in URL or state.
      // The simplest is to set the page; the PlaylistPage can read selection from store.
      // For now, just close the modal and set the page to 'library'.
      // (Playlist page selection is handled by a separate playlist store in a fuller app.)
      setPage('playlist');
      setSelectedPlaylistId(result.playlist.id);
    }
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && state === 'idle' && url.trim()) {
      handleImport();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={state !== 'loading' ? handleClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-[480px] bg-[#141414] rounded-xl border border-white/10 shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-lg font-semibold text-white">Import Playlist</h2>
                <button
                  onClick={handleClose}
                  disabled={state === 'loading'}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 pb-5">
                {state === 'idle' && (
                  <div className="space-y-4">
                    <p className="text-sm text-white/50">
                      Paste a YouTube or Spotify playlist link. A new playlist
                      will be created in your sidebar.
                    </p>

                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                        <Link size={16} />
                      </div>
                      <input
                        ref={inputRef}
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="https://open.spotify.com/playlist/..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/10 transition-colors"
                      />
                    </div>

                    {url.trim() && !isValidPlaylistUrl(url) && (
                      <p className="text-xs text-red-400/80">
                        Please enter a YouTube or Spotify playlist URL
                      </p>
                    )}

                    {/* Optional playlist name */}
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">
                        <ListMusic size={16} />
                      </div>
                      <input
                        type="text"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Playlist name (optional — uses source name)"
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/10 transition-colors"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={!url.trim() || !isValidPlaylistUrl(url)}
                        className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Import
                      </button>
                    </div>
                  </div>
                )}

                {state === 'loading' && (
                  <div className="flex flex-col items-center py-8 gap-4">
                    <Loader2 size={32} className="text-white/60 animate-spin" />
                    <p className="text-sm text-white/60">{progress}</p>
                    <p className="text-xs text-white/30">
                      This may take a while for large playlists
                    </p>
                  </div>
                )}

                {state === 'done' && result && (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check size={24} className="text-green-400" />
                    </div>
                    <p className="text-sm text-white font-medium text-center">
                      Imported {result.imported} tracks
                    </p>
                    <p className="text-xs text-white/50 text-center">
                      to playlist <span className="text-white font-medium">"{result.playlist.name}"</span>
                    </p>
                    {result.failed > 0 && (
                      <p className="text-xs text-white/40 text-center">
                        {result.failed} tracks could not be resolved
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleViewPlaylist}
                        className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
                      >
                        View Playlist
                      </button>
                      <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
