/**
 * Skeleton — polished loading placeholders matching real component layouts.
 *
 * Uses a subtle shimmer-overlay gradient sweep instead of crude pulse.
 * Each skeleton mirrors the exact structure of its live counterpart so
 * layout doesn't jump when real content loads.
 */

/* ------------------------------------------------------------------ */
/*  Shimmer primitive                                                  */
/* ------------------------------------------------------------------ */

/** Wrapper that adds the moving-shimmer gradient on top of its child. */
function Shimmer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
      <div className="absolute inset-0 shimmer-overlay pointer-events-none" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonTrack — matches TrackRow (number · thumb · title+artist · duration) */
/* ------------------------------------------------------------------ */

export function SkeletonTrack() {
  return (
    <div className="w-full flex items-center gap-4 px-6 py-2.5">
      {/* Number column (32px) */}
      <span className="w-8 flex justify-end">
        <Shimmer>
          <div className="w-4 h-3.5 bg-white/[0.06] rounded-sm" />
        </Shimmer>
      </span>

      {/* Thumbnail (48×48, rounded-md) */}
      <Shimmer>
        <div className="w-12 h-12 rounded-md bg-white/[0.06]" />
      </Shimmer>

      {/* Title + Artist */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Shimmer>
          <div className="h-3.5 bg-white/[0.08] rounded-sm w-3/4" />
        </Shimmer>
        <Shimmer>
          <div className="h-3 bg-white/[0.05] rounded-sm w-1/2" />
        </Shimmer>
      </div>

      {/* Duration */}
      <span className="w-16 hidden sm:block">
        <Shimmer>
          <div className="h-3.5 bg-white/[0.06] rounded-sm w-10 ml-auto" />
        </Shimmer>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonGrid — quick-play cards on the Home page                   */
/* ------------------------------------------------------------------ */

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-mac overflow-hidden"
        >
          {/* Thumbnail (48×48) */}
          <Shimmer>
            <div className="w-12 h-12 rounded-md bg-white/[0.06]" />
          </Shimmer>

          {/* Text */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <Shimmer>
              <div className="h-3.5 bg-white/[0.08] rounded-sm w-3/4" />
            </Shimmer>
            <Shimmer>
              <div className="h-3 bg-white/[0.05] rounded-sm w-1/2" />
            </Shimmer>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonSearchResults — search result rows                         */
/* ------------------------------------------------------------------ */

export function SkeletonSearchResults() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          {/* Thumbnail (40×40) */}
          <Shimmer>
            <div className="w-10 h-10 rounded-md bg-white/[0.06]" />
          </Shimmer>

          {/* Text */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <Shimmer>
              <div className="h-3.5 bg-white/[0.08] rounded-sm w-3/4" />
            </Shimmer>
            <Shimmer>
              <div className="h-3 bg-white/[0.05] rounded-sm w-1/2" />
            </Shimmer>
          </div>

          {/* Duration */}
          <Shimmer>
            <div className="h-3.5 bg-white/[0.06] rounded-sm w-10" />
          </Shimmer>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonCard — square artwork cards on the Home page               */
/* ------------------------------------------------------------------ */

export function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-[180px] p-3">
      {/* Square artwork placeholder (180px minus padding) */}
      <Shimmer className="mb-3">
        <div className="w-full aspect-square rounded-md bg-white/[0.06] shadow-lg shadow-black/30" />
      </Shimmer>

      {/* Title line */}
      <Shimmer className="mb-1.5">
        <div className="h-3.5 bg-white/[0.08] rounded-sm w-4/5" />
      </Shimmer>

      {/* Subtitle line */}
      <Shimmer>
        <div className="h-3 bg-white/[0.05] rounded-sm w-3/5" />
      </Shimmer>
    </div>
  );
}
