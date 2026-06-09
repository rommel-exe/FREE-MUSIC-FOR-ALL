import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, motion } from 'framer-motion';
import { CompactNav } from '@/components/layout/CompactNav';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { FloatingPlayer } from '@/components/player/FloatingPlayer';

import { QueuePanel } from '@/components/player/QueuePanel';
import { LyricsPanel } from '@/components/player/LyricsPanel';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { ImportModal } from '@/components/playlist/ImportModal';
import { CreatePlaylistModal } from '@/components/playlist/CreatePlaylistModal';
import { UpdateBanner } from '@/components/update/UpdateBanner';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDownloadStore } from '@/store/downloadStore';
import { useUpdateStore } from '@/store/updateStore';

import { HomePage } from '@/pages/Home';
import { LibraryPage } from '@/pages/Library';
import { SearchPage } from '@/pages/Search';
import { PlaylistPage } from '@/pages/Playlist';
import { DownloadsPage } from '@/pages/Downloads';

/* ─── Page transition variants — lightweight (no blur filter) ────────── */

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  type: 'tween' as const,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  duration: 0.18,
};

/* ─── App ────────────────────────────────────────────────────────────── */

function App() {
  const currentPage = useUIStore((s) => s.currentPage);
  const loadTracks = useLibraryStore((s) => s.loadTracks);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const {
    restoreSession,
    isFullPlayerOpen,
    currentTrack,
    togglePlay,
    nextTrack,
    previousTrack,
  } = usePlayerStore(
    useShallow((s) => ({
      restoreSession: s.restoreSession,
      isFullPlayerOpen: s.isFullPlayerOpen,
      currentTrack: s.currentTrack,
      togglePlay: s.togglePlay,
      nextTrack: s.nextTrack,
      previousTrack: s.previousTrack,
    })),
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Keyboard shortcuts ── */
  useKeyboardShortcuts({
    onSearchFocus: () => {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    },
  });

  /* ── Restore session on mount ── */
  useEffect(() => {
    restoreSession();
    loadTracks();
    useDownloadStore.getState().hydrate();
    useUpdateStore.getState().init();
  }, [restoreSession, loadTracks]);

  /* ── Favorite toggle from keyboard shortcut ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        toggleFavorite(customEvent.detail);
      }
    };
    window.addEventListener('toggle-favorite', handler);
    return () => window.removeEventListener('toggle-favorite', handler);
  }, [toggleFavorite]);

  /* ── Electron global shortcuts ── */
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGlobalShortcut) return;

    const cleanupFns: (() => void)[] = [];
    const registrations = [
      { channel: 'global:playPause', handler: () => togglePlay() },
      { channel: 'global:nextTrack', handler: () => nextTrack() },
      { channel: 'global:previousTrack', handler: () => previousTrack() },
      { channel: 'global:pause', handler: () => usePlayerStore.getState().pause() },
    ];

    for (const { channel, handler } of registrations) {
      const remove = api.onGlobalShortcut(channel, handler);
      if (remove) cleanupFns.push(remove);
    }

    return () => {
      for (const cleanup of cleanupFns) {
        cleanup();
      }
    };
  }, [togglePlay, nextTrack, previousTrack]);

  /* ── Mini player early return ── */
  if (isFullPlayerOpen && currentTrack) {
    return <MiniPlayer />;
  }

  /* ── Page map ── */
  const pages: Record<string, React.ReactNode> = {
    home: <HomePage />,
    library: <LibraryPage />,
    search: <SearchPage inputRef={searchInputRef} />,
    playlist: <PlaylistPage />,
    downloads: <DownloadsPage />,
  };

  return (
    <div className="h-screen flex bg-transparent overflow-hidden relative">
      {/* Background — deepest layer */}
      <AmbientBackground />

      {/* Dock Nav */}
      <CompactNav />

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentPage}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="h-full"
          >
            {pages[currentPage] || <HomePage />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Panels — slide out from right */}
      <QueuePanel />
      <LyricsPanel />

      {/* Floating player — always on top */}
      <FloatingPlayer />

      {/* Update banner — above floating player */}
      <UpdateBanner />

      {/* Modals */}
      <ImportModal />
      <CreatePlaylistModal />
    </div>
  );
}

export default App;
