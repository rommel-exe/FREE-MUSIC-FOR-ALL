/**
 * Trust Engine — source-quality evaluator for YouTube search results.
 *
 * Scores every candidate on a scale from deeply negative (remixes, covers,
 * karaoke) up to ~185 (Topic channel + official audio + sweet-spot duration
 * + artist match). The score is then classified into a {@link TrustLevel}
 * and used by downstream ranking logic to gate which results are even
 * considered trustworthy enough to play.
 *
 * ── Scoring signals ───────────────────────────────────────────────
 *
 *   POSITIVE                              PTS
 *   ─────────────────────────────────────────────
 *   Topic channel ("Artist - Topic")      +100
 *   Official audio indicator              +50
 *   "(audio)" in title                    +40   (mutually exclusive w/ above)
 *   VEVO channel                          +20
 *   Duration sweet spot 120-360s          +10
 *   Duration borderline 60-120 / 360-480  +5
 *   Has artist metadata                   +5
 *   Channel name ≈ artist name            +10
 *
 *   NEGATIVE                              PTS
 *   ─────────────────────────────────────────────
 *   Live / Concert in title              -1000
 *   "Live at/from/in…title"              -800
 *   Artist contains live/concert         -500
 *   Remix / Remixed                    -100000
 *   Cover                             -100000
 *   Karaoke / Instrumental             -100000
 *   Acoustic / Stripped / Unplugged      -500
 *   Nightcore / Sped-up / Slowed         -300
 *   Loop / Hour compilations             -300
 *   Lyric video (non-official)           -200
 *   Tribute                             -1000
 *   "Cover by"                           -100
 *   "Lyrics" (standalone, non-official)  -100
 *   "Slowed + reverb"                    -400   (stricter than generic slowed)
 *
 * ── Threshold ─────────────────────────────────────────────────────
 *
 *   score ≥ 15  → trustworthy (default gate used throughout the codebase)
 *
 * @module
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Trust Levels
// ═══════════════════════════════════════════════════════════════════════════

export enum TrustLevel {
  /** >= 100 — Topic channels, official audio from verified sources */
  EXCEPTIONAL = 'exceptional',
  /** >= 60  — Official audio, major label channels */
  HIGH = 'high',
  /** >= 30  — Clean uploads with good signals */
  MEDIUM = 'medium',
  /** >= 15  — Bare minimum trustworthy */
  LOW = 'low',
  /** < 15   — Should be excluded */
  UNTRUSTED = 'untrusted',
}

// ═══════════════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum trust score for a result to be considered trustworthy. */
export const TRUST_THRESHOLD = 15;

// ═══════════════════════════════════════════════════════════════════════════
//  Pure scoring function (standalone, no channel info)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a trust score for a search result (pure function).
 *
 * This is the same core logic that lived in `searchMatching.ts` but
 * extended with additional penalty patterns. Accepts the same minimal
 * parameters so callers that only have title/artist/duration can still
 * produce a score without channel metadata.
 *
 * @param title    - Video title from the search result.
 * @param artist   - Artist name (may contain " - Topic" suffix or "VEVO").
 * @param duration - Duration in seconds.
 * @returns Signed integer trust score.
 */
export function computeTrustScore(
  title: string,
  artist: string,
  duration: number,
): number {
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  let score = 0;

  // ── Positive signals ────────────────────────────────────────────

  // Topic channel ("Artist - Topic")
  if (artistLower.includes(' - topic')) score += 100;

  // Official audio indicator
  if (/\bofficial\s+audio\b/i.test(titleLower)) {
    score += 50;
  } else if (/\(audio\)/i.test(titleLower)) {
    score += 40;
  }

  // VEVO channel
  if (artistLower.includes('vevo')) score += 20;

  // Duration sweet spot
  if (duration >= 120 && duration <= 360) {
    score += 10;
  } else if ((duration >= 60 && duration < 120) || (duration > 360 && duration <= 480)) {
    score += 5;
  }

  // Has artist metadata
  if (artist && artist.length > 0) score += 5;

  // ── Penalties ───────────────────────────────────────────────────

  // Live / Concert in TITLE — the strongest signal for unwanted recordings
  if (/\b(live|concert)\b/i.test(titleLower)) score -= 1000;

  // "Live at …" / "Live from …" / "Live in …" patterns
  if (/\blive\s+(at|from|in|session|version|performance|recording)\b/i.test(titleLower)) {
    score -= 800;
  }

  // Artist/channel name contains live/concert (but NOT a Topic channel)
  if (/\b(live|concert)\b/i.test(artistLower) && !artistLower.includes(' - topic')) {
    score -= 500;
  }

  // Remix — never select a non-original
  if (/\b(remix|remixed)\b/i.test(titleLower)) score -= 100000;

  // Cover — never select a cover
  if (/\bcover\b/i.test(titleLower)) score -= 100000;

  // Karaoke / Instrumental — never select instrumental
  if (/\b(karaoke|instrumental)\b/i.test(titleLower)) score -= 100000;

  // Tribute — almost never what the user wants
  if (/\btribute\b/i.test(titleLower)) score -= 1000;

  // Acoustic / stripped versions — fan recordings or alternate takes
  if (/\b(acoustic|stripped|unplugged)\b/i.test(titleLower)) score -= 500;

  // Nightcore / sped-up / slowed — pitch-shifted re-uploads
  if (/\b(nightcore|sped\s*up|slowed)\b/i.test(titleLower)) score -= 300;

  // "Slowed + reverb" is a stricter subset of slowed
  if (/\bslowed\s*\+?\s*reverb\b/i.test(titleLower)) score -= 400;

  // Loop / Hour compilations
  if (/\b(1\s*hour|10\s*hours|loop|compilation|megamix)\b/i.test(titleLower)) {
    score -= 300;
  }

  // Lyric video (non-official)
  if (/\blyric\s+video\b/i.test(titleLower) && !/\bofficial\b/i.test(titleLower)) {
    score -= 200;
  }

  // "Cover by" — explicit credit that it's a cover (subtler than bare "cover")
  if (/\bcover\s+by\b/i.test(titleLower)) score -= 100;

  // Standalone "lyrics" tag without official indicator — usually fan-uploaded
  if (/\blyrics\b/i.test(titleLower) && !/\bofficial\b/i.test(titleLower)) {
    score -= 100;
  }

  return score;
}

// ═══════════════════════════════════════════════════════════════════════════
//  TrustEngine class
// ═══════════════════════════════════════════════════════════════════════════

export class TrustEngine {
  /**
   * Compute a trust score for a search result.
   *
   * Extends the pure {@link computeTrustScore} with channel-aware
   * bonuses (e.g. matching channel name to artist name).
   *
   * @param title    - Video title.
   * @param artist   - Artist name.
   * @param duration - Duration in seconds.
   * @param channel  - Optional YouTube channel name (e.g. "ArtistVEVO",
   *                   "Artist - Topic").
   * @returns Signed integer trust score.
   */
  score(title: string, artist: string, duration: number, channel?: string): number {
    // Start with the base pure-function score
    let trust = computeTrustScore(title, artist, duration);

    // ── Channel-aware bonuses (when channel metadata is available) ──

    if (channel) {
      const channelLower = channel.toLowerCase();
      const artistLower = artist.toLowerCase().replace(/\s*-\s*topic$/i, '').trim();

      // Topic channel via channel name (belt-and-suspenders with the
      // artist-field check above, but this catches cases where the
      // artist field doesn't carry the suffix but the channel does)
      if (channelLower.includes(' - topic')) {
        // Only add if the base function didn't already award it
        if (!artist.toLowerCase().includes(' - topic')) {
          trust += 100;
        }
      }

      // VEVO channel via channel name
      if (channelLower.includes('vevo') && !artist.toLowerCase().includes('vevo')) {
        trust += 20;
      }

      // Channel name matches artist name — strong authenticity signal
      if (artistLower.length > 0 && channelLower.includes(artistLower)) {
        trust += 10;
      }

      // Verified / known-good channels (pattern-based heuristic)
      // Channels with "official", "music", or "records" in the name
      // that also match the artist are likely legitimate.
      if (
        /\b(official|music|records|entertainment)\b/i.test(channelLower) &&
        artistLower.length > 0 &&
        channelLower.includes(artistLower)
      ) {
        trust += 5;
      }
    }

    return trust;
  }

  /**
   * Map a numeric trust score to a {@link TrustLevel}.
   *
   * @param score - Trust score from {@link score} or {@link computeTrustScore}.
   * @returns The corresponding trust level.
   */
  classify(score: number): TrustLevel {
    if (score >= 100) return TrustLevel.EXCEPTIONAL;
    if (score >= 60) return TrustLevel.HIGH;
    if (score >= 30) return TrustLevel.MEDIUM;
    if (score >= 15) return TrustLevel.LOW;
    return TrustLevel.UNTRUSTED;
  }

  /**
   * Determine whether a score meets the minimum trust threshold.
   *
   * @param score     - Trust score to evaluate.
   * @param threshold - Minimum score to pass (defaults to {@link TRUST_THRESHOLD}).
   * @returns `true` if the result should be considered trustworthy.
   */
  isTrustworthy(score: number, threshold: number = TRUST_THRESHOLD): boolean {
    return score >= threshold;
  }
}
