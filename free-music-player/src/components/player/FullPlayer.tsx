import React from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { ProgressBar } from './ProgressBar';
import { useLyrics } from '@/hooks/useLyrics';

export function FullPlayer() {
  const { currentTrack, isPlaying, progress, duration, isFullPlayerOpen, setFullPlayerOpen, togglePlay, seek, nextTrack, previousTrack } = usePlayerStore();
  const { lyrics } = useLyrics(currentTrack);

  if (!isFullPlayerOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-mac-primary flex flex-col"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Background blur */}
        <div className="absolute inset-0 overflow-hidden">
          {currentTrack?.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover scale-110 blur-3xl opacity-25" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-mac-blue/20 to-mac-primary" />
          )}
          <div className="absolute inset-0 bg-mac-primary/70" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={() => setFullPlayerOpen(false)}
            className="p-2 rounded-mac-sm hover:bg-white/5 text-surface-400 hover:text-surface-100 transition-colors duration-150 cursor-pointer"
          >
            <ChevronDown size={22} />
          </button>
          <div className="text-center">
            <p className="text-[11px] text-surface-500 uppercase tracking-wider font-medium">Now Playing</p>
          </div>
          <div className="w-10" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center gap-12 px-8 overflow-hidden">
          {/* Album art */}
          <div className="flex-shrink-0">
            <motion.div
              className="w-64 h-64 rounded-mac-lg overflow-hidden shadow-2xl shadow-black/50"
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ repeat: isPlaying ? Infinity : 0, duration: 20, ease: 'linear' }}
              style={{ borderRadius: currentTrack?.thumbnail ? '12px' : '50%' }}
            >
              {currentTrack?.thumbnail ? (
                <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-surface-700 flex items-center justify-center">
                  <span className="text-5xl text-surface-500">♪</span>
                </div>
              )}
            </motion.div>
          </div>

          {/* Track info + lyrics */}
          <div className="flex-1 max-w-md space-y-6">
            <div>
              <h2 className="text-[22px] font-bold text-surface-50">{currentTrack?.title || 'No track'}</h2>
              <p className="text-[17px] text-surface-400">{currentTrack?.artist || 'Unknown artist'}</p>
            </div>

            {lyrics && (
              <div className="h-48 overflow-y-auto scrollbar-hide space-y-2">
                {lyrics.synced ? (
                  lyrics.synced.map((line, i) => {
                    const isActive = progress >= line.time && (i === lyrics.synced!.length - 1 || progress < lyrics.synced![i + 1].time);
                    return (
                      <p
                        key={i}
                        className={`text-[13px] transition-all duration-200 cursor-pointer hover:text-surface-100 ${
                          isActive ? 'text-mac-blue text-[15px] font-medium' : 'text-surface-500'
                        }`}
                        onClick={() => seek(line.time)}
                      >
                        {line.text}
                      </p>
                    );
                  })
                ) : lyrics.plain ? (
                  <p className="text-[13px] text-surface-400 whitespace-pre-line leading-relaxed">{lyrics.plain}</p>
                ) : (
                  <p className="text-[13px] text-surface-600 italic">No lyrics available</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="relative z-10 px-12 pb-4">
          <ProgressBar progress={progress} duration={duration} onSeek={seek} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
