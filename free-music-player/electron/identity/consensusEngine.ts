/**
 * ConsensusEngine — cross-references multi-strategy search results to
 * determine which videoId is most likely the correct match.
 *
 * If the same videoId appears across different search strategies, that's a
 * strong signal it's the right track. The engine computes both a raw
 * frequency-based consensus score and a weighted consensus score that
 * favours higher-specificity strategies.
 */

import type {
  CandidateProviderResult,
  ConsensusResult,
  SearchStrategy,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
//  Strategy weights — higher specificity → higher weight
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Weight map for each search strategy. More specific strategies carry more
 * weight when computing the consensus score for a videoId.
 */
export const STRATEGY_WEIGHTS: Record<SearchStrategy, number> = {
  artist_title: 1.0, // Most specific — full weight
  title_only: 0.8, // Still specific
  artist_only: 0.4, // Less specific
  artist_duration: 0.7, // Artist + duration is quite specific
  title_duration: 0.7, // Title + duration is quite specific
};

// ═══════════════════════════════════════════════════════════════════════════
//  Pure helper — compute consensus score for a single videoId
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a weighted consensus score (0–100) for a specific videoId across
 * all search results. Strategies that found the videoId are summed by weight;
 * the total is divided by the sum of all strategy weights.
 *
 * @param videoId - The videoId to score.
 * @param results - Array of candidate provider results from different strategies.
 * @returns Weighted consensus score in the range [0, 100].
 */
export function computeConsensus(
  videoId: string,
  results: CandidateProviderResult[],
): number {
  if (results.length === 0) return 0;

  let weightedScore = 0;
  let totalWeight = 0;

  for (const result of results) {
    const weight = STRATEGY_WEIGHTS[result.strategy] ?? 0.5;
    totalWeight += weight;

    if (result.candidates.some((c) => c.videoId === videoId)) {
      weightedScore += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return (weightedScore / totalWeight) * 100;
}

// ═══════════════════════════════════════════════════════════════════════════
//  ConsensusEngine class
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Runs multiple searches and cross-references results to find the videoId
 * with the strongest agreement across strategies.
 *
 * Usage:
 * ```ts
 * const engine = new ConsensusEngine();
 * const consensus = engine.compute(strategyResults);
 * const boost = engine.scoreForVideoId(consensus.bestVideoId, strategyResults);
 * ```
 */
export class ConsensusEngine {
  /**
   * Build consensus from multiple candidate provider results.
   *
   * Collects every videoId across all strategy results, counts frequency,
   * and identifies the most-agreed-upon videoId.
   *
   * @param results - One `CandidateProviderResult` per search strategy.
   * @returns A `ConsensusResult` with the best videoId and scoring details.
   */
  compute(results: CandidateProviderResult[]): ConsensusResult {
    if (results.length === 0) {
      return {
        bestVideoId: '',
        consensusScore: 0,
        totalSearches: 0,
        agreements: 0,
        videoIdFrequency: new Map(),
      };
    }

    const frequency = new Map<string, number>();
    let totalSearches = 0;

    for (const result of results) {
      totalSearches++;
      const seenInThisSearch = new Set<string>();

      for (const candidate of result.candidates) {
        const { videoId } = candidate;
        if (!videoId) continue;

        // Count each videoId at most once per strategy result to avoid
        // inflating scores when a strategy returns duplicates.
        if (seenInThisSearch.has(videoId)) continue;
        seenInThisSearch.add(videoId);

        frequency.set(videoId, (frequency.get(videoId) ?? 0) + 1);
      }
    }

    // Find the videoId with the highest frequency
    let bestVideoId = '';
    let bestCount = 0;
    for (const [videoId, count] of frequency) {
      if (count > bestCount) {
        bestCount = count;
        bestVideoId = videoId;
      }
    }

    // Consensus score = (agreements / totalSearches) * 100
    const consensusScore =
      totalSearches > 0 ? (bestCount / totalSearches) * 100 : 0;

    return {
      bestVideoId,
      consensusScore,
      totalSearches,
      agreements: bestCount,
      videoIdFrequency: frequency,
    };
  }

  /**
   * Compute a consensus score (0–100) for a specific videoId.
   *
   * Uses weighted scoring: strategies with higher specificity contribute
   * more to the final score.
   *
   * @param videoId - The videoId to evaluate.
   * @param results - Array of candidate provider results from different strategies.
   * @returns Weighted consensus score in the range [0, 100].
   */
  scoreForVideoId(
    videoId: string,
    results: CandidateProviderResult[],
  ): number {
    return computeConsensus(videoId, results);
  }
}
