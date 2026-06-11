import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SearchResult } from '../utils/types';
import { getVerifiedTrack, setVerifiedTrack, getVerifiedTracksBatch, clearExpiredVerifiedTracks } from '../utils/database';

const execFileAsync = promisify(execFile);

const YTDLP_PATH = '/Library/Frameworks/Python.framework/Versions/3.12/bin/yt-dlp';

// ── YouTube Music API ──────────────────────────────────────────────────

let ytmusicClient: any = null;

async function getYTMusic(): Promise<any> {
  if (!ytmusicClient) {
    const mod = await import('ytmusic-api');
    const YTMusic = mod.default;
    ytmusicClient = new YTMusic();
    await ytmusicClient.initialize();
  }
  return ytmusicClient;
}

// ── In-memory search cache ──────────────────────────────────────────────

const searchCache = new Map<string, { results: SearchResult[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ═══════════════════════════════════════════════════════════════════════════
//  Trust Score Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a trust score for a search result.
 *
 * NOTE: ytmusic-api v5 returns artist names WITHOUT the " - Topic" suffix
 * that YouTube uses for auto-generated channels. The Topic channel bonus
 * (+100) rarely applies here. A typical clean (non-penalised) result
 * scores 15 (duration + artist metadata). We set the threshold at 15 so
 * that any result without penalty words passes through.
 *
 * Score components:
 *   Official Audio             +50
 *   "(audio)" in title         +40
 *   VEVO                       +20
 *   Duration sweet spot        +10
 *   Has artist metadata         +5
 *                              ═══
 *   Max possible               105
 *
 *   Live / Concert             -1000
 *   "at ..." venue pattern      -800  (e.g. "Live at Madison Square Garden")
 *   Acoustic / stripped         -500
 *   Remix                       -500
 *   Cover                       -500
 *   Karaoke / Instrumental      -500
 *   Nightcore / Sped/Slowed     -300
 *   Loop / Hour compilations    -300
 *   Lyric video (non-official)  -200
 *
 *   Threshold: score >= 15 → keep
 *              score < 15  → discard
 *
 * Also checks the ARTIST name — if the channel name contains "live" or
 * "concert" it's heavily penalised.
 */
function computeTrustScore(result: Pick<SearchResult, 'title' | 'artist' | 'duration'>): number {
  const titleLower = result.title.toLowerCase();
  const artistLower = result.artist.toLowerCase();
  let score = 0;

  // ── Quality signals ──
  if (artistLower.includes(' - topic'))       score += 100;
  if (/\bofficial\s+audio\b/i.test(titleLower)) score += 50;
  if (/\(audio\)/i.test(titleLower))          score += 40;
  if (artistLower.includes('vevo'))            score += 20;

  // Duration sweet spot
  if (result.duration >= 120 && result.duration <= 360) {
    score += 10;
  } else if (result.duration >= 60 && result.duration < 120) {
    score += 5;
  } else if (result.duration > 360 && result.duration <= 480) {
    score += 5;
  }

  // Has artist metadata
  if (result.artist && result.artist.length > 0) score += 5;

  // ── Penalties ──

  // Live / Concert in TITLE — the strongest signal for unwanted recordings
  if (/\b(live|concert)\b/i.test(titleLower))               score -= 1000;

  // "Live at ..." / "Live from ..." patterns
  if (/\blive\s+(at|from|in|session|version|performance|recording)\b/i.test(titleLower)) score -= 800;

  // Artist/channel name contains live/concert (but NOT a Topic channel)
  if (/\b(live|concert)\b/i.test(artistLower) && !artistLower.includes(' - topic')) score -= 500;

  if (/\b(remix|remixed)\b/i.test(titleLower))              score -= 500;
  if (/\bcover\b/i.test(titleLower))                         score -= 500;
  if (/\b(karaoke|instrumental)\b/i.test(titleLower))       score -= 500;

  // Acoustic / stripped versions — often fan recordings or alternate versions
  if (/\b(acoustic|stripped|unplugged)\b/i.test(titleLower)) score -= 500;

  if (/\b(nightcore|sped\s*up|slowed|reverb)\b/i.test(titleLower)) score -= 300;
  if (/\b(1\s*hour|10\s*hours|loop|compilation|megamix)\b/i.test(titleLower)) score -= 300;
  if (/\blyric\s+video\b/i.test(titleLower) && !/\bofficial\b/i.test(titleLower)) score -= 200;

  return score;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Duration Closeness Score
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute a duration closeness score (0 or 100) — EXACT match only.
 *
 * BINARY: either the duration is identical to the official track length
 * or it's the wrong track. No graduated tiers. No "close enough".
 * Song length is definitive.
 *
 *   Exact match (0s diff)  → 100  — the one true track
 *   Anything else          →   0  — wrong track, period
 */
function computeDurationClosenessScore(duration: number, officialDuration: number): number {
  if (officialDuration <= 0 || duration <= 0) return 0;
  return Math.abs(duration - officialDuration) === 0 ? 100 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
//  View Count Extraction from Raw API Response
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a human-readable view count string like "123,456,789 views",
 * "1.2M views", "500K views", or "1.2B views".
 */
function parseViewCount(text: string): number | undefined {
  const match = text.match(/^([\d,]+(?:\.[\d]+)?)\s*([KMB])?\s*views?$/i);
  if (!match) return undefined;

  let num = parseFloat(match[1].replace(/,/g, ''));
  const suffix = match[2]?.toUpperCase();

  if (suffix === 'K') num *= 1_000;
  else if (suffix === 'M') num *= 1_000_000;
  else if (suffix === 'B') num *= 1_000_000_000;

  return Math.round(num);
}

/**
 * Recursively walk the raw API response to find all
 * musicResponsiveListItemRenderer objects.
 *
 * The ytmusic-api library discards view counts during parsing.
 * We walk the raw response ourselves to extract them.
 */
function walkMusicResponsiveListItems(data: any): any[] {
  const items: any[] = [];
  function walk(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
    } else if (obj.musicResponsiveListItemRenderer) {
      items.push(obj.musicResponsiveListItemRenderer);
    } else {
      for (const val of Object.values(obj)) walk(val);
    }
  }
  walk(data);
  return items;
}

/**
 * Parse a single musicResponsiveListItemRenderer from the raw YouTube Music
 * API response, extracting ALL available data including view counts from
 * subtitle text in flexColumns.
 */
function parseRawSearchItem(item: any): SearchResult | null {
  const videoId = item.playlistItemData?.videoId;
  if (!videoId) return null;

  // Collect ALL text runs from all flexColumns
  const allRuns: Array<{ text: string; navigationEndpoint?: any }> = [];
  for (const col of (item.flexColumns || [])) {
    const colRuns = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
    if (colRuns) allRuns.push(...colRuns);
  }

  // Title is always the first run in flexColumns[0]
  const title = allRuns[0]?.text || '';

  // Artist: run with navigationEndpoint having pageType ARTIST or USER_CHANNEL
  const artistRun = allRuns.find(r =>
    r.navigationEndpoint?.browseEndpoint?.pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
    r.navigationEndpoint?.browseEndpoint?.pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL',
  );
  const artist = artistRun?.text || '';

  // Duration from fixedColumns (MM:SS or H:MM:SS format)
  let duration = 0;
  for (const col of (item.fixedColumns || [])) {
    const colRuns = col?.musicResponsiveListItemFixedColumnRenderer?.text?.runs;
    if (colRuns) {
      for (const run of colRuns) {
        const dur = parseDurationStr(run.text || '');
        if (dur > 0) { duration = dur; break; }
      }
    }
    if (duration > 0) break;
  }

  // Thumbnail (best quality + fallback)
  const thumbs = item.thumbnail?.musicResponsiveListItemThumbnailRenderer?.thumbnail?.thumbnails || [];
  const thumbnail = getBestThumbnail(thumbs, videoId);

  // View count: find a text run matching "X views" pattern
  let viewCount: number | undefined;
  for (const run of allRuns) {
    const vc = parseViewCount(run.text || '');
    if (vc !== undefined) { viewCount = vc; break; }
  }

  return {
    id: videoId,
    title,
    artist,
    duration,
    thumbnail,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    viewCount,
  };
}

/**
 * Parse a duration string like "3:45" or "1:02:30" to seconds.
 */
function parseDurationStr(text: string): number {
  const match = text.match(/^(?:(\d+):)?(\d+):(\d+)$/);
  if (!match) return 0;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get the best quality thumbnail URL from an array of thumbnail objects.
 *
 * The ytmusic-api library flattens ALL "thumbnails" arrays from the raw
 * response into one list. This can include small menu icons and avatars
 * mixed in with actual album art. We sort by dimensions to pick the largest.
 *
 * Falls back to constructing a YouTube thumbnail from the videoId if
 * no valid thumbnail is available (guarantees every track has art).
 */
function getBestThumbnail(
  thumbnails: Array<{ url?: string; width?: number; height?: number }> | undefined,
  videoId?: string,
): string {
  if (thumbnails && thumbnails.length > 0) {
    // Filter to objects with actual URLs and sort by largest dimensions
    const sorted = [...thumbnails]
      .filter(t => t?.url && t.url.length > 0)
      .sort((a, b) => (b.width || 0) - (a.width || 0) || (b.height || 0) - (a.height || 0));
    if (sorted.length > 0) return sorted[0].url!;
  }

  // Fallback: construct a YouTube Music album-art-quality thumbnail.
  // maxresdefault is the highest quality (1920×1080). For Topic/auto-generated
  // tracks, YouTube uses the album cover art as the maxresdefault thumbnail.
  if (videoId) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  return '';
}

/**
 * Compute a ranking score for a search result.
 *
 * EXACT DURATION MATCH is the ONLY signal that matters (100 out of max 170 pts).
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
function computeMultiFactorScore(
  result: SearchResult,
  query: string,
  viewCount: number | undefined,
  trustScore: number,
  nativePosition: number,
  officialDuration: number,
): number {
  const queryLower = query.toLowerCase().trim();
  const artistLower = result.artist.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  let score = 0;

  // ── 1. Duration closeness (0-100) — PRIMARY signal ──
  // Song length is the single best indicator of "is this the actual track".
  // More important than everything else combined.
  score += computeDurationClosenessScore(result.duration, officialDuration);

  // ── 2. Native position (0-30) — YT Music's own ranking ──
  score += Math.max(0, 30 - nativePosition * 0.3);

  // ── 3. View count (log scale, 0-20) — popularity boost ──
  if (viewCount && viewCount > 0) {
    const logViews = Math.log10(viewCount);
    score += Math.min(20, (logViews / 9) * 20);
  }

  // ── 4. Artist match (0-20) — query explicitly names this artist ──
  if (artistLower && queryLower.includes(artistLower)) {
    score += 20;
  } else if (artistLower && queryWords.length > 0) {
    const artistWords = artistLower.split(/\s+/);
    const matchedArtist = queryWords.filter(w =>
      artistWords.some(aw => aw.includes(w)),
    ).length;
    if (matchedArtist > 0) {
      score += Math.min(20, matchedArtist * 7);
    }
  }

  // ── 5. Trust score contribution (0-10) ──
  score += Math.max(0, Math.min(100, trustScore)) * 0.1;

  return score;
}

/**
 * Determine the official/canonical duration from scored search results.
 *
 * Uses TRUST-WEIGHTED mode: each duration vote is weighted by the result's
 * trust score. High-trust results (official audio +50, Topic channel +100)
 * dominate over low-trust generic uploads (score ~15). This prevents a
 * group of low-trust wrong-duration results from hijacking the official length.
 *
 * Only considers results with trust score >= 15 (passing the filter) to avoid
 * contamination from penalised results.
 *
 * Returns the mode duration in seconds, or 0 if no valid duration found.
 */
function getOfficialDuration(
  scored: Array<{ r: SearchResult; score: number }>,
): number {
  // Weight each duration by trust score so high-trust results (official audio,
  // Topic channel) dominate over low-trust results (generic uploads).
  const durationWeight = new Map<number, number>();
  for (const { r, score } of scored) {
    if (r.duration <= 0 || score < 15) continue;
    const dur = Math.round(r.duration);
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

/**
 * Filter search results to ONLY include tracks matching the EXACT official duration.
 *
 * This ensures only tracks that match the EXACT length of the official track
 * on YouTube Music will be played. Covers, remixes, live versions, and other
 * variants with different durations are excluded.
 *
 * Uses ZERO tolerance — the duration must be exactly identical. YouTube
 * reports integer seconds, so if two tracks have the same duration in
 * seconds they are the same recording.
 * If no results match, returns an empty array — better to show nothing
 * than to play wrong-duration tracks.
 */
function filterByExactDuration(
  results: SearchResult[],
  officialDuration: number,
): SearchResult[] {
  if (officialDuration <= 0) return results;

  return results.filter(r => {
    if (r.duration <= 0) return false;
    return Math.abs(r.duration - officialDuration) === 0;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
//  Search
// ═══════════════════════════════════════════════════════════════════════════

async function searchMusic(query: string, limit: number): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Check cache
  const cached = searchCache.get(q);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.results.slice(0, limit);
  }

  try {
    const yt = await getYTMusic();

    // ── Step 1: Get basic results via library's tested searchSongs() ──
    // This gives reliable parsing for videoId, title, artist, album, duration
    const results = await yt.searchSongs(q);

    const mapped: SearchResult[] = (results || []).map((item: any) => ({
      id: item.videoId || '',
      title: item.name || item.title || '',
      artist: item.artist?.name || '',
      duration: typeof item.duration === 'number' ? item.duration : 0,
      thumbnail: getBestThumbnail(item.thumbnails, item.videoId),
      url: `https://www.youtube.com/watch?v=${item.videoId || ''}`,
    })).filter((r: SearchResult) => r.id);

    // Dedup by id
    const deduped = new Map<string, SearchResult>();
    for (const r of mapped) {
      if (!deduped.has(r.id)) deduped.set(r.id, r);
    }
    const unique = Array.from(deduped.values());

    // ── Step 2: Extract view counts from raw API response (bonus enrichment) ──
    // The library discards subtitle data; we call constructRequest separately
    // to get view counts from the flexColumns subtitle text.
    const viewCountMap = new Map<string, number>();
    try {
      const searchData = await yt.constructRequest('search', {
        query: q,
        params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D',
      });
      const rawItems = walkMusicResponsiveListItems(searchData);
      for (const item of rawItems) {
        const vid = item.playlistItemData?.videoId;
        if (!vid) continue;
        // Collect all text runs from flexColumns
        const runs: string[] = [];
        for (const col of (item.flexColumns || [])) {
          const colRuns = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
          if (colRuns) {
            for (const run of colRuns) {
              if (run?.text) runs.push(run.text);
            }
          }
        }
        // Look for view count in any run
        for (const text of runs) {
          const vc = parseViewCount(text);
          if (vc !== undefined && vc > 0) {
            viewCountMap.set(vid, vc);
            break;
          }
        }
      }
      // Debug: log first 5 view counts to verify parsing
      const sample: string[] = [];
      for (const [vid, vc] of viewCountMap) {
        sample.push(`${vid}=${vc}`);
        if (sample.length >= 5) break;
      }
      console.log(`[search] View counts: ${viewCountMap.size}/${unique.length} results have counts. Samples:`, sample.join(', '));
    } catch (e) {
      console.warn('[search] View count extraction failed (non-fatal):', e);
    }

    // Attach view counts to results
    for (const r of unique) {
      r.viewCount = viewCountMap.get(r.id);
    }

    // ── Step 3: Score + rank (DURATION CLOSENESS DOMINATES) ──
    // Duration closeness is the PRIMARY signal. View counts, native order,
    // and trust score are tiebreakers for equally-close matches.
    const scored = unique.map((r, i) => ({
      r,
      trustScore: computeTrustScore(r),
      rankScore: 0,
    }));

    // Compute official duration BEFORE scoring so it can be used as the
    // primary ranking signal (not just a post-hoc filter).
    const officialDuration = getOfficialDuration(
      scored.map(s => ({ r: s.r, score: s.trustScore })),
    );
    const hasOfficialDuration = officialDuration > 0;

    const meaningfulViewCounts = unique.filter(r => (r.viewCount ?? 0) > 1000).length >= 3;

    if (meaningfulViewCounts) {
      // Full scoring: duration closeness (0-100) + all tiebreakers
      for (let i = 0; i < scored.length; i++) {
        scored[i].rankScore = computeMultiFactorScore(
          scored[i].r, q, scored[i].r.viewCount, scored[i].trustScore, i, officialDuration,
        );
      }
      scored.sort((a, b) => b.rankScore - a.rankScore);
      console.log('[search] Ranked by duration closeness + multi-factor');
    } else {
      // Without view counts, still use duration closeness as primary
      // with native position as lightweight tiebreaker.
      for (let i = 0; i < scored.length; i++) {
        const durScore = hasOfficialDuration
          ? computeDurationClosenessScore(scored[i].r.duration, officialDuration)
          : 0;
        scored[i].rankScore = durScore + (scored.length - i) * 0.1;
      }
      scored.sort((a, b) => b.rankScore - a.rankScore);
      console.log('[search] Ranked by duration closeness + native position');
    }

    // ── Step 4: Trust Filter + Duration Hard Filter ──
    const trustFiltered = scored.filter(s => s.trustScore >= 15).map(s => s.r);
    const filtered = filterByExactDuration(trustFiltered, officialDuration);

    // Cache results
    searchCache.set(q, { results: filtered, ts: Date.now() });

    // Fire-and-forget: background verification
    verifySearchResults(filtered).catch(() => {});

    return filtered.slice(0, limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[search] ytmusic-api failed:', err);
    // Fallback to yt-dlp search — yt-dlp reliably returns view_count
    const fallback = await searchWithYtdlp(q, limit * 2);

    const scored = fallback.map((r, i) => ({
      r,
      trustScore: computeTrustScore(r),
      rankScore: 0,
    }));

    // Compute official duration BEFORE scoring (same approach as primary path)
    const officialDuration = getOfficialDuration(
      scored.map(s => ({ r: s.r, score: s.trustScore })),
    );
    const hasOfficialDuration = officialDuration > 0;
    const meaningfulViewCounts = fallback.filter(r => (r.viewCount ?? 0) > 1000).length >= 3;

    if (meaningfulViewCounts) {
      for (let i = 0; i < scored.length; i++) {
        scored[i].rankScore = computeMultiFactorScore(
          scored[i].r, q, scored[i].r.viewCount, scored[i].trustScore, i, officialDuration,
        );
      }
      scored.sort((a, b) => b.rankScore - a.rankScore);
    } else {
      // Duration closeness primary + native position as tiebreaker
      for (let i = 0; i < scored.length; i++) {
        const durScore = hasOfficialDuration
          ? computeDurationClosenessScore(scored[i].r.duration, officialDuration)
          : 0;
        scored[i].rankScore = durScore + (scored.length - i) * 0.1;
      }
      scored.sort((a, b) => b.rankScore - a.rankScore);
    }

    const trustFiltered = scored.filter(s => s.trustScore >= 15).map(s => s.r);
    const filtered = filterByExactDuration(trustFiltered, officialDuration);
    verifySearchResults(filtered).catch(() => {});
    return filtered.slice(0, limit);
  }
}

async function searchWithYtdlp(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const youtubedl = (await import('youtube-dl-exec')).default;
    let ytExec: any;
    try { ytExec = youtubedl.create(YTDLP_PATH); } catch { ytExec = youtubedl; }

    const result = await ytExec(`ytsearch${limit}:${query}`, {
      dumpSingleJson: true as any,
      noWarnings: true,
      quiet: true,
      noCheckCertificates: true,
      flatPlaylist: true as any,
      matchFilter: 'duration>=30 & duration<=720 & view_count>100' as any,
    });

    const data = typeof result === 'string' ? JSON.parse(result) : result;
    const entries: SearchResult[] = [];

    const processEntry = (entry: any) => {
      if (!entry.id) return;
      let artist = entry.uploader || entry.channel || '';
      let title = entry.title || '';
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = artist || parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }
      entries.push({
        id: entry.id,
        title,
        artist,
        duration: entry.duration || 0,
        thumbnail: entry.thumbnail || getBestThumbnail(entry.thumbnails, entry.id),
        url: `https://www.youtube.com/watch?v=${entry.id}`,
        viewCount: entry.view_count || undefined,
      });
    };

    if (data._type === 'playlist' && data.entries) {
      data.entries.forEach(processEntry);
    } else if (data.id) {
      processEntry(data);
    }

    return entries;
  } catch (err) {
    const msg2 = err instanceof Error ? err.message : String(err);
    console.error('[search] yt-dlp fallback failed:', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Background Verification
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify a single video by running yt-dlp --dump-json and storing the result
 * in the SQLite verification cache. Updates the cached entry even if the
 * video fails verification (so we know not to try again).
 */
async function verifySingleTrack(videoId: string, title: string, artist: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync(
      YTDLP_PATH,
      ['-j', '--no-warnings', `https://www.youtube.com/watch?v=${videoId}`],
      { timeout: 10_000 },
    );

    const data = JSON.parse(stdout);
    const channel = data.channel || data.uploader || '';
    const availability = data.availability || 'public';
    const liveStatus = data.live_status || 'not_live';
    const duration = data.duration || 0;
    const hasAudio = (data.formats || []).some((f: any) => f.audio_ext && f.audio_ext !== 'none');
    const isPlayable = (
      availability === 'public' &&
      liveStatus === 'not_live' &&
      duration >= 30 &&
      duration <= 900 &&
      hasAudio
    );

    const trustScore = computeTrustScore({ title, artist, duration });

    setVerifiedTrack({
      videoId,
      verified: true,
      playable: isPlayable,
      trustScore,
      channel,
      availability,
      liveStatus,
      duration,
      hasAudio,
      lastChecked: new Date().toISOString(),
    });
  } catch (err: any) {
    // Store as failed verification so we don't retry
    setVerifiedTrack({
      videoId,
      verified: true,
      playable: false,
      trustScore: 0,
      channel: '',
      availability: err.message?.includes('Private video') ? 'private' : 'error',
      liveStatus: 'unknown',
      duration: 0,
      hasAudio: false,
      lastChecked: new Date().toISOString(),
    });
  }
}

/**
 * Verify search results in the background, storing results in the SQLite
 * verification cache. Verified results are then available instantly for
 * resolve-time validation.
 *
 * Runs verifications with limited concurrency to avoid hammering yt-dlp.
 */
async function verifySearchResults(results: SearchResult[]): Promise<void> {
  // Clean old entries first
  try { clearExpiredVerifiedTracks(); } catch {}

  const CONCURRENCY = 3;
  const queue = [...results];
  const running: Promise<void>[] = [];

  for (let i = 0; i < CONCURRENCY && queue.length > 0; i++) {
    runNext();
  }

  function runNext(): void {
    const next = queue.shift();
    if (!next) return;
    const p = verifySingleTrack(next.id, next.title, next.artist).finally(() => {
      const idx = running.indexOf(p);
      if (idx !== -1) running.splice(idx, 1);
      if (queue.length > 0) runNext();
    });
    running.push(p);
  }

  // Wait for all to complete so the function is actually done when awaited
  await Promise.all(running);
}

// ═══════════════════════════════════════════════════════════════════════════
//  IPC Handlers
// ═══════════════════════════════════════════════════════════════════════════

export function registerSearchHandlers(): void {
  ipcMain.handle('search:youtube', async (_event, query: string, limit?: number): Promise<SearchResult[]> => {
    return searchMusic(query, limit || 20);
  });

  /**
   * Trigger background verification for a set of search results.
   * The caller should call this after displaying search results to the user.
   */
  ipcMain.handle('search:verify', async (_event, results: Array<{ id: string; title: string; artist: string }>) => {
    const mapped: SearchResult[] = results.map(r => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      duration: 0,
      thumbnail: '',
      url: '',
    }));
    await verifySearchResults(mapped);
    return { ok: true };
  });

  /**
   * Batch-lookup verification status for a list of video IDs.
   * Returns a map of videoId → verification data.
   */
  ipcMain.handle('search:getVerified', async (_event, videoIds: string[]) => {
    const map = getVerifiedTracksBatch(videoIds);
    const result: Record<string, any> = {};
    for (const [id, v] of map) {
      result[id] = v;
    }
    return result;
  });
}
