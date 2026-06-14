/**
 * VerificationEngine — the final safety layer in the identity pipeline.
 *
 * After candidates are scored and ranked by TitleEngine, ArtistEngine,
 * DurationEngine, and VersionEngine, VerificationEngine performs a
 * holistic check to determine whether the top candidate is safe to accept
 * or whether the result is ambiguous/rejected.
 *
 * Four checks:
 *   1. Duration consistency  — is the candidate's duration close enough?
 *   2. Artist consistency    — does the candidate's artist match?
 *   3. Version consistency   — are the versions compatible?
 *   4. Confidence separation — are the top two candidates too close?
 */

import type {
  TrackInput,
  ScoredCandidate,
  VerificationResult,
} from './types';
import { VersionClass } from './types';

// ── Constants ──────────────────────────────────────────────────────

/** Minimum confidence separation for a non-ambiguous match. */
export const VERIFICATION_SEPARATION_MIN = 8;

/**
 * Absolute duration tolerance in seconds used by the pure-function
 * fallback when no durationEngine is injected.
 */
const FALLBACK_DURATION_TOLERANCE_SECONDS = 2;

// ── Pure helper functions ──────────────────────────────────────────

/**
 * Check whether a candidate's duration is close to the local track's duration.
 *
 * Pure function — no engine dependency. Uses a simple absolute tolerance.
 * The engine-level verify() delegates to durationEngine when available
 * and falls back to this function otherwise.
 *
 * @param localDuration   - Local track duration in seconds.
 * @param candidateDuration - Candidate track duration in seconds.
 * @returns `true` if the absolute difference is within tolerance.
 */
export function checkDurationConsistency(
  localDuration: number,
  candidateDuration: number,
): boolean {
  if (localDuration <= 0 || candidateDuration <= 0) return false;
  const diff = Math.abs(localDuration - candidateDuration);
  // 1.2% tolerance (floor 2s) — matches DurationEngine.
  // Tighter than the old 1.5% but allows for encoding/platform variance.
  const tolerance = Math.max(FALLBACK_DURATION_TOLERANCE_SECONDS, localDuration * 0.012);
  return diff <= tolerance;
}

/**
 * Check whether a candidate's artist is consistent with the local artist.
 *
 * Pure function — no engine dependency. Uses case-insensitive substring
 * containment in both directions and token overlap.
 *
 * @param localArtist   - Local track artist string.
 * @param candidateArtist - Candidate track artist string.
 * @returns `true` if the artists are reasonably consistent.
 */
export function checkArtistConsistency(
  localArtist: string,
  candidateArtist: string,
): boolean {
  if (!localArtist || !candidateArtist) return false;

  const localLower = localArtist.toLowerCase().trim();
  const candLower = candidateArtist.toLowerCase().trim();

  if (!localLower || !candLower) return false;

  // Exact match
  if (localLower === candLower) return true;

  // Substring containment (either direction)
  if (candLower.includes(localLower) || localLower.includes(candLower)) return true;

  // Token overlap — require at least 50% of local tokens to appear in candidate
  const localTokens = localLower.split(/\s+/).filter(Boolean);
  const candTokens = new Set(candLower.split(/\s+/).filter(Boolean));

  if (localTokens.length === 0 || candTokens.size === 0) return false;

  const matched = localTokens.filter(t => candTokens.has(t)).length;
  return matched / localTokens.length >= 0.5;
}

/**
 * Check whether a candidate's version is compatible with the local version.
 *
 * Pure function — no engine dependency. Defines a compatibility matrix.
 *
 * @param localVersion   - Local track VersionClass.
 * @param candidateVersion - Candidate track VersionClass.
 * @returns `true` if the versions are compatible.
 */
export function checkVersionConsistency(
  localVersion: VersionClass,
  candidateVersion: VersionClass,
): boolean {
  // Unknown versions are compatible with everything
  if (
    localVersion === VersionClass.UNKNOWN ||
    candidateVersion === VersionClass.UNKNOWN
  ) {
    return true;
  }

  // Exact match is always compatible
  if (localVersion === candidateVersion) return true;

  // Compatibility matrix:
  // STUDIO is compatible with REMASTER (same core recording)
  if (
    (localVersion === VersionClass.STUDIO && candidateVersion === VersionClass.REMASTER) ||
    (localVersion === VersionClass.REMASTER && candidateVersion === VersionClass.STUDIO)
  ) {
    return true;
  }

  // Everything else is incompatible:
  // LIVE, ACOUSTIC, REMIX, KARAOKE, INSTRUMENTAL, EXTENDED are distinct versions
  return false;
}

// ── Confidence separation helper ───────────────────────────────────

/**
 * Compute the dynamic minimum separation threshold based on the top
 * candidate's absolute confidence.
 *
 * Higher absolute confidence needs less separation:
 *   - Top score 98 → minSeparation ≈ 10
 *   - Top score 75 → minSeparation ≈ 12.5
 *   - Top score 50 → minSeparation ≈ 15
 *   - Floor at 5
 *
 * @param topConfidence - Confidence score of the #1 candidate.
 * @returns The minimum required separation (in confidence points).
 */
function computeDynamicMinSeparation(topConfidence: number): number {
  return Math.max(5, 20 - topConfidence / 10);
}

// ═══════════════════════════════════════════════════════════════════════════
//  VerificationEngine
// ═══════════════════════════════════════════════════════════════════════════

export class VerificationEngine {
  constructor(
    private durationEngine: any,
    private titleEngine: any,
    private artistEngine: any,
    private versionEngine: any,
  ) {}

  // ── Full verification pipeline ────────────────────────────────────

  /**
   * Run the complete verification pipeline on the top candidate.
   *
   * @param localTrack  - The local track metadata.
   * @param candidates  - Scored candidates (assumed pre-sorted by confidence).
   * @param titleEngine - TitleEngine instance (unused directly but kept for API consistency).
   * @param artistEngine - ArtistEngine instance (must expose `containsArtist()`).
   * @param versionEngine - VersionEngine instance (must expose `check()`).
   * @param durationEngine - DurationEngine instance (must expose `check()`).
   * @returns VerificationResult indicating pass/ambiguous/reject.
   */
  verify(
    localTrack: TrackInput,
    candidates: ScoredCandidate[],
    titleEngine: any,
    artistEngine: any,
    versionEngine: any,
    durationEngine: any,
  ): VerificationResult {
    // ── Guard: no candidates ──
    if (!candidates || candidates.length === 0) {
      return {
        passed: false,
        status: 'rejected',
        confidenceSeparation: 0,
        reason: 'no candidates',
      };
    }

    // Top candidate (already sorted by confidence descending)
    const top = candidates[0];

    // ── 1. Duration consistency (skip when local duration is unknown) ──
    const hasDuration = localTrack.duration && localTrack.duration > 0;
    if (hasDuration) {
      const durationConsistent = this.checkDuration(
        localTrack,
        top,
        durationEngine,
      );
      if (!durationConsistent) {
        return {
          passed: false,
          status: 'rejected',
          confidenceSeparation: 0,
          reason: `duration mismatch: local=${localTrack.duration}s candidate=${top.duration}s`,
        };
      }
    }

    // ── 2. Artist consistency ──
    const artistConsistent = this.checkArtist(
      localTrack,
      top,
      artistEngine,
    );
    if (!artistConsistent) {
      return {
        passed: false,
        status: 'rejected',
        confidenceSeparation: 0,
        reason: `artist mismatch: local="${localTrack.artist}" candidate="${top.artist}"`,
      };
    }

    // ── 3. Version consistency ──
    const versionConsistent = this.checkVersion(
      top,
      versionEngine,
    );
    if (!versionConsistent) {
      return {
        passed: false,
        status: 'rejected',
        confidenceSeparation: 0,
        reason: `version incompatible: candidate version "${top.versionClass}" rejected`,
      };
    }

    // ── 4. Confidence separation ──
    const sepResult = this.checkConfidenceSeparation(candidates);
    if (!sepResult.ok) {
      return {
        passed: false,
        status: 'ambiguous',
        confidenceSeparation: sepResult.separation,
        reason: `confidence separation too low: ${sepResult.separation.toFixed(1)} points`,
      };
    }

    // ── All checks passed ──
    return {
      passed: true,
      status: 'verified',
      confidenceSeparation: sepResult.separation,
    };
  }

  // ── Confidence separation check ───────────────────────────────────

  /**
   * Check whether the top two candidates are sufficiently separated
   * in confidence score.
   *
   * - < 2 candidates → ok (not enough data to be ambiguous), separation = 100
   * - Separation < dynamic threshold → ambiguous
   * - Separation >= dynamic threshold → ok
   *
   * @param candidates - Scored candidates (sorted by confidence descending).
   * @returns `{ ok, separation }` where `ok` means NOT ambiguous.
   */
  checkConfidenceSeparation(
    candidates: ScoredCandidate[],
  ): { ok: boolean; separation: number } {
    // Not enough candidates to be ambiguous
    if (!candidates || candidates.length < 2) {
      return { ok: true, separation: 100 };
    }

    // Sort by confidence descending to be safe (in case caller didn't sort)
    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);

    const rawSeparation = sorted[0].confidence - sorted[1].confidence;

    // Dynamic threshold: higher top confidence → lower bar for separation
    const minSeparation = computeDynamicMinSeparation(sorted[0].confidence);

    // Clamp separation to [0, 100]
    const separation = Math.max(0, Math.min(100, rawSeparation));

    return {
      ok: separation >= minSeparation,
      separation,
    };
  }

  // ── Quick pass/fail ───────────────────────────────────────────────

  /**
   * Quick pass/fail check on a verification result.
   *
   * @param result - A VerificationResult from verify().
   * @returns `true` if the result passed all checks.
   */
  isMatchSafe(result: VerificationResult): boolean {
    return result.passed;
  }

  // ── Private helpers ───────────────────────────────────────────────

  /**
   * Check duration consistency, preferring durationEngine when available.
   */
  private checkDuration(
    localTrack: TrackInput,
    candidate: ScoredCandidate,
    durationEngine: any,
  ): boolean {
    // Try engine first
    if (durationEngine && typeof durationEngine.check === 'function') {
      try {
        const check = durationEngine.check(localTrack.duration, candidate.duration);
        // Engine may return a DurationCheck object or a boolean
        if (typeof check === 'boolean') return check;
        if (check && typeof check === 'object') {
          // DurationCheck has a durationClass field
          return check.durationClass !== 'invalid';
        }
      } catch {
        // Fall through to pure function
      }
    }

    // Fallback: use the pure function
    return checkDurationConsistency(localTrack.duration, candidate.duration);
  }

  /**
   * Check artist consistency, preferring artistEngine when available.
   */
  private checkArtist(
    localTrack: TrackInput,
    candidate: ScoredCandidate,
    artistEngine: any,
  ): boolean {
    // Try engine first
    if (artistEngine && typeof artistEngine.containsArtist === 'function') {
      try {
        const result = artistEngine.containsArtist(
          localTrack.artist,
          candidate.artist,
        );
        if (typeof result === 'boolean') return result;
        // Engine may return a score or object with a `.match` field
        if (result && typeof result === 'object' && typeof result.match === 'boolean') {
          return result.match;
        }
      } catch {
        // Fall through to pure function
      }
    }

    // Fallback: use the pure function
    return checkArtistConsistency(localTrack.artist, candidate.artist);
  }

  /**
   * Check version compatibility, preferring versionEngine when available.
   */
  private checkVersion(
    candidate: ScoredCandidate,
    versionEngine: any,
  ): boolean {
    // Try engine first
    if (versionEngine && typeof versionEngine.check === 'function') {
      try {
        const result = versionEngine.check(
          candidate.versionClass,
        );
        // Engine may return a boolean or a VersionMatchResult
        if (typeof result === 'boolean') return result;
        if (result && typeof result === 'object' && typeof result.compatible === 'boolean') {
          return result.compatible;
        }
      } catch {
        // Fall through to pure function
      }
    }

    // Fallback: assume STUDIO vs candidate version
    return checkVersionConsistency(VersionClass.STUDIO, candidate.versionClass);
  }
}
