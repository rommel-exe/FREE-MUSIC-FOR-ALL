import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TitleBar } from '@/components/layout/TitleBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { NowPlayingBar } from '@/components/layout/NowPlayingBar';
import { AudioPlayer } from '@/components/player/AudioPlayer';
import { QueuePanel } from '@/components/player/QueuePanel';
import { LyricsPanel } from '@/components/player/LyricsPanel';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { ImportModal } from '@/components/playlist/ImportModal';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

import { HomePage } from '@/pages/Home';
import { LibraryPage } from '@/pages/Library';
import { SearchPage } from '@/pages/Search';
import { PlaylistPage } from '@/pages/Playlist';

function App() {
  const currentPage = useUIStore((s) => s.currentPage);
  const loadTracks = useLibraryStore((s) => s.loadTracks);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  // Selectors with useShallow so App only re-renders when these specific
  // values change (NOT on every progress tick from setProgress).
  const { restoreSession, isFullPlayerOpen, currentTrack, togglePlay, nextTrack, previousTrack } =
    usePlayerStore(
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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearchFocus: () => {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    },
  });

  // Restore session on mount
  useEffect(() => {
    restoreSession();
    loadTracks();
  }, [restoreSession, loadTracks]);

  // Handle favorite toggle from keyboard shortcut
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

  // Listen for Electron global shortcuts
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGlobalShortcut) return;

    const playPauseHandler = () => togglePlay();
    const nextHandler = () => nextTrack();
    const prevHandler = () => previousTrack();
    const pauseHandler = () => usePlayerStore.getState().pause();

    api.onGlobalShortcut('global:playPause', playPauseHandler);
    api.onGlobalShortcut('global:nextTrack', nextHandler);
    api.onGlobalShortcut('global:previousTrack', prevHandler);
    api.onGlobalShortcut('global:pause', pauseHandler);

    return () => {};
  }, [togglePlay, nextTrack, previousTrack]);

  // Mini player mode
  if (isFullPlayerOpen && currentTrack) {
    return <MiniPlayer />;
  }

  const pages: Record<string, React.ReactNode> = {
    home: <HomePage />,
    library: <LibraryPage />,
    search: <SearchPage inputRef={searchInputRef} />,
    playlist: <PlaylistPage />,
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      <TitleBar />

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar />

        <main className="flex-1 overflow-hidden">
          {pages[currentPage] || <HomePage />}
        </main>

        <QueuePanel />
      </div>

      <NowPlayingBar />
      <AudioPlayer />
      <ImportModal />
    </div>
  );
}

export default App;
