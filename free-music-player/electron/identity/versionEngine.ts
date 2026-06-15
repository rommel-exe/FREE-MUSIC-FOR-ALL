/**
 * Version detection and compatibility engine.
 *
 * Determines what "version" of a track a candidate is (studio, live, remix,
 * acoustic, etc.) and checks whether it's compatible with the local track's
 * version. The local track is assumed to be STUDIO unless detected otherwise.
 *
 * Detection runs on the title (primary signal) and optionally the channel name
 * (secondary signal). The first matching priority class wins.
 */

import { VersionClass, VersionMatchResult } from './types';

// ═══════════════════════════════════════════════════════════════════════════
//  Regex Patterns
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compiled regex patterns keyed by VersionClass.
 *
 * Each pattern tests the LOWERCASE title + artist string.
 * Patterns are ordered by detection priority (checked first → last).
 */
export const VERSION_PATTERNS: Record<VersionClass, RegExp> = {
  [VersionClass.KARAOKE]:
    /\b(karaoke|minus\s*one|off\s*vocal|backing\s*track)\b/i,
  [VersionClass.INSTRUMENTAL]:
    /\b(instrumental(?:\s+version)?|instrumental\s+mix)\b/i,
  [VersionClass.LIVE]:
    /\b(live|concert|live\s+at|live\s+from|live\s+in|live\s+session|live\s+performance|live\s+recording|live\s+version|on\s+tour|tour\s+edition)\b/i,
  [VersionClass.ACOUSTIC]:
    /\b(acoustic|unplugged|stripped|acoustic\s+version|acoustic\s+session)\b/i,
  [VersionClass.REMIX]:
    /\b(remix|remixed|rework|reworked|reimagined|reinterpreted|bootleg|dub\s+mix|club\s+mix|radio\s+mix|dance\s+mix|vip\s+mix|flip|edit)\b/i,
  [VersionClass.EXTENDED]:
    /\b(extended(?:\s+mix)?|extended\s+version|long\s+version|12\s*["″]|12\s*inch)\b/i,
  [VersionClass.REMASTER]:
    /\b(remaster|remastered|remastered\s+version|\d{4}\s+remaster|anniversary\s+edition|deluxe\s+edition|expanded\s+edition|digitally\s+remastered)\b/i,
  [VersionClass.STUDIO]: /$^/, // never matches — sentinel
  [VersionClass.UNKNOWN]: /$^/, // never matches — sentinel
};

/**
 * Detection priority order. First match wins.
 * KARAOKE is checked before INSTRUMENTAL because "karaoke" in the title
 * should classify as KARAOKE even if "instrumental" also appears.
 */
const DETECTION_PRIORITY: VersionClass[] = [
  VersionClass.KARAOKE,
  VersionClass.INSTRUMENTAL,
  VersionClass.LIVE,
  VersionClass.ACOUSTIC,
  VersionClass.REMIX,
  VersionClass.EXTENDED,
  VersionClass.REMASTER,
];

/**
 * REMIX exception patterns — substrings that should NOT trigger REMIX detection.
 * e.g. "remaster" / "remastered" contain "remix"-adjacent substrings but are
 * actually REMASTER class.
 */
const REMIX_EXCEPTIONS = /\b(remaster(?:ed)?)\b/i;

// ═══════════════════════════════════════════════════════════════════════════
//  Compatibility Matrix
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compatibility matrix: `COMPATIBILITY_MATRIX[local][candidate]`.
 *
 * - `true`  → the candidate is a valid substitute for the local track
 * - `false` → the candidate should be rejected
 *
 * Rules:
 *   STUDIO ↔ STUDIO        ✓
 *   STUDIO ↔ REMASTER       ✓  (same song, better fidelity)
 *   STUDIO ↔ UNKNOWN        ✓  (no info to reject)
 *   STUDIO ↔ everything else ✗
 */
export const COMPATIBILITY_MATRIX: Record<VersionClass, Record<VersionClass, boolean>> =
  (() => {
    // Start with everything false
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const a of Object.values(VersionClass)) {
      matrix[a] = {};
      for (const b of Object.values(VersionClass)) {
        matrix[a][b] = false;
      }
    }

    // Fill in the compatible pairs
    // STUDIO is compatible with itself, REMASTER, and UNKNOWN
    matrix[VersionClass.STUDIO][VersionClass.STUDIO] = true;
    matrix[VersionClass.STUDIO][VersionClass.REMASTER] = true;
    matrix[VersionClass.STUDIO][VersionClass.UNKNOWN] = true;

    // REMASTER is compatible with STUDIO (same song)
    matrix[VersionClass.REMASTER][VersionClass.STUDIO] = true;
    matrix[VersionClass.REMASTER][VersionClass.REMASTER] = true;

    // UNKNOWN is compatible with everything (no info to reject)
    for (const v of Object.values(VersionClass)) {
      matrix[VersionClass.UNKNOWN][v] = true;
      matrix[v][VersionClass.UNKNOWN] = true;
    }

    // LIVE ↔ LIVE, ACOUSTIC ↔ ACOUSTIC, REMIX ↔ REMIX, etc.
    for (const v of Object.values(VersionClass)) {
      if (v === VersionClass.UNKNOWN) continue;
      matrix[v][v] = true;
    }

    return matrix as Record<VersionClass, Record<VersionClass, boolean>>;
  })();

// ═══════════════════════════════════════════════════════════════════════════
//  Detection Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect the version class from a track title string.
 *
 * Checks the title against each regex pattern in priority order.
 * Returns the first matching VersionClass, or STUDIO if nothing matches
 * (clean title = assumed studio).
 *
 * @param title - The track title (or combined title + artist string).
 * @returns The detected VersionClass.
 */
export function detectVersionFromTitle(title: string): VersionClass {
  const text = title.toLowerCase();

  // Check each version class in priority order
  for (const versionClass of DETECTION_PRIORITY) {
    const pattern = VERSION_PATTERNS[versionClass];
    if (pattern.test(text)) {
      // REMIX exception: "remaster" / "remastered" should NOT be REMIX
      if (versionClass === VersionClass.REMIX && REMIX_EXCEPTIONS.test(text)) {
        continue;
      }
      return versionClass;
    }
  }

  // No indicators found → clean title → STUDIO
  return VersionClass.STUDIO;
}

/**
 * Detect the version class from a YouTube channel name.
 *
 * Heuristics:
 *   - "Artist - Topic"  → STUDIO  (auto-generated official audio channel)
 *   - "Artist VEVO"     → STUDIO  (official artist channel)
 *   - Anything else     → UNKNOWN (no reliable signal)
 *
 * @param channel - The channel/title string from the search result.
 * @returns The detected VersionClass.
 */
export function detectVersionFromChannel(channel: string): VersionClass {
  const ch = channel.toLowerCase();
  if (ch.includes(' - topic') || ch.endsWith(' topic')) return VersionClass.STUDIO;
  if (ch.includes('vevo')) return VersionClass.STUDIO;
  return VersionClass.UNKNOWN;
}

/**
 * Combined detection: uses title (primary) + optional channel (secondary).
 *
 * If the title already detects a specific version (not STUDIO), the title
 * result is used. If the title is clean (STUDIO) but the channel is
 * UNKNOWN, we return UNKNOWN (conservative). If both signals agree on
 * STUDIO, return STUDIO.
 *
 * @param title   - The track title.
 * @param channel - Optional channel name for secondary detection.
 * @returns The detected VersionClass.
 */
export function detectVersion(title: string, channel?: string): VersionClass {
  const fromTitle = detectVersionFromTitle(title);

  if (fromTitle !== VersionClass.STUDIO) {
    return fromTitle;
  }

  // Title is clean (STUDIO). Check channel for disambiguation.
  if (channel) {
    const fromChannel = detectVersionFromChannel(channel);
    if (fromChannel === VersionClass.UNKNOWN) {
      // Channel doesn't look official — be conservative
      return VersionClass.UNKNOWN;
    }
  }

  return VersionClass.STUDIO;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Compatibility Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check whether a candidate version is compatible with a local version.
 *
 * Uses the COMPATIBILITY_MATRIX lookup. Returns a structured result
 * indicating compatibility and the reason for rejection (if any).
 *
 * @param localVersion    - The version of the local library track.
 * @param candidateVersion - The detected version of the search candidate.
 * @returns A VersionMatchResult with compatibility status.
 */
export function areVersionsCompatible(
  local: VersionClass,
  candidate: VersionClass,
): boolean {
  return COMPATIBILITY_MATRIX[local]?.[candidate] ?? false;
}

/**
 * Generate a human-readable rejection reason for an incompatible pair.
 */
function getRejectionReason(
  localVersion: VersionClass,
  candidateVersion: VersionClass,
): string {
  if (localVersion === VersionClass.STUDIO) {
    switch (candidateVersion) {
      case VersionClass.LIVE:
        return 'Candidate is a live recording, not the studio version';
      case VersionClass.ACOUSTIC:
        return 'Candidate is an acoustic version, not the studio version';
      case VersionClass.REMIX:
        return 'Candidate is a remix, not the original studio version';
      case VersionClass.KARAOKE:
        return 'Candidate is a karaoke track, not the studio version';
      case VersionClass.INSTRUMENTAL:
        return 'Candidate is an instrumental, not the studio version';
      case VersionClass.EXTENDED:
        return 'Candidate is an extended mix, not the standard studio version';
      default:
        return `Incompatible versions: ${localVersion} vs ${candidateVersion}`;
    }
  }

  return `Incompatible versions: ${localVersion} vs ${candidateVersion}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  VersionEngine Class
// ═══════════════════════════════════════════════════════════════════════════

/**
 * VersionEngine — detects track versions and checks compatibility.
 *
 * Usage:
 * ```ts
 * const engine = new VersionEngine();
 * const version = engine.detect('Song Title (Live)');
 * const result = engine.check(VersionClass.STUDIO, version);
 * // result.compatible === false
 *
 * const combined = engine.detectAndCheck(
 *   'Original Song',
 *   'Song Title (Live at Madison Square Garden)',
 * );
 * // combined.compatible === false
 * ```
 */
export class VersionEngine {
  /**
   * Detect the version class of a track from its title.
   *
   * @param title - The track title (or combined title + artist string).
   * @returns The detected VersionClass.
   */
  detect(title: string): VersionClass {
    return detectVersionFromTitle(title);
  }

  /**
   * Check compatibility between a local and candidate version.
   *
   * @param localVersion     - The version of the local library track.
   * @param candidateVersion - The detected version of the search candidate.
   * @returns A VersionMatchResult with compatibility status.
   */
  check(
    localVersion: VersionClass,
    candidateVersion: VersionClass,
  ): VersionMatchResult {
    const compatible = areVersionsCompatible(localVersion, candidateVersion);

    return {
      localVersion,
      candidateVersion,
      compatible,
      rejectionReason: compatible ? undefined : getRejectionReason(localVersion, candidateVersion),
    };
  }

  /**
   * Convenience: detect both versions from titles and check compatibility.
   *
   * The local version is assumed to be STUDIO (unless the local title
   * contains version indicators like "remaster").
   *
   * @param localTitle     - The local track's title.
   * @param candidateTitle - The candidate track's title.
   * @returns A VersionMatchResult with compatibility status.
   */
  detectAndCheck(
    localTitle: string,
    candidateTitle: string,
  ): VersionMatchResult {
    const localVersion = detectVersionFromTitle(localTitle);
    const candidateVersion = detectVersionFromTitle(candidateTitle);
    return this.check(localVersion, candidateVersion);
  }
}
