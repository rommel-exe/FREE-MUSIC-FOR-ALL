import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { Track } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { formatDuration } from '@/utils/formatters';

interface TrackGridProps {
  tracks: Track[];
  onTrackClick?: (track: Track) => void;
  columns?: number;
}

export function TrackGrid({ tracks, onTrackClick, columns = 4 }: TrackGridProps) {
  const { playTracks } = usePlayerStore();

  const handleClick = (track: Track, index: number) => {
    if (onTrackClick) {
      onTrackClick(track);
    } else {
      playTracks(tracks, index);
    }
  };

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {tracks.map((track, index) => (
        <motion.div
          key={track.id}
          className="group cursor-pointer"
          whileHover={{ y: -2 }}
          onClick={() => handleClick(track, index)}
        >
          <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-800 mb-3 shadow-lg">
            {track.thumbnail ? (
              <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl text-surface-600">♪</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <motion.button
                className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </motion.button>
            </div>
          </div>
          <p className="text-sm font-medium text-white truncate">{track.title}</p>
          <p className="text-xs text-surface-500 truncate">{track.artist}</p>
          <p className="text-xs text-surface-600">{formatDuration(track.duration)}</p>
        </motion.div>
      ))}
    </div>
  );
}
