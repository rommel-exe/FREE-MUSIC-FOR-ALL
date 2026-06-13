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
  // 1% tolerance (floor 1s) — tighter than the old 1.5%. Song length must be
  // nearly identical to be the same recording.
  const tolerance = Math.max(1, localDuration * 0.01);
  const difference = Math.abs(Math.round(localDuration) - Math.round(candidateDuration));

  if (difference <= tolerance) return DurationClass.EXACT;
  // VERY_CLOSE is 2× tolerance — still accepted but scores lower.
  // CLOSE and INVALID are both rejected by the filter below.
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
   * Dynamic tolerance: max(1s, 1% of duration).
   * Tighter than the old 1.5% — song length must be nearly identical.
   */
  getTolerance(duration: number): number {
    return Math.max(1, duration * 0.01);
  }
}
