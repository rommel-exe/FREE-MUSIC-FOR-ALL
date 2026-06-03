import { ipcMain } from 'electron';
import { getStreamUrl, getLocalStreamPath } from '../services/ytdl';
import type { SearchResult } from '../utils/types';

// YouTube Music search via ytmusic-api — returns ONLY songs, no tutorials/memes
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

async function searchMusic(query: string, limit: number): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // ── Cache: same query within CACHE_TTL_MS returns the same results.
  // This means typing the same search twice in a row doesn't hit YouTube again.
  const cached = searchCache.get(q);
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    console.log(`[search] cache hit for "${q}"`);
    return cached.results.slice(0, limit);
  }

  // ── Fetch more results than we need so the ranker has good candidates
  const fetchCount = Math.min(40, Math.max(limit * 3, 25));
  const raw = await searchYouTubeFallback(q, fetchCount);

  // ── Rank + dedup by videoId (YouTube sometimes returns the same video twice)
  const deduped = new Map<string, SearchResult>();
  for (const r of raw) {
    if (r.id && !deduped.has(r.id)) deduped.set(r.id, r);
  }
  const ranked = rankSearchResults(Array.from(deduped.values()), q);

  // ── Persist to cache
  searchCache.set(q, { results: ranked, ts: now });

  return ranked.slice(0, limit);
}

// ── In-memory search cache: query → results + timestamp ────────────────
const searchCache = new Map<string, { results: SearchResult[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Exposed for testing / debugging
export function clearSearchCache() {
  searchCache.clear();
}

/**
 * Re-rank search results to prefer official versions and demote
 * covers, lyrics videos, live performances, and unrelated tracks.
 *
 * Positive signals: "official", "music video", "audio", "vevo"
 * Negative signals: "lyrics", "karaoke", "cover", "remix", "live",
 *                   "remastered", "8d", "sped up", "slowed", "1 hour"
 * Hard filter: drop results that have no overlap with the query at all
 */
function rankSearchResults(results: SearchResult[], query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  // Use the meaningful words from the query (length > 2, skip "the"/"and"/etc.)
  const qWords = q.split(/[\s,&\-_]+/).filter(w => w.length > 2 && !['the','and','for','with','from'].includes(w));

  const scored = results.map((r) => {
    const t = r.title.toLowerCase();
    const a = r.artist.toLowerCase();
    let score = 0;

    // ── Positive: official AUDIO content (user wants audio only)
    if (/\bofficial\s+audio\b/i.test(r.title)) score += 15;
    else if (/\(audio\)/i.test(r.title)) score += 12;
    else if (/\b(audio\s+only|audio)\b/i.test(r.title)) score += 8;
    if (/\bofficial\b/i.test(r.title)) score += 4;

    // ── Negative: video / visual content
    if (/\b(off?icial\s+music\s+video|off?icial\s+video|off?icial\s+mv|off?icial\s+visualizer)\b/i.test(r.title)) score -= 15;
    if (/\bmusic\s+video\b/i.test(r.title)) score -= 12;
    if (/\bvevo\b/i.test(r.title)) score -= 10;
    if (/\blyric\s+video\b/i.test(r.title)) score -= 8;
    if (/\bvisualizer\b/i.test(r.title)) score -= 6;
    if (/\(mv\)|\bmv\b/i.test(r.title)) score -= 8;

    // ── Negative: non-official
    if (/\blyrics?\b/i.test(r.title)) score -= 12;
    if (/\bkaraoke\b/i.test(r.title)) score -= 12;
    if (/\bcover\b/i.test(r.title)) score -= 8;
    if (/\b(instrumental|piano\s+version|guitar\s+version)\b/i.test(r.title)) score -= 6;
    if (/\b(remix|remixed)\b/i.test(r.title)) score -= 6;
    if (/\b8d\b/i.test(r.title)) score -= 6;
    if (/\b(sped\s*up|slowed|reverb)\b/i.test(r.title)) score -= 6;
    if (/\b(live|concert|tour)\b/i.test(r.title)) score -= 5;
    if (/\b(remaster(ed)?)\b/i.test(r.title)) score -= 3;
    if (/\b(extended|radio\s+edit|clean|explicit)\b/i.test(r.title)) score -= 2;
    if (/\b(but\s+every|every\s+time|in\s+the\s+style\s+of|tribute\s+to)\b/i.test(r.title)) score -= 8;
    if (/\b(1\s*hour|10\s*hours|1hr|loop)\b/i.test(r.title)) score -= 10;
    if (/\b(behind\s+the\s+scenes|reaction|review|interview|podcast|essay)\b/i.test(r.title)) score -= 10;
    if (/\b(mashup|medley|best\s+of|compilation)\b/i.test(r.title)) score -= 4;

    // ── Relevance: at least one query word must appear in title or artist
    if (qWords.length > 0) {
      const hasMatch = qWords.some(w => t.includes(w) || a.includes(w));
      if (!hasMatch) score -= 100; // hard demote unrelated results
    }

    return { r, score };
  });

  // Sort by score desc, drop the worst (score < -50 means irrelevant)
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > -50).map(s => s.r);
}

async function searchYouTubeFallback(query: string, limit: number): Promise<SearchResult[]> {
  const youtubedl = (await import('youtube-dl-exec')).default;
  const YT_DLP_PATH = '/Users/jackfu/Library/Python/3.9/bin/yt-dlp';
  let ytExec: any;
  try { ytExec = youtubedl.create(YT_DLP_PATH); } catch { ytExec = youtubedl; }

  // Fetch more than we need so the ranker has good candidates to choose from.
  // Also use yt-dlp's native match-filter to drop obviously non-music content
  // (very long videos, very short clips) before they even hit the ranker.
  const fetchCount = Math.min(40, Math.max(limit * 3, 25));
  const result = await ytExec(`ytsearch${fetchCount}:${query}`, {
    dumpSingleJson: true as any,
    noWarnings: true,
    quiet: true,
    noCheckCertificates: true,
    flatPlaylist: true as any,
    // YouTube search filter: only videos (skip channels/playlists)
    // and only reasonable music lengths (30s to 12 min)
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
}

export function registerSearchHandlers(): void {
  ipcMain.handle('search:youtube', async (_event, query: string, limit?: number) => {
    return searchMusic(query, limit || 20);
  });

  ipcMain.handle('search:getStreamUrl', async (_event, videoId: string) => {
    return getStreamUrl(videoId);
  });

  ipcMain.handle('search:getLocalStreamPath', async (_event, videoId: string) => {
    return getLocalStreamPath(videoId);
  });
}
