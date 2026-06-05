import { useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';

export function LyricsOverlay() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const progress = usePlayerStore((s) => s.progress);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!currentTrack) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none"
      style={{
        background: currentTrack.thumbnail
          ? `url(${currentTrack.thumbnail}) center/cover blur-60px brightness-30%`
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      }}
    >
      {/* Progress glow */}
      <div className="absolute bottom-0 left-0 right-0 h-1">
        <div
          className="h-full bg-gradient-to-r from-green-500/50 to-green-400/80 transition-all duration-1000"
          style={{ width: `${currentTrack.duration ? (progress / currentTrack.duration) * 100 : 0}%` }}
        />
      </div>

      {/* Track info overlay */}
      <div className="text-center mb-8">
        <div className="text-2xl font-bold text-white drop-shadow-lg">{currentTrack.title}</div>
        <div className="text-lg text-white/70 mt-2 drop-shadow-lg">{currentTrack.artist}</div>
      </div>
    </div>
  );
}
