import { useEffect } from 'react';
import { TitleBar } from '@/components/layout/TitleBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { NowPlayingBar } from '@/components/layout/NowPlayingBar';
import { FullPlayer } from '@/components/player/FullPlayer';
import { QueuePanel } from '@/components/player/QueuePanel';
import { ImportModal } from '@/components/playlist/ImportModal';
import { ToastContainer } from '@/components/common/Toast';
import { UpdateBanner } from '@/components/common/UpdateBanner';
import { AudioPlayer } from '@/components/player/AudioPlayer';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';

import { HomePage } from '@/pages/Home';
import { LibraryPage } from '@/pages/Library';
import { SearchPage } from '@/pages/Search';
import { PlaylistPage } from '@/pages/Playlist';
import { DownloadsPage } from '@/pages/Downloads';
import { AnalyticsPage } from '@/pages/Analytics';
import { SettingsPage } from '@/pages/Settings';

function App() {
  const { currentPage } = useUIStore();
  const { initPlayer } = usePlayerStore();
  const { loadTracks } = useLibraryStore();

  useKeyboardShortcuts();

  useEffect(() => {
    initPlayer();
    loadTracks();
  }, [initPlayer, loadTracks]);

  const pages: Record<string, React.ReactNode> = {
    home: <HomePage />,
    library: <LibraryPage />,
    search: <SearchPage />,
    playlist: <PlaylistPage />,
    downloads: <DownloadsPage />,
    analytics: <AnalyticsPage />,
    settings: <SettingsPage />,
  };

  return (
    <div className="h-screen flex flex-col bg-mac-primary overflow-hidden">
      <UpdateBanner />
      <TitleBar />

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar />

        <main className="flex-1 overflow-hidden">
          {pages[currentPage] || <HomePage />}
        </main>

        <QueuePanel />
      </div>

      <NowPlayingBar />

      <FullPlayer />
      <ImportModal />
      <ToastContainer />
      <AudioPlayer />
    </div>
  );
}

export default App;
