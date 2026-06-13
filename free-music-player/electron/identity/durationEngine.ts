import {
  DurationClass,
  DurationCheck,
  CandidateTrack,
  ScoredCandidate,
  VersionClass,
} from './types';

// ── Pure functions ────────────────────────────────────────────────

/**
 * Classify the duration relationship between a local track and a candidate.
 */
export function classifyDuration(
  localDuration: number,
  candidateDuration: number,
): DurationClass {
  // 1.2% tolerance (floor 2s) — tighter than the old 1.5% but still accounts
  // for real-world encoding/platform variance (±2-3s is common for same track).
  const tolerance = Math.max(2, localDuration * 0.012);
  const difference = Math.abs(Math.round(localDuration) - Math.round(candidateDuration));

  if (difference <= tolerance) return DurationClass.EXACT;
  // VERY_CLOSE is 2× tolerance — still accepted but scores lower.
  // Everything else (former CLOSE / INVALID) is rejected by the filter below.
  if (difference <= tolerance * 2) return DurationClass.VERY_CLOSE;
  return DurationClass.INVALID;
}

/**
 * Map a DurationClass to a numeric score (0–100).
 */
export function computeDurationScore(durationClass: DurationClass): number {
  switch (durationClass) {
    case DurationClass.EXACT:
      return 100;
    case DurationClass.VERY_CLOSE:
      return 60; // lowered from 80 — even "very close" should drag confidence
    case DurationClass.CLOSE:
    case DurationClass.INVALID:
      return 0;
  }
}

/**
 * Quick boolean check — is the candidate duration compatible at all?
 */
export function isDurationCompatible(
  localDuration: number,
  candidateDuration: number,
): boolean {
  return classifyDuration(localDuration, candidateDuration) !== DurationClass.INVALID;
}

// ── Engine ────────────────────────────────────────────────────────

export class DurationEngine {
  /**
   * Full duration check returning class, tolerance, and absolute difference.
   */
  check(localDuration: number, candidateDuration: number): DurationCheck {
    const tolerance = this.getTolerance(localDuration);
    const difference = Math.abs(Math.round(localDuration) - Math.round(candidateDuration));
    const durationClass = classifyDuration(localDuration, candidateDuration);

    return { durationClass, tolerance, difference };
  }

  /**
   * Filter an array of candidates, keeping ONLY EXACT and VERY_CLOSE
   * duration matches. CLOSE and INVALID are rejected — if the length
   * isn't nearly identical, it's the wrong track.
   */
  filter(localDuration: number, candidates: CandidateTrack[]): ScoredCandidate[] {
    const scored: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      const result = this.check(localDuration, candidate.duration);

      // Reject INVALID and CLOSE — only EXACT and VERY_CLOSE survive.
      if (
        result.durationClass === DurationClass.INVALID ||
        result.durationClass === DurationClass.CLOSE
      ) continue;

      scored.push({
        ...candidate,
        trustScore: 0,
        durationScore: computeDurationScore(result.durationClass),
        durationClass: result.durationClass,
        titleScore: 0,
        artistScore: 0,
        versionClass: VersionClass.UNKNOWN,
        confidence: 0,
        consensusScore: 0,
      });
    }

    return scored;
  }

  /**
   * Dynamic tolerance: max(2s, 1.2% of duration).
   * Tight enough to reject wrong tracks, loose enough to accept encoding
   * variance across platforms (±2-3s for the same recording).
   */
  getTolerance(duration: number): number {
    return Math.max(2, duration * 0.012);
  }
}
