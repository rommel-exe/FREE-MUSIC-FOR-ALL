import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/store/uiStore';
import { useLibraryStore } from '@/store/libraryStore';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'library', label: 'Your Library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
];

export function Sidebar() {
  const { currentPage, setPage, openModal } = useUIStore(
    useShallow((s) => ({ currentPage: s.currentPage, setPage: s.setPage, openModal: s.openModal })),
  );
  const tracks = useLibraryStore((s) => s.tracks);
  const playlists = useLibraryStore((s) => s.playlists);
  const loadPlaylists = useLibraryStore((s) => s.loadPlaylists);

  // Load playlists when the sidebar mounts
  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handlePlaylistClick = (playlistId: string) => {
    // Stash the selected playlist id for PlaylistPage to read, then navigate
    (window as any).__selectedPlaylistId = playlistId;
    setPage('playlist');
  };

  return (
    <aside className="w-60 bg-[#0a0a0a] border-r border-white/5 flex flex-col h-full">
      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentPage === item.id
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-white/5" />

      {/* Playlists */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Playlists</h3>
          {/* Import button — opens the import modal for YouTube/Spotify playlists */}
          <button
            onClick={() => openModal('import')}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            title="Import playlist"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="space-y-0.5">
          <PlaylistItem name="Liked Songs" count={tracks.filter((t) => t.isFavorite).length} />
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => handlePlaylistClick(pl.id)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {pl.thumbnail ? (
                  <img
                    src={pl.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-4 h-4 text-white/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                )}
              </div>
              <div className="text-left min-w-0">
                <div className="text-sm truncate">{pl.name}</div>
                <div className="text-xs text-white/30">{pl.trackCount ?? 0} songs</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Library stats */}
      <div className="p-3 border-t border-white/5">
        <div className="text-xs text-white/30">
          {tracks.length} songs in library
        </div>
      </div>
    </aside>
  );
}

function PlaylistItem({ name, count }: { name: string; count: number }) {
  return (
    <button className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors">
      <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      <div className="text-left min-w-0">
        <div className="text-sm truncate">{name}</div>
        <div className="text-xs text-white/30">{count} songs</div>
      </div>
    </button>
  );
}
