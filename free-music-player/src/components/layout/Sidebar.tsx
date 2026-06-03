import React from 'react';
import { Home, Search, Music, Download, Settings, Plus, ChevronLeft, ChevronRight, ListMusic, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { usePlaylistStore } from '@/store/playlistStore';

export function Sidebar() {
  const { currentPage, setPage, sidebarCollapsed, toggleSidebar, openModal } = useUIStore();
  const { playlists, loadPlaylists } = usePlaylistStore();

  React.useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Music },
  ];

  const bottomItems = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'downloads', label: 'Downloads', icon: Download },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const width = sidebarCollapsed ? 60 : 220;

  return (
    <motion.aside
      className="h-full glass-sidebar flex flex-col overflow-hidden flex-shrink-0"
      animate={{ width }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="flex-1 py-2 overflow-y-auto">
        <nav className="px-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-[6px] rounded-md text-[13px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-mac-blue/10 text-mac-blue'
                    : 'text-surface-300 hover:text-surface-100 hover:bg-white/5'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <>
            <div className="px-4 mt-5 mb-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Playlists</h3>
                <button
                  type="button"
                  onClick={() => openModal('import')}
                  className="p-0.5 rounded hover:bg-white/5 text-surface-500 hover:text-surface-200 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <nav className="px-2 space-y-0.5">
              {playlists.map((playlist) => (
                <button
                  type="button"
                  key={playlist.id}
                  onClick={() => {
                    setPage('playlist');
                    usePlaylistStore.getState().selectPlaylist(playlist.id);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-[5px] rounded-md text-[13px] text-surface-300 hover:text-surface-100 hover:bg-white/5 transition-colors duration-150"
                >
                  {playlist.thumbnail ? (
                    <img src={playlist.thumbnail} alt="" className="w-5 h-5 rounded object-cover" />
                  ) : (
                    <ListMusic size={18} strokeWidth={1.8} />
                  )}
                  <span className="truncate">{playlist.name}</span>
                </button>
              ))}

              {playlists.length === 0 && (
                <div className="px-3 py-3 text-center">
                  <p className="text-[11px] text-surface-500">No playlists yet</p>
                </div>
              )}
            </nav>
          </>
        )}
      </div>

      <div className="px-2 py-2 border-t border-mac-separator space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-[6px] rounded-md text-[13px] transition-colors duration-150 ${
                isActive
                  ? 'bg-mac-blue/10 text-mac-blue'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-white/5'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}

        <button
          type="button"
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-3 px-3 py-[6px] rounded-md text-[13px] text-surface-500 hover:text-surface-300 hover:bg-white/5 transition-colors duration-150"
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
