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
 * Score components:
 *   Topic channel              +100
 *   "Official Audio"           +50
 *   YouTube Music Song result  +50  (baked in — all results here are songs)
 *   VEVO                       +20
 *   Duration sweet spot        +10
 *   Has artist metadata         +5
 *                              ═══
 *   Max possible               235
 *
 *   Live / Concert             -1000
 *   Remix                      -500
 *   Cover                      -500
 *   Karaoke / Instrumental     -500
 *   Nightcore / Sped/Slowed    -300
 *   Loop / Hour compilations   -300
 *   Lyric video (non-official) -200
 *
 *   Threshold: score >= 80 → keep
 *              score < 80  → discard
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
  if (/\b(live|concert)\b/i.test(titleLower))               score -= 1000;
  if (/\b(remix|remixed)\b/i.test(titleLower))              score -= 500;
  if (/\bcover\b/i.test(titleLower))                         score -= 500;
  if (/\b(karaoke|instrumental)\b/i.test(titleLower))       score -= 500;
  if (/\b(nightcore|sped\s*up|slowed|reverb)\b/i.test(titleLower)) score -= 300;
  if (/\b(1\s*hour|10\s*hours|loop|compilation|megamix)\b/i.test(titleLower)) score -= 300;
  if (/\blyric\s+video\b/i.test(titleLower) && !/\bofficial\b/i.test(titleLower)) score -= 200;

  return score;
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
    // searchSongs filters to YouTube Music song results only
    const results = await yt.searchSongs(q);

    const mapped: SearchResult[] = (results || []).map((item: any) => ({
      id: item.videoId || '',
      title: item.name || item.title || '',
      artist: item.artist?.name || '',
      duration: typeof item.duration === 'number' ? item.duration : 0,
      thumbnail: item.thumbnails?.[0]?.url || '',
      url: `https://www.youtube.com/watch?v=${item.videoId || ''}`,
    })).filter((r: SearchResult) => r.id);

    // Dedup by id
    const deduped = new Map<string, SearchResult>();
    for (const r of mapped) {
      if (!deduped.has(r.id)) deduped.set(r.id, r);
    }
    const unique = Array.from(deduped.values());

    // ── Apply Trust Score ──
    const scored = unique.map(r => ({ r, score: computeTrustScore(r) }));
    scored.sort((a, b) => b.score - a.score);
    const filtered = scored.filter(s => s.score >= 80).map(s => s.r);

    // Cache results
    searchCache.set(q, { results: filtered, ts: Date.now() });

    // ── Fire-and-forget: background verification ──
    // Don't await — results are shown immediately; verification fills the cache.
    verifySearchResults(filtered).catch(() => {});

    return filtered.slice(0, limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[search] ytmusic-api failed:', err);
    // Fallback to yt-dlp search if ytmusic-api fails
    const fallback = await searchWithYtdlp(q, limit * 2);
    const scored = fallback.map(r => ({ r, score: computeTrustScore(r) }));
    scored.sort((a, b) => b.score - a.score);
    const filtered = scored.filter(s => s.score >= 80).map(s => s.r);
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
        thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || '',
        url: `https://www.youtube.com/watch?v=${entry.id}`,
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
