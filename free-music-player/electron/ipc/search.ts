import { ipcMain } from 'electron';
import type { SearchResult } from '../utils/types';

// YouTube Music search via ytmusic-api
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

async function searchMusic(query: string, limit: number): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Check cache
  const cached = searchCache.get(q);
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.results.slice(0, limit);
  }

  try {
    const yt = await getYTMusic();
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

    const ranked = rankSearchResults(Array.from(deduped.values()), q);
    searchCache.set(q, { results: ranked, ts: now });
    return ranked.slice(0, limit);
  } catch (err) {
    console.error('[search] ytmusic-api failed:', err);
    // Fallback to yt-dlp search if ytmusic-api fails
    return searchWithYtdlp(q, limit);
  }
}

async function searchWithYtdlp(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const youtubedl = (await import('youtube-dl-exec')).default;
    const YT_DLP_PATH = '/Users/jackfu/Library/Python/3.9/bin/yt-dlp';
    let ytExec: any;
    try { ytExec = youtubedl.create(YT_DLP_PATH); } catch { ytExec = youtubedl; }

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
    console.error('[search] yt-dlp fallback failed:', err);
    return [];
  }
}

/**
 * Re-rank search results to prefer official audio and demote covers/lyrics/live.
 */
function rankSearchResults(results: SearchResult[], query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  const qWords = q.split(/[\s,&\-_]+/).filter(w => w.length > 2 && !['the','and','for','with','from'].includes(w));

  const scored = results.map((r) => {
    const t = r.title.toLowerCase();
    const a = r.artist.toLowerCase();
    let score = 0;

    // Positive: official audio
    if (/\bofficial\s+audio\b/i.test(r.title)) score += 15;
    else if (/\(audio\)/i.test(r.title)) score += 12;
    else if (/\b(audio\s+only|audio)\b/i.test(r.title)) score += 8;
    if (/\bofficial\b/i.test(r.title)) score += 4;

    // Negative: video content
    if (/\b(off?icial\s+music\s+video|off?icial\s+video|off?icial\s+mv)\b/i.test(r.title)) score -= 15;
    if (/\bmusic\s+video\b/i.test(r.title)) score -= 12;
    if (/\bvevo\b/i.test(r.title)) score -= 10;
    if (/\blyric\s+video\b/i.test(r.title)) score -= 8;

    // Negative: non-official
    if (/\blyrics?\b/i.test(r.title)) score -= 12;
    if (/\bkaraoke\b/i.test(r.title)) score -= 12;
    if (/\bcover\b/i.test(r.title)) score -= 8;
    if (/\b(remix|remixed)\b/i.test(r.title)) score -= 6;
    if (/\b(sped\s*up|slowed|reverb)\b/i.test(r.title)) score -= 6;
    if (/\b(live|concert|tour)\b/i.test(r.title)) score -= 5;
    if (/\b(1\s*hour|10\s*hours|loop)\b/i.test(r.title)) score -= 10;

    // Relevance: at least one query word must appear
    if (qWords.length > 0) {
      const hasMatch = qWords.some(w => t.includes(w) || a.includes(w));
      if (!hasMatch) score -= 100;
    }

    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > -50).map(s => s.r);
}

export function registerSearchHandlers(): void {
  ipcMain.handle('search:youtube', async (_event, query: string, limit?: number) => {
    return searchMusic(query, limit || 20);
  });
}
