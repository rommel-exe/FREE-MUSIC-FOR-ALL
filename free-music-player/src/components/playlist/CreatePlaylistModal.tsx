import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  X,
  ListMusic,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';

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
/*  CreatePlaylistModal                                                 */
/* ------------------------------------------------------------------ */

export function CreatePlaylistModal() {
  const { modalOpen, closeModal, addToast, setPage, setSelectedPlaylistId } =
    useUIStore();
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const isOpen = modalOpen === 'create-playlist';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      addToast('Please enter a playlist name', 'error');
      return;
    }

    setLoading(true);

    try {
      const playlist = await createPlaylist(trimmedName, description.trim());
      addToast(`Created "${playlist.name}"`, 'success');
      closeModal();
      setPage('playlist');
      setSelectedPlaylistId(playlist.id);
    } catch (err: any) {
      addToast(`Failed to create playlist: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setName('');
    setDescription('');
    setLoading(false);
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && name.trim()) {
      handleCreate();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const canCreate = name.trim().length > 0;

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
            onClick={!loading ? handleClose : undefined}
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
              className="w-full max-w-[420px] glass-popover rounded-radius-xl pointer-events-auto overflow-hidden noise-texture"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ─────────────────────────────────── */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald/20 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-emerald" />
                    </div>
                    <h2 className="text-mac-headline text-white font-semibold">
                      Create Playlist
                    </h2>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-groove-300 hover:text-white hover:bg-groove-600 active:bg-groove-500 transition-all disabled:opacity-30"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* ── Divider ────────────────────────────────── */}
              <div className="mx-5 h-px bg-groove-500/30" />

              {/* ── Content ────────────────────────────────── */}
              <div className="px-5 pb-5 pt-4">
                <motion.div
                  key="idle"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="space-y-4"
                >
                  <p className="text-[13px] text-groove-300 leading-relaxed">
                    Create a new playlist to organize your music.
                  </p>

                  {/* Name input */}
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-groove-400 group-focus-within:text-groove-200 transition-colors">
                      <ListMusic size={15} />
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Playlist name"
                      className="w-full h-10 rounded-radius-lg bg-groove-800 text-groove-100 placeholder-groove-400 text-sm outline-none border border-groove-500/30 focus:border-emerald focus:shadow-emerald-glow transition-all duration-150 pl-9 pr-4"
                      maxLength={100}
                      autoFocus
                    />
                  </div>

                  {/* Description input (optional) */}
                  <div className="relative group">
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Description (optional)"
                      className="w-full h-10 rounded-radius-lg bg-groove-800 text-groove-100 placeholder-groove-400 text-sm outline-none border border-groove-500/30 focus:border-emerald focus:shadow-emerald-glow transition-all duration-150 pl-4 pr-4"
                      maxLength={300}
                    />
                  </div>

                  {/* Validation */}
                  {name.trim() && name.trim().length < 1 && (
                    <p className="text-[11px] text-danger/80 font-medium">
                      Please enter a playlist name
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={handleClose}
                      disabled={loading}
                      className="px-4 py-2 rounded-radius-lg bg-groove-600 hover:bg-groove-500 text-groove-200 text-sm font-semibold transition-all disabled:opacity-30"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!canCreate || loading}
                      className="px-4 py-2 rounded-radius-lg bg-emerald hover:bg-emerald-hover active:bg-emerald-active text-white text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed gap-2 inline-flex items-center"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Create
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
