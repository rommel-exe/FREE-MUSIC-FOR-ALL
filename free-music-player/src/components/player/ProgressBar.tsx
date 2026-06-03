import React, { useRef, useCallback } from 'react';
import { formatDuration } from '@/utils/formatters';

interface ProgressBarProps {
  progress: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
  showTime?: boolean;
}

export function ProgressBar({ progress, duration, onSeek, className = '', showTime = true }: ProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || !duration) return;
    const rect = ref.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  }, [duration, onSeek]);

  const pct = duration ? (progress / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showTime && <span className="text-xs text-surface-500 w-10 text-right">{formatDuration(progress)}</span>}
      <div
        ref={ref}
        className="flex-1 h-1.5 bg-surface-700/50 rounded-full cursor-pointer group hover:h-2 transition-all"
        onClick={handleClick}
      >
        <div
          className="h-full bg-primary-500 rounded-full relative transition-all"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      {showTime && <span className="text-xs text-surface-500 w-10">{formatDuration(duration)}</span>}
    </div>
  );
}
