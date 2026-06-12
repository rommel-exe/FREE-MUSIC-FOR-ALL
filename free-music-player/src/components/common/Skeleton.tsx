/**
 * Skeleton — polished loading placeholders matching real component layouts.
 *
 * Uses a subtle shimmer-overlay gradient sweep instead of crude pulse.
 * Base color is groove-700, shimmer sweeps groove-600 → groove-500 → groove-600.
 */

/* ------------------------------------------------------------------ */
/*  Shimmer primitive                                                  */
/* ------------------------------------------------------------------ */

/** Wrapper that adds the moving-shimmer gradient on top of its child. */
function Shimmer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-radius-sm ${className}`}>
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
          <div className="w-4 h-3.5 bg-groove-700 rounded-radius-sm" />
        </Shimmer>
      </span>

      {/* Thumbnail (48×48, rounded-radius-sm) */}
      <Shimmer>
        <div className="w-12 h-12 rounded-radius-sm bg-groove-700" />
      </Shimmer>

      {/* Title + Artist */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Shimmer>
          <div className="h-3.5 bg-groove-700 rounded-radius-sm w-3/4" />
        </Shimmer>
        <Shimmer>
          <div className="h-3 bg-groove-700 rounded-radius-sm w-1/2" />
        </Shimmer>
      </div>

      {/* Duration */}
      <span className="w-16 hidden sm:block">
        <Shimmer>
          <div className="h-3.5 bg-groove-700 rounded-radius-sm w-10 ml-auto" />
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
          className="flex items-center gap-3 rounded-radius-md overflow-hidden"
        >
          {/* Thumbnail (48×48) */}
          <Shimmer>
            <div className="w-12 h-12 rounded-radius-sm bg-groove-700" />
          </Shimmer>

          {/* Text */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <Shimmer>
              <div className="h-3.5 bg-groove-700 rounded-radius-sm w-3/4" />
            </Shimmer>
            <Shimmer>
              <div className="h-3 bg-groove-700 rounded-radius-sm w-1/2" />
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
            <div className="w-10 h-10 rounded-radius-sm bg-groove-700" />
          </Shimmer>

          {/* Text */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <Shimmer>
              <div className="h-3.5 bg-groove-700 rounded-radius-sm w-3/4" />
            </Shimmer>
            <Shimmer>
              <div className="h-3 bg-groove-700 rounded-radius-sm w-1/2" />
            </Shimmer>
          </div>

          {/* Duration */}
          <Shimmer>
            <div className="h-3.5 bg-groove-700 rounded-radius-sm w-10" />
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
        <div className="w-full aspect-square rounded-radius-sm bg-groove-700 shadow-lg shadow-black/30" />
      </Shimmer>

      {/* Title line */}
      <Shimmer className="mb-1.5">
        <div className="h-3.5 bg-groove-700 rounded-radius-sm w-4/5" />
      </Shimmer>

      {/* Subtitle line */}
      <Shimmer>
        <div className="h-3 bg-groove-700 rounded-radius-sm w-3/5" />
      </Shimmer>
    </div>
  );
}
