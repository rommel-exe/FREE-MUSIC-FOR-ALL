import { ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SearchResult } from '../utils/types';
import { getVerifiedTrack, setVerifiedTrack, getVerifiedTracksBatch, clearExpiredVerifiedTracks } from '../utils/database';
import {
  computeTrustScore,
  computeDurationClosenessScore,
  getOfficialDuration,
  filterByExactDuration,
  computeMultiFactorScore,
} from '../utils/searchMatching';

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
      trustScore: computeTrustScore(r.title, r.artist, r.duration),
      rankScore: 0,
    }));

    // Compute official duration BEFORE scoring so it can be used as the
    // primary ranking signal (not just a post-hoc filter).
    const officialDuration = getOfficialDuration(
      scored.map(s => ({ duration: s.r.duration, score: s.trustScore })),
    );
    const hasOfficialDuration = officialDuration > 0;

    const meaningfulViewCounts = unique.filter(r => (r.viewCount ?? 0) > 1000).length >= 3;

    if (meaningfulViewCounts) {
      // Full scoring: duration closeness (0-100) + all tiebreakers
      for (let i = 0; i < scored.length; i++) {
        scored[i].rankScore = computeMultiFactorScore({
          duration: scored[i].r.duration,
          query: q,
          artist: scored[i].r.artist,
          viewCount: scored[i].r.viewCount,
          trustScore: scored[i].trustScore,
          nativePosition: i,
          officialDuration,
        });
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
      trustScore: computeTrustScore(r.title, r.artist, r.duration),
      rankScore: 0,
    }));

    // Compute official duration BEFORE scoring (same approach as primary path)
    const officialDuration = getOfficialDuration(
      scored.map(s => ({ duration: s.r.duration, score: s.trustScore })),
    );
    const hasOfficialDuration = officialDuration > 0;
    const meaningfulViewCounts = fallback.filter(r => (r.viewCount ?? 0) > 1000).length >= 3;

    if (meaningfulViewCounts) {
      for (let i = 0; i < scored.length; i++) {
        scored[i].rankScore = computeMultiFactorScore({
          duration: scored[i].r.duration,
          query: q,
          artist: scored[i].r.artist,
          viewCount: scored[i].r.viewCount,
          trustScore: scored[i].trustScore,
          nativePosition: i,
          officialDuration,
        });
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

    const trustScore = computeTrustScore(title, artist, duration);

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
