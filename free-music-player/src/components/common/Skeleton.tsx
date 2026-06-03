import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  count?: number;
  className?: string;
}

export function Skeleton({ variant = 'rectangular', width, height, count = 1, className = '' }: SkeletonProps) {
  const baseClass = 'animate-pulse bg-surface-700/50 rounded';

  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${baseClass} ${variants[variant]} ${className}`}
          style={{ width: width || '100%', height: height || (variant === 'circular' ? '40px' : variant === 'text' ? '16px' : '120px') }}
        />
      ))}
    </>
  );
}

export function TrackSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg animate-pulse">
          <div className="w-10 h-10 rounded bg-surface-700/50" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-surface-700/50 rounded w-3/4" />
            <div className="h-2 bg-surface-700/50 rounded w-1/2" />
          </div>
          <div className="w-12 h-3 bg-surface-700/50 rounded" />
        </div>
      ))}
    </div>
  );
}
