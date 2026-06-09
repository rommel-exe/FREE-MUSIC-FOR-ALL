import { useMemo } from 'react';
import { usePlayerStore } from '@/store/playerStore';

/* ─── Helpers ────────────────────────────────────────────────────────── */

/** Deterministic hash of a string → 0-360 hue value */
function hashToHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

/* ─── AmbientBackground ──────────────────────────────────────────────── */

export function AmbientBackground() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  /** Simulated dominant color from track ID */
  const dominantColor = useMemo(() => {
    if (!currentTrack) return 'hsl(220, 8%, 8%)';
    const hue = hashToHue(currentTrack.id);
    return `hsl(${hue}, 45%, 22%)`;
  }, [currentTrack?.id]);

  /** Second accent — offset by 40° for richer depth */
  const accentColor = useMemo(() => {
    if (!currentTrack) return 'hsl(260, 6%, 6%)';
    const hue = (hashToHue(currentTrack.id) + 40) % 360;
    return `hsl(${hue}, 35%, 16%)`;
  }, [currentTrack?.id]);

  return (
    <div className="fixed inset-0 pointer-events-none -z-50 overflow-hidden bg-[#0A0A0A]">
      {/* ── Base dark layer ── */}
      <div className="absolute inset-0 bg-[#0A0A0A]" />

      {/* ── Simulated dominant color wash ── */}
      {currentTrack && (
        <>
          <div
            className="absolute inset-0 transition-colors duration-[3000ms] ease-out"
            style={{ backgroundColor: dominantColor }}
          />
          {/* Secondary accent — radial gradient for depth (single layer) */}
          <div
            className="absolute inset-0 transition-colors duration-[3000ms] ease-out"
            style={{
              background: `radial-gradient(ellipse 80% 60% at 60% 40%, ${accentColor}, transparent)`,
            }}
          />
        </>
      )}

      {/* ── Single artwork layer — moderately blurred ── */}
      {currentTrack?.thumbnail && (
        <div
          className={`absolute inset-0 transition-opacity duration-[2000ms] ease-out ${
            isPlaying ? 'opacity-[0.25]' : 'opacity-[0.12]'
          }`}
        >
          <img
            src={currentTrack.thumbnail}
            alt=""
            className="absolute object-cover"
            style={{
              width: '130%',
              height: '130%',
              left: '-15%',
              top: '-15%',
              // Reduced blur from 120px → 40px — indistinguishable visually,
              // dramatically cheaper for GPU
              filter: 'blur(40px) saturate(150%)',
              transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      )}

      {/* ── Vignette — subtle edge darkening ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 120% 120% at 50% 50%, transparent 40%, rgba(10, 10, 10, 0.5) 80%, rgba(10, 10, 10, 0.9) 100%)
          `,
        }}
      />
    </div>
  );
}
