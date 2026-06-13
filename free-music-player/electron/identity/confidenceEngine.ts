import type {
  ScoredCandidate,
  ConfidenceResult,
  MatchStatus,
} from './types';
import { CONFIDENCE_WEIGHTS, CONFIDENCE_THRESHOLDS } from './types';

// ── Pure helpers ────────────────────────────────────────────────

/** Pure function: compute weighted confidence score from raw components. */
export function computeCandidateScore(
  candidate: Partial<ScoredCandidate>,
  weights: Partial<typeof CONFIDENCE_WEIGHTS> = {},
): number {
  const w = { ...CONFIDENCE_WEIGHTS, ...weights };
  const score =
    (candidate.durationScore ?? 0) * w.durationScore +
    (candidate.titleScore ?? 0) * w.titleScore +
    (candidate.artistScore ?? 0) * w.artistScore +
    (candidate.trustScore ?? 0) * w.trustScore +
    (candidate.consensusScore ?? 0) * w.consensusScore;
  return Math.round(Math.min(100, Math.max(0, score)));
}

/** Pure function: classify a numeric score into a MatchStatus. */
export function classifyScore(score: number): MatchStatus {
  if (score >= CONFIDENCE_THRESHOLDS.EXACT) return 'exact';
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'none';
}

// ── Class ───────────────────────────────────────────────────────

export class ConfidenceEngine {
  /**
   * Compute final confidence score for a ScoredCandidate.
   *
   * Duration score is the DOMINANT factor (40% weight). Song length is
   * the single most reliable signal — if the duration doesn't match, it
   * should drag the total down regardless of title/artist text match.
   */
  compute(candidate: ScoredCandidate, consensusScore?: number): ConfidenceResult {
    const cs = consensusScore ?? candidate.consensusScore ?? 0;

    const finalScore =
      (candidate.durationScore ?? 0) * CONFIDENCE_WEIGHTS.durationScore +
      (candidate.titleScore ?? 0) * CONFIDENCE_WEIGHTS.titleScore +
      (candidate.artistScore ?? 0) * CONFIDENCE_WEIGHTS.artistScore +
      (candidate.trustScore ?? 0) * CONFIDENCE_WEIGHTS.trustScore +
      cs * CONFIDENCE_WEIGHTS.consensusScore;

    return {
      finalScore: Math.round(Math.min(100, Math.max(0, finalScore))),
      weightedComponents: {
        titleScore: candidate.titleScore ?? 0,
        artistScore: candidate.artistScore ?? 0,
        trustScore: candidate.trustScore ?? 0,
        consensusScore: cs,
        durationScore: candidate.durationScore ?? 0,
      },
    };
  }

  /** Classify a confidence score into a MatchStatus bucket. */
  classify(score: number): MatchStatus {
    return classifyScore(score);
  }

  /**
   * Score all candidates and return them sorted descending by final confidence.
   *
   * If a `consensusResults` map is provided it will be looked up by videoId.
   * Otherwise the candidate's own `consensusScore` field is used.
   */
  rank(
    candidates: ScoredCandidate[],
    consensusResults?: Map<string, number>,
  ): ScoredCandidate[] {
    const scored = candidates.map((candidate) => {
      const cs =
        consensusResults?.get(candidate.videoId) ?? candidate.consensusScore ?? 0;
      const result = this.compute(candidate, cs);

      return {
        ...candidate,
        confidence: result.finalScore,
      } satisfies ScoredCandidate;
    });

    scored.sort((a, b) => b.confidence - a.confidence);
    return scored;
  }
}
