export function SkeletonTrack() {
  return (
    <div className="flex items-center gap-4 px-6 py-2 animate-pulse">
      <div className="w-8 h-4 bg-white/10 rounded" />
      <div className="w-10 h-10 rounded bg-white/10" />
      <div className="flex-1">
        <div className="h-4 bg-white/10 rounded w-3/4 mb-1" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
      </div>
      <div className="w-16 h-4 bg-white/10 rounded" />
      <div className="w-12 h-4 bg-white/10 rounded" />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 bg-white/5 rounded-md overflow-hidden animate-pulse">
          <div className="w-12 h-12 bg-white/10" />
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded w-3/4 mb-1" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonSearchResults() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
          <div className="w-10 h-10 rounded bg-white/10" />
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded w-3/4 mb-1" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
          <div className="w-10 h-4 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}
