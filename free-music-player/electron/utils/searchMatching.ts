/**
 * Unified search matching and scoring engine.
 *
 * THE SINGLE SOURCE OF TRUTH for all YouTube Music matching logic across
 * search, playlist import, and auto-recovery.
 *
 * DESIGN: Every function in this module accepts plain data objects — NOT
 * framework-specific types — so it can be consumed by any caller regardless
 * of whether it works with SearchResult, raw ytmusic-api output, or any
 * other shape that has `title`, `artist`, `duration` fields.
 *
 * The ULTIMATE SORTING pipeline (used by all three consumers):
 *   1. Search YouTube Music for "Artist Title"
 *   2. Compute trust scores for every result
 *   3. Determine the official/canonical duration via trust-weighted voting
 *   4. Score every result with `computeMultiFactorScore`
 *      → Duration exact match dominates (100/170 pts)
 *      → Everything else is a tiebreaker among exact matches
 *   5. Filter to only exact-duration matches (≤1s tolerance)
 *   6. Return the top-ranked result
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Trust Score Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a trust score for a search result.
 *
 * Score components:
 *   Topic channel              +100
 *   "Official Audio"           +50
 *   "(audio)"                  +40
 *   VEVO                       +20
 *   Duration sweet spot        +10 (120-360s) / +5 (60-120s or 360-480s)
 *   Has artist metadata         +5
 *                              ═══
 *   Max possible               105
 *
 *   Live / Concert             -1000
 *   "Live at/from/in..."       -800
 *   Artist with live/concert   -500
 *   Remix / Remixed          -100000  ← DEVASTATING: never select non-original
 *   Cover                    -100000  ← DEVASTATING: never select cover
 *   Karaoke/Instrumental      -100000  ← DEVASTATING: never select instrumental
 *   Acoustic/Stripped          -500
 *   Nightcore/Sped/Slowed      -300
 *   Loop/Hour compilations     -300
 *   Lyric video (non-official) -200
 *
 * Threshold: score >= 15 → keep (minimum bare-minimum clean result)
 */
export function computeTrustScore(
  title: string,
  artist: string,
  duration: number,
): number {
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  let score = 0;

  // ── Quality signals ──
  if (artistLower.includes(' - topic')) score += 100;
  if (/\bofficial\s+audio\b/i.test(titleLower)) score += 50;
  if (/\(audio\)/i.test(titleLower)) score += 40;
  if (artistLower.includes('vevo')) score += 20;

  // Duration sweet spot
  if (duration >= 120 && duration <= 360) {
    score += 10;
  } else if (duration >= 60 && duration < 120) {
    score += 5;
  } else if (duration > 360 && duration <= 480) {
    score += 5;
  }

  // Has artist metadata
  if (artist && artist.length > 0) score += 5;

  // ── Penalties ──

  // Live / Concert in TITLE — the strongest signal for unwanted recordings
  if (/\b(live|concert)\b/i.test(titleLower)) score -= 1000;

  // "Live at ..." / "Live from ..." patterns
  if (/\blive\s+(at|from|in|session|version|performance|recording)\b/i.test(titleLower))
    score -= 800;

  // Artist/channel name contains live/concert (but NOT a Topic channel)
  if (/\b(live|concert)\b/i.test(artistLower) && !artistLower.includes(' - topic'))
    score -= 500;

  if (/\b(remix|remixed)\b/i.test(titleLower)) score -= 100000;
  if (/\bcover\b/i.test(titleLower)) score -= 100000;
  if (/\b(karaoke|instrumental)\b/i.test(titleLower)) score -= 100000;

  // Acoustic / stripped versions — often fan recordings or alternate versions
  if (/\b(acoustic|stripped|unplugged)\b/i.test(titleLower)) score -= 500;

  if (/\b(nightcore|sped\s*up|slowed|reverb)\b/i.test(titleLower)) score -= 300;
  if (/\b(1\s*hour|10\s*hours|loop|compilation|megamix)\b/i.test(titleLower))
    score -= 300;
  if (
    /\blyric\s+video\b/i.test(titleLower) &&
    !/\bofficial\b/i.test(titleLower)
  )
    score -= 200;

  return score;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Duration Closeness (STRICT — binary 0 or 100)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Duration closeness score — BINARY (0 or 100).
 *
 * Exact match (≤2s tolerance, rounded both sides) = 100, anything else = 0.
 * Song length is definitive: if the duration doesn't match, it's the wrong
 * track. Period.
 *
 * Tolerance note: YouTube returns float durations (e.g. 180.3) and
 * getOfficialDuration rounds to integers. We use ≤2s because different
 * platforms (Spotify, YouTube) can report the same track with 1-2s
 * difference due to encoding/fade-in/fade-out variances.
 */
export function computeDurationClosenessScore(
  duration: number,
  officialDuration: number,
): number {
  if (officialDuration <= 0 || duration <= 0) return 0;
  return Math.abs(Math.round(duration) - Math.round(officialDuration)) <= 2
    ? 100
    : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Official Duration (trust-weighted voting)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine the official/canonical duration from search results using
 * trust-weighted mode voting.
 *
 * Each result's duration vote is weighted by its trust score, so high-trust
 * results (official audio +50, Topic channel +100) dominate over generic
 * uploads (score ~15). This prevents a group of low-trust wrong-duration
 * results from hijacking the official length.
 *
 * Only considers results with trust score >= 15 (passing threshold) to avoid
 * contamination from penalised results (live, remix, cover, etc.).
 *
 * @param results - Array of objects with `duration` (seconds) and `score` (trust score).
 * @returns The mode duration in seconds, or 0 if no valid duration found.
 */
export function getOfficialDuration(
  results: Array<{ duration: number; score: number }>,
): number {
  const durationWeight = new Map<number, number>();
  for (const { duration, score } of results) {
    if (duration <= 0 || score < 15) continue;
    const dur = Math.round(duration);
    // Weight by trust score: official audio (score 65) gets 4x the weight of
    // a bare-minimum result (score 15). Topic channels (score 115) get ~8x.
    durationWeight.set(dur, (durationWeight.get(dur) ?? 0) + score);
  }

  if (durationWeight.size === 0) return 0;

  // Find the duration with the highest weighted score
  let modeDuration = 0;
  let maxWeight = 0;
  for (const [dur, weight] of durationWeight) {
    // Tie-break: prefer the shorter duration (avoids picking an hour-long loop)
    if (weight > maxWeight || (weight === maxWeight && dur < modeDuration)) {
      maxWeight = weight;
      modeDuration = dur;
    }
  }

  return modeDuration;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Exact Duration Hard Filter
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter results to ONLY include tracks matching the EXACT official duration.
 *
 * Uses ≤2s tolerance (rounded both sides) — the same binary check as
 * computeDurationClosenessScore. If no results match, returns an empty
 * array — better to show/play nothing than to serve wrong-duration tracks.
 *
 * If officialDuration is 0 or negative (unknown), returns results unfiltered
 * (no duration gate to apply).
 */
export function filterByExactDuration<T extends { duration: number }>(
  results: T[],
  officialDuration: number,
): T[] {
  if (officialDuration <= 0) return results;
  return results.filter((r) => {
    if (r.duration <= 0) return false;
    return Math.abs(Math.round(r.duration) - Math.round(officialDuration)) <= 2;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Ultimate Multi-Factor Scoring (THE SORTING THING)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute the ultimate multi-factor ranking score for a search result.
 *
 * EXACT DURATION MATCH is the ONLY signal that matters (100 out of max ~170 pts).
 * If the duration doesn't match exactly, the result scores 0 on the dominant
 * factor and can never catch up — everything else is just a tiebreaker among
 * exact matches.
 *
 *   Signal                      Max    Why
 *   ────────────────────────────────────────────────────────────
 *   1. Duration exact match     100    Must be THE EXACT track
 *   2. Native position (YT)      30    YT's own relevance ranking
 *   3. View count (log)          20    Popularity = likely correct
 *   4. Artist match              20    Query mentions artist name
 *   5. Trust score contribution   0    Duration already confirms it
 *                                ───
 *   TOTAL                       170
 *
 * A wrong-duration track gets 0 from factor 1. Even with max everything
 * else (30+20+20=70), it can't beat a single exact-match track with score
 * 100+0+0+0=100. This guarantees that exact-length tracks ALWAYS rank first.
 */
export function computeMultiFactorScore(params: {
  /** Track duration in seconds */
  duration: number;
  /** Full search query (e.g. "Artist Name Song Title") */
  query: string;
  /** Artist name from the result */
  artist: string;
  /** Optional view count for popularity boost */
  viewCount?: number;
  /** Pre-computed trust score */
  trustScore: number;
  /** Position in the native search results (0 = first) */
  nativePosition: number;
  /** Official/canonical duration from getOfficialDuration() */
  officialDuration: number;
}): number {
  const queryLower = params.query.toLowerCase().trim();
  const artistLower = params.artist.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  let score = 0;

  // ── 1. Duration closeness (0-100) — PRIMARY signal ──
  // Song length is the single best indicator of "is this the actual track".
  // More important than everything else combined.
  score += computeDurationClosenessScore(params.duration, params.officialDuration);

  // ── 2. Native position (0-30) — YT Music's own ranking ──
  score += Math.max(0, 30 - params.nativePosition * 0.3);

  // ── 3. View count (log scale, 0-20) — popularity boost ──
  if (params.viewCount && params.viewCount > 0) {
    const logViews = Math.log10(params.viewCount);
    score += Math.min(20, (logViews / 9) * 20);
  }

  // ── 4. Artist match (0-20) — query explicitly names this artist ──
  if (artistLower && queryLower.includes(artistLower)) {
    score += 20;
  } else if (artistLower && queryWords.length > 0) {
    const artistWords = artistLower.split(/\s+/);
    const matchedArtist = queryWords.filter((w) =>
      artistWords.some((aw) => aw.includes(w)),
    ).length;
    if (matchedArtist > 0) {
      score += Math.min(20, matchedArtist * 7);
    }
  }

  // ── 5. Trust score contribution (0-10) ──
  score += Math.max(0, Math.min(100, params.trustScore)) * 0.1;

  return score;
}

// ═══════════════════════════════════════════════════════════════════════════
//  UNIFIED YOUTUBE MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lazily-initialized ytmusic-api singleton shared by all callers.
 */
let _ytmusicClient: any = null;

async function getYTMusic(): Promise<any> {
  if (!_ytmusicClient) {
    const mod = await import('ytmusic-api');
    const YTMusic = mod.default;
    _ytmusicClient = new YTMusic();
    await _ytmusicClient.initialize();
  }
  return _ytmusicClient;
}

/**
 * In-memory cache for single-track matches to avoid redundant API calls.
 */
const matchCache = new Map<
  string,
  { videoId: string; ts: number }
>();
const MATCH_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Unified YouTube Music matching engine.
 *
 * Searches YouTube Music for the given artist + title, runs the full
 * multi-factor scoring pipeline, and returns the best exact-duration
 * match. Used by playlist import, play-time auto-recovery, and library
 * pre-matching — replaces 3 separate copies of the same pipeline.
 *
 * @param artist           - Artist name.
 * @param title            - Song title.
 * @param expectedDuration - Expected duration in seconds (from source metadata).
 * @returns The matching YouTube videoId, or null if no good match found.
 */
export async function searchYouTubeMatch(
  artist: string,
  title: string,
  expectedDuration?: number,
): Promise<string | null> {
  const query = `${artist} ${title}`.trim();
  if (!query) return null;

  // ── Cache check ──
  const cacheKey = query;
  const cached = matchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < MATCH_CACHE_TTL_MS) {
    return cached.videoId;
  }

  try {
    const yt = await getYTMusic();
    const results = await yt.searchSongs(query);
    if (!results || results.length === 0) return null;

    // Step 1: Compute trust scores for ALL results
    const scored: Array<{
      result: any;
      duration: number;
      trustScore: number;
    }> = results.map((r: any) => ({
      result: r,
      duration: r.duration ?? 0,
      trustScore: computeTrustScore(
        r.name || r.title || '',
        r.artist?.name || '',
        r.duration ?? 0,
      ),
    }));

    // Step 2: Determine official duration via trust-weighted voting
    const computedOfficial = getOfficialDuration(
      scored.map(s => ({ duration: s.duration, score: s.trustScore })),
    );

    // Use computed official if available, else fall back to expectedDuration
    const targetDuration =
      computedOfficial > 0 ? computedOfficial : (expectedDuration ?? 0);
    if (targetDuration <= 0) return null;

    // Step 3: DURATION FIRST — filter ALL results by exact duration
    const durationMatched = filterByExactDuration(scored, targetDuration);
    if (durationMatched.length === 0) return null;

    // Step 4: Score duration-matched results with multi-factor ranking
    const ranked = durationMatched.map((s, i) => ({
      ...s,
      rankScore: computeMultiFactorScore({
        duration: s.duration,
        query,
        artist: s.result.artist?.name || '',
        trustScore: s.trustScore,
        nativePosition: i,
        officialDuration: targetDuration,
      }),
    }));
    ranked.sort((a, b) => b.rankScore - a.rankScore);

    // Step 5: Pick the best trust-passing result (≥ 15 eliminates remixes)
    const best = ranked.find(s => s.trustScore >= 15);
    if (!best) return null;

    const videoId = best.result.videoId || best.result.id || null;

    // Cache the result
    if (videoId) {
      matchCache.set(cacheKey, { videoId, ts: Date.now() });
    }

    return videoId;
  } catch (err) {
    console.error(`[searchMatching] searchYouTubeMatch failed for "${query}":`, err);
    return null;
  }
}

/**
 * Batch-resolve YouTube IDs for an array of tracks using the unified engine.
 *
 * Processes tracks with limited concurrency (3) to avoid rate-limiting.
 * Skips tracks that already have a youtubeId.
 *
 * @param tracks     - Array of tracks with title, artist, duration.
 * @param onProgress - Optional progress callback (called after each track).
 * @returns The same tracks enriched with youtubeId where a match was found.
 */
export async function resolveBatchYoutubeIds(
  tracks: Array<{
    title: string;
    artist: string;
    duration: number;
    thumbnail?: string;
    youtubeId?: string;
  }>,
  onProgress?: (message: string) => void,
): Promise<
  Array<{
    title: string;
    artist: string;
    duration: number;
    thumbnail: string;
    youtubeId?: string;
  }>
> {
  const CONCURRENCY = 3;
  const results: Array<{
    title: string;
    artist: string;
    duration: number;
    thumbnail: string;
    youtubeId?: string;
  }> = [];
  let completed = 0;
  const total = tracks.length;

  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const batch = tracks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (track) => {
        if (track.youtubeId) return { ...track, thumbnail: track.thumbnail || '' };
        const videoId = await searchYouTubeMatch(
          track.artist,
          track.title,
          track.duration,
        );
        completed++;
        if (onProgress) {
          onProgress(`Matching track ${completed}/${total} to YouTube...`);
        }
        return {
          ...track,
          thumbnail: track.thumbnail || '',
          youtubeId: videoId || undefined,
        };
      }),
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      }
    }
  }

  const matched = results.filter(t => t.youtubeId).length;
  console.log(`[searchMatching] YouTube batch: ${matched}/${total} tracks resolved`);
  return results;
}
