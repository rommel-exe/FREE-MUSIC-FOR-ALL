import React, { useState, useEffect, useRef } from 'react';
import {
  Link,
  Loader2,
  Check,
  X,
  ListMusic,
  Music,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Animation variants                                                  */
/* ------------------------------------------------------------------ */

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { duration: 0.12, ease: [0.4, 0, 1, 1] as const },
  },
};

const contentVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, delay: 0.05, ease: [0.4, 0, 0.2, 1] as const },
  },
};

/* ------------------------------------------------------------------ */
/*  ImportModal                                                         */
/* ------------------------------------------------------------------ */

export function ImportModal() {
  const { modalOpen, closeModal, addToast, setPage, setSelectedPlaylistId } =
    useUIStore();
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
      setTimeout(() => inputRef.current?.focus(), 150);
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

  const canImport = url.trim() && isValidPlaylistUrl(url);
  const source = url.trim() ? detectSource(url) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ──────────────────────────────────── */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
            onClick={state !== 'loading' ? handleClose : undefined}
          />

          {/* ── Modal container ───────────────────────────── */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-[480px] glass-popover rounded-mac-xl pointer-events-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ─────────────────────────────────── */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-mac-blue/20 flex items-center justify-center">
                      <Music className="w-4 h-4 text-mac-blue" />
                    </div>
                    <h2 className="text-mac-headline text-white font-semibold">
                      Import Playlist
                    </h2>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={state === 'loading'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.12] transition-all disabled:opacity-30"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* ── Divider ────────────────────────────────── */}
              <div className="mx-5 h-px bg-white/[0.06]" />

              {/* ── Content ────────────────────────────────── */}
              <div className="px-5 pb-5 pt-4">
                <AnimatePresence mode="wait">
                  {/* ── Idle state ─────────────────────────── */}
                  {state === 'idle' && (
                    <motion.div
                      key="idle"
                      variants={contentVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      className="space-y-4"
                    >
                      <p className="text-[13px] text-white/45 leading-relaxed">
                        Paste a YouTube or Spotify playlist link. A new playlist
                        will be created in your sidebar.
                      </p>

                      {/* URL input */}
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-mac-blue transition-colors">
                          <Link size={15} />
                        </div>
                        <input
                          ref={inputRef}
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="https://open.spotify.com/playlist/..."
                          className="mac-input pl-9 pr-4"
                        />
                        {source && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.08] text-white/40">
                              {source}
                            </span>
                          </motion.div>
                        )}
                      </div>

                      {/* Validation error */}
                      {url.trim() && !isValidPlaylistUrl(url) && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[11px] text-red-400/80 font-medium"
                        >
                          Please enter a YouTube or Spotify playlist URL
                        </motion.p>
                      )}

                      {/* Optional playlist name */}
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-white/50 transition-colors">
                          <ListMusic size={15} />
                        </div>
                        <input
                          type="text"
                          value={playlistName}
                          onChange={(e) => setPlaylistName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Playlist name (optional)"
                          className="mac-input pl-9 pr-4"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={handleClose}
                          className="mac-button-ghost"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleImport}
                          disabled={!canImport}
                          className="mac-button-primary disabled:opacity-30 disabled:cursor-not-allowed gap-2"
                        >
                          Import
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Loading state ─────────────────────── */}
                  {state === 'loading' && (
                    <motion.div
                      key="loading"
                      variants={contentVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      className="flex flex-col items-center py-10 gap-4"
                    >
                      <div className="relative">
                        <Loader2
                          size={40}
                          className="text-mac-blue/70 animate-spin"
                        />
                        {/* Decorative ring */}
                        <div className="absolute inset-0 rounded-full border-2 border-mac-blue/10 animate-ping" />
                      </div>
                      <div className="text-center space-y-1.5">
                        <p className="text-[13px] text-white/70 font-medium">
                          {progress}
                        </p>
                        <p className="text-[11px] text-white/30">
                          This may take a while for large playlists
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Done state ────────────────────────── */}
                  {state === 'done' && result && (
                    <motion.div
                      key="done"
                      variants={contentVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      className="flex flex-col items-center py-8 gap-3"
                    >
                      {/* Success indicator */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 300,
                          damping: 20,
                          delay: 0.1,
                        }}
                        className="w-14 h-14 rounded-2xl bg-green-500/15 flex items-center justify-center ring-1 ring-green-500/20"
                      >
                        <Check size={26} className="text-green-400" />
                      </motion.div>

                      <p className="text-[15px] text-white font-semibold text-center">
                        Imported {result.imported} tracks
                      </p>
                      <p className="text-[12px] text-white/45 text-center">
                        to{' '}
                        <span className="text-white/70 font-medium">
                          "{result.playlist.name}"
                        </span>
                      </p>
                      {result.failed > 0 && (
                        <p className="text-[11px] text-white/35 text-center">
                          {result.failed} tracks could not be resolved
                        </p>
                      )}

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleViewPlaylist}
                          className="mac-button-primary"
                        >
                          View Playlist
                        </button>
                        <button onClick={handleClose} className="mac-button-ghost">
                          Close
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
