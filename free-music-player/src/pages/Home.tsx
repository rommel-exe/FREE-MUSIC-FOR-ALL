import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Headphones, Sparkles, ListMusic, ArrowRight, Download } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUIStore } from '@/store/uiStore';
import { Track } from '@/types';

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 p-3.5 rounded-mac bg-mac-fill/20 hover:bg-mac-fill/40 border border-mac-separator/50 transition-all duration-150 text-left cursor-pointer"
      onClick={onClick}
    >
      <div className="w-9 h-9 rounded-mac-sm bg-mac-blue/15 flex items-center justify-center text-mac-blue">
        {icon}
      </div>
      <span className="text-[13px] font-medium text-surface-200">{label}</span>
    </button>
  );
}

function HorizontalTrackList({ tracks, title, emptyMessage }: { tracks: Track[]; title: string; emptyMessage: string }) {
  const { playTracks } = usePlayerStore();

  if (tracks.length === 0) {
    return (
      <div className="py-6">
        <h3 className="text-[17px] font-semibold text-surface-100 mb-2">{title}</h3>
        <p className="text-[13px] text-surface-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[17px] font-semibold text-surface-100">{title}</h3>
        <button type="button" className="text-[13px] text-surface-400 hover:text-mac-blue transition-colors duration-150 flex items-center gap-1 cursor-pointer">
          See all <ArrowRight size={12} />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {tracks.map((track, i) => (
          <div
            key={track.id}
            className="flex-shrink-0 w-36 cursor-pointer group"
            onClick={() => playTracks(tracks, i)}
          >
            <div className="relative aspect-square rounded-mac overflow-hidden bg-surface-700 mb-2 shadow-sm">
              {track.thumbnail ? (
                <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-2xl text-surface-500">♪</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-150 flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-surface-100 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-lg transition-opacity duration-150">
                  <span className="text-surface-900 text-xs ml-0.5">▶</span>
                </div>
              </div>
            </div>
            <p className="text-[13px] text-surface-100 truncate">{track.title}</p>
            <p className="text-[11px] text-surface-400 truncate">{track.artist}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  const { recentlyPlayed, favorites, loadRecentlyPlayed, loadFavorites } = useLibraryStore();
  const { setPage, openModal } = useUIStore();

  React.useEffect(() => {
    loadRecentlyPlayed();
    loadFavorites();
  }, [loadRecentlyPlayed, loadFavorites]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full">
      <div>
        <motion.h1
          className="text-mac-large-title text-surface-50"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {greeting}
        </motion.h1>
        <p className="text-[15px] text-surface-400 mt-1">What do you want to listen to?</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <QuickAction icon={<Sparkles size={18} />} label="Search YouTube" onClick={() => setPage('search')} />
        <QuickAction icon={<ListMusic size={18} />} label="Import Playlist" onClick={() => openModal('import')} />
        <QuickAction icon={<Headphones size={18} />} label="Browse Library" onClick={() => setPage('library')} />
        <QuickAction icon={<Download size={18} />} label="Downloads" onClick={() => setPage('downloads')} />
      </div>

      <HorizontalTrackList tracks={recentlyPlayed} title="Recently Played" emptyMessage="Start listening to see your history" />
      <HorizontalTrackList tracks={favorites} title="Your Favorites" emptyMessage="Heart tracks to see them here" />

      <div className="pb-6" />
    </div>
  );
}
