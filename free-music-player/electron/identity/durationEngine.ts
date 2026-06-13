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
  const tolerance = Math.max(2, localDuration * 0.015);
  const difference = Math.abs(Math.round(localDuration) - Math.round(candidateDuration));

  if (difference <= tolerance) return DurationClass.EXACT;
  if (difference <= tolerance * 2) return DurationClass.VERY_CLOSE;
  if (difference <= tolerance * 4) return DurationClass.CLOSE;
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
      return 80;
    case DurationClass.CLOSE:
      return 40;
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
   * Filter an array of candidates, removing INVALID ones and attaching
   * duration metadata to the survivors.
   */
  filter(localDuration: number, candidates: CandidateTrack[]): ScoredCandidate[] {
    const scored: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      const result = this.check(localDuration, candidate.duration);

      // Immediate rejection — no scoring, no exceptions.
      if (result.durationClass === DurationClass.INVALID) continue;

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
   * Dynamic tolerance: max(2s, 1.5% of duration).
   */
  getTolerance(duration: number): number {
    return Math.max(2, duration * 0.015);
  }
}
