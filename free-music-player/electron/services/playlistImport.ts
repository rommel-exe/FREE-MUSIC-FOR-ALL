/**
 * Unified playlist import service.
 *
 * Handles both YouTube and Spotify playlist URLs.
 * YouTube: uses yt-dlp --flat-playlist to get track data quickly.
 * Spotify: tries the embed page (__NEXT_DATA__) first, falls back to a
 * hidden BrowserWindow for playlists with >100 tracks.
 *
 * For Spotify tracks (which have no YouTube ID), searches YouTube Music
 * using exact-duration matching to find the official audio track before
 * importing — same stringent logic as the search function.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BrowserWindow } from 'electron';
import {
  computeTrustScore,
  computeDurationClosenessScore,
  getOfficialDuration,
  filterByExactDuration,
  computeMultiFactorScore,
} from '../utils/searchMatching';

const execFileAsync = promisify(execFile);

const YTDLP_PATH =
  '/Library/Frameworks/Python.framework/Versions/3.12/bin/yt-dlp';

// ── Types ────────────────────────────────────────────────────────────────

export interface PlaylistTrack {
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  youtubeId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Exact-Duration YouTube Search (same logic as search.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Search YouTube Music for a track and resolve to the exact-duration match.
 * Uses the full multi-factor scoring pipeline (same as search.ts).
 * Returns the YouTube videoId or null if no exact match found.
 */
async function searchExactYouTubeMatch(
  artist: string,
  title: string,
  expectedDuration: number,
): Promise<string | null> {
  try {
    const mod = await import('ytmusic-api');
    const YTMusic = mod.default;
    const yt = new YTMusic();
    await yt.initialize();

    const query = `${artist} ${title}`.trim();
    const results = await yt.searchSongs(query);
    if (!results || results.length === 0) return null;

    // Step 1: Compute trust scores for ALL results (not just exact matches)
    const queryStr = query;
    const scored = results.map((r: any, i: number) => ({
      r,
      trustScore: computeTrustScore(
        r.name || r.title || '',
        r.artist?.name || '',
        r.duration ?? 0,
      ),
      rankScore: 0,
    }));

    // Step 2: Determine official duration via trust-weighted voting
    const officialDuration = getOfficialDuration(
      scored.map(s => ({ duration: s.r.duration ?? 0, score: s.trustScore })),
    );

    // Use expected duration from Spotify if official determination fails
    const targetDuration = officialDuration > 0 ? officialDuration : expectedDuration;
    if (targetDuration <= 0) return null;

    // Step 3: Score ALL results using the full multi-factor score
    for (let i = 0; i < scored.length; i++) {
      scored[i].rankScore = computeMultiFactorScore({
        duration: scored[i].r.duration ?? 0,
        query: queryStr,
        artist: scored[i].r.artist?.name || '',
        trustScore: scored[i].trustScore,
        nativePosition: i,
        officialDuration: targetDuration,
      });
    }

    // Step 4: Sort by multi-factor score (exact-duration matches ALWAYS rank first)
    scored.sort((a: any, b: any) => b.rankScore - a.rankScore);

    // Step 5: Filter to only tracks passing trust threshold + exact duration
    const trustFiltered = scored
      .filter(s => s.trustScore >= 15)
      .map(s => s.r);
    
    const exactDurationResults = filterByExactDuration(
      trustFiltered,
      targetDuration,
    );

    // Step 6: If we have results, the top one is the best match
    if (exactDurationResults.length > 0) {
      return exactDurationResults[0].videoId || exactDurationResults[0].id || null;
    }

    return null;
  } catch (err) {
    console.error(`[Import] YouTube search failed for "${artist} - ${title}":`, err);
    return null;
  }
}

/**
 * Enrich Spotify playlist tracks with YouTube videoIds using exact-duration matching.
 * Runs searches with limited concurrency to avoid rate-limiting.
 */
export async function resolveYoutubeIds(
  tracks: PlaylistTrack[],
  onProgress?: (message: string) => void,
): Promise<PlaylistTrack[]> {
  const CONCURRENCY = 3;
  const results: PlaylistTrack[] = [];
  let completed = 0;
  const total = tracks.length;

  // Process in batches of CONCURRENCY
  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const batch = tracks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (track) => {
        if (track.youtubeId) return track; // Already has an ID
        const videoId = await searchExactYouTubeMatch(
          track.artist, track.title, track.duration,
        );
        completed++;
        if (onProgress) {
          onProgress(`Matching track ${completed}/${total} to YouTube...`);
        }
        return {
          ...track,
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
  console.log(`[Import] YouTube matching: ${matched}/${total} tracks resolved`);
  return results;
}

export interface PlaylistImportResult {
  name: string;
  thumbnail?: string;
  tracks: PlaylistTrack[];
}

/**
 * Pick the best (highest-resolution / highest-preference) thumbnail URL from
 * a yt-dlp thumbnails array. yt-dlp returns objects like
 *   { url, width, height, id, preference }
 * where `preference` is yt-dlp's own ranking (higher = better).
 */
function pickBestThumbnail(thumbnails: any): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  const sorted = [...thumbnails]
    .filter((t: any) => typeof t?.url === 'string' && t.url)
    .sort((a: any, b: any) => {
      const pref = (b.preference ?? 0) - (a.preference ?? 0);
      if (pref !== 0) return pref;
      return (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0);
    });
  return sorted[0]?.url || '';
}

// ── YouTube Import ───────────────────────────────────────────────────────

/**
 * Import a YouTube playlist by URL.
 * Uses yt-dlp --flat-playlist --dump-single-json for speed.
 */
export async function importYouTubePlaylist(
  url: string,
): Promise<PlaylistImportResult> {
  const trimmed = url.trim();
  if (
    !trimmed.includes('youtube.com') &&
    !trimmed.includes('youtu.be') &&
    !trimmed.includes('music.youtube.com')
  ) {
    throw new Error('Invalid YouTube URL');
  }

  try {
    const { stdout } = await execFileAsync(
      YTDLP_PATH,
      [
        '--flat-playlist',
        '--dump-single-json',
        '--no-warnings',
        trimmed,
      ],
      { timeout: 30_000 },
    );

    const data = JSON.parse(stdout);

    if (!data || !data.entries || data.entries.length === 0) {
      throw new Error('No tracks found in this YouTube playlist');
    }

    const tracks: PlaylistTrack[] = data.entries.map((entry: any) => {
      let artist = entry.uploader || entry.channel || '';
      let title = entry.title || '';

      // Split "Artist - Title" pattern
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = artist || parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }

      const thumbnail =
        entry.thumbnail ||
        entry.thumbnails?.[0]?.url ||
        '';

      return {
        title,
        artist,
        duration: typeof entry.duration === 'number' ? entry.duration : 0,
        thumbnail,
        youtubeId: entry.id || '',
      };
    });

    return {
      name: data.title || 'Imported YouTube Playlist',
      thumbnail: pickBestThumbnail(data.thumbnails) || data.thumbnail || '',
      tracks,
    };
  } catch (err: any) {
    if (err.message?.includes('Invalid YouTube URL')) throw err;
    throw new Error(`YouTube import failed: ${err.message}`);
  }
}

// ── Spotify Import ───────────────────────────────────────────────────────

const SPOTIFY_EMBED = 'https://open.spotify.com/embed';
const SPOTIFY_OPEN = 'https://open.spotify.com';

/**
 * Extract a Spotify playlist ID from a URL.
 */
function extractSpotifyId(url: string): string {
  const match = url.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error('Invalid Spotify playlist URL');
  return match[1];
}

/**
 * Get cover art URL from a Spotify entity.
 */
function getCoverUrl(entity: any): string {
  // Try coverArt.sources (embed API format)
  const sources = entity?.coverArt?.sources;
  if (Array.isArray(sources) && sources.length > 0) {
    return sources[sources.length - 1].url || '';
  }
  // Try images array
  if (Array.isArray(entity?.images) && entity.images.length > 0) {
    return entity.images[0].url || '';
  }
  return '';
}

/**
 * Fetch a clean square cover URL from Spotify's public oEmbed endpoint.
 * More reliable than the embed page (which can be private/region-locked)
 * and returns a proper album-art-sized image.
 */
async function fetchSpotifyOembedCover(playlistId: string): Promise<string> {
  try {
    const oe = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`${SPOTIFY_OPEN}/playlist/${playlistId}`)}`,
    );
    if (!oe.ok) return '';
    const data: any = await oe.json();
    return typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : '';
  } catch {
    return '';
  }
}

/**
 * Recursively search JSON for a playlist entity node.
 * Looks for an object with a `trackList` array and `name` string.
 */
function findPlaylistEntity(node: any, depth = 0): any | null {
  if (depth > 10 || node === null || node === undefined) return null;
  if (typeof node !== 'object') return null;
  if (
    Array.isArray(node.trackList) &&
    node.trackList.length > 0 &&
    typeof node.name === 'string'
  ) {
    return node;
  }
  for (const key of Object.keys(node)) {
    try {
      const result = findPlaylistEntity(node[key], depth + 1);
      if (result) return result;
    } catch {
      // skip circular refs etc.
    }
  }
  return null;
}

/**
 * Normalize track data from Spotify's trackList format.
 */
function normalizeTracks(trackList: any[]): PlaylistTrack[] {
  return trackList.map((t: any) => {
    let title = '';
    if (typeof t.title === 'string') title = t.title;
    else if (typeof t.name === 'string') title = t.name;

    let artist = '';
    if (typeof t.subtitle === 'string') artist = t.subtitle;
    else if (Array.isArray(t.subtitles) && t.subtitles.length > 0) {
      artist = t.subtitles[0].name || t.subtitles[0];
    }
    if (!artist && Array.isArray(t.artists)) {
      artist = t.artists.map((a: any) => a.name || a).filter(Boolean).join(', ');
    }

    let duration = 0;
    if (typeof t.duration === 'number') duration = t.duration;
    else if (typeof t.duration_ms === 'number') duration = t.duration_ms;
    // Convert ms to seconds if it looks like milliseconds
    if (duration > 10000) duration = Math.round(duration / 1000);

    const thumbnail = t.thumbnail || t.coverArt?.sources?.[0]?.url || '';

    return { title, artist, duration, thumbnail };
  });
}

/**
 * Strategy 1: Fetch Spotify embed page and parse __NEXT_DATA__.
 * Fast but limited to ~100 tracks.
 */
async function fetchEmbedPage(embedUrl: string): Promise<any> {
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'Playlist not found on Spotify (404). It may be private, deleted, or region-restricted.',
      );
    }
    throw new Error(
      `Spotify embed fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  const match = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error('Could not find __NEXT_DATA__ in Spotify embed page');
  }

  let json: any;
  try {
    json = JSON.parse(match[1]);
  } catch (e: any) {
    throw new Error(`Failed to parse __NEXT_DATA__ JSON: ${e.message}`);
  }

  if (json?.props?.pageProps?.status === 404) {
    throw new Error(
      `Playlist not found on Spotify (404). Title: ${json?.props?.pageProps?.title || 'unknown'}`,
    );
  }

  let entity = json?.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    entity = findPlaylistEntity(json);
  }
  if (!entity) {
    throw new Error('Could not extract playlist entity from __NEXT_DATA__');
  }
  return entity;
}

/**
 * Strategy 2: Use a hidden BrowserWindow to load the full Spotify page,
 * scroll to load all tracks, and extract from the DOM.
 */
async function fetchAllTracksViaBrowser(
  playlistId: string,
): Promise<{ name: string; thumbnail: string; tracks: PlaylistTrack[] }> {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      offscreen: false,
    },
  });

  try {
    const pageUrl = `${SPOTIFY_OPEN}/playlist/${playlistId}`;
    console.log(`[Spotify] Browser: loading ${pageUrl}`);
    await win.loadURL(pageUrl);
    console.log('[Spotify] Browser: page loaded, waiting for render...');

    // Wait for the page to render and load initial tracks
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Scroll to load all tracks (virtualized list)
    console.log('[Spotify] Browser: scrolling to load all tracks...');
    const scrollCount: number = await win.webContents.executeJavaScript(`
      (async () => {
        const scrollContainer =
          document.querySelector('[data-testid="infinite-scroll-list"]')
          || document.querySelector('[role="grid"]')
          || document.querySelector('main')
          || document.scrollingElement
          || document.body;

        let lastCount = 0;
        let stableRounds = 0;
        const maxRounds = 80;

        for (let i = 0; i < maxRounds; i++) {
          if (scrollContainer && scrollContainer.scrollHeight) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
          window.scrollTo(0, document.body.scrollHeight);

          scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));

          await new Promise(r => setTimeout(r, 600));

          const currentCount = document.querySelectorAll('[data-testid="track-row"]').length;

          if (currentCount === lastCount) {
            stableRounds++;
            if (stableRounds >= 4) break;
          } else {
            stableRounds = 0;
            lastCount = currentCount;
          }
        }
        return lastCount;
      })();
    `);
    console.log(
      `[Spotify] Browser: after scrolling, found ${scrollCount} track rows`,
    );

    // Extract playlist metadata and tracks from the DOM
    const result = await win.webContents.executeJavaScript(`
      (() => {
        const nameEl = document.querySelector('[data-testid="playlist-page"] h1, [data-testid="entityTitle"] h1, h1');
        const name = nameEl ? nameEl.textContent.trim() : 'Imported Spotify Playlist';
        const imgEl = document.querySelector('[data-testid="playlist-image"] img, [data-testid="cover-art"] img, img[src*="scdn.co"]');
        const thumbnail = imgEl ? imgEl.src : '';
        const trackRows = document.querySelectorAll('[data-testid="track-row"]');
        const tracks = [];
        trackRows.forEach(row => {
          const titleEl = row.querySelector('a[data-testid="internal-track-link"], a[href*="/track/"]');
          const artistEls = row.querySelectorAll('a[data-testid="internal-artist-link"], a[href*="/artist/"]');
          const allSpans = row.querySelectorAll('span');
          let duration = 0;
          for (const span of allSpans) {
            const text = span.textContent.trim();
            if (/^\\d+:\\d{2}(:\\d{2})?$/.test(text)) {
              const parts = text.split(':').map(Number);
              if (parts.length === 2) duration = parts[0] * 60 + parts[1];
              else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
              break;
            }
          }
          if (titleEl) {
            const title = titleEl.textContent.trim();
            const artist = Array.from(artistEls).map(a => a.textContent.trim()).join(', ');
            if (title) {
              tracks.push({ title, artist: artist || '', duration, thumbnail: '' });
            }
          }
        });
        return { name, thumbnail, tracks };
      })();
    `);

    console.log(
      `[Spotify] Browser extracted: name="${result.name}", tracks=${result.tracks.length}`,
    );

    return {
      name: result.name,
      thumbnail: result.thumbnail,
      tracks: result.tracks,
    };
  } catch (err: any) {
    console.error(`[Spotify] Browser extraction error: ${err.message}`);
    throw err;
  } finally {
    win.destroy();
  }
}

/**
 * Import a Spotify playlist by URL.
 * Tries the fast embed strategy first, falls back to BrowserWindow.
 */
export async function importSpotifyPlaylist(
  url: string,
): Promise<PlaylistImportResult> {
  const trimmed = url.trim();
  if (!trimmed.includes('spotify.com')) {
    throw new Error('Invalid Spotify URL');
  }

  const id = extractSpotifyId(trimmed);
  const embedUrl = `${SPOTIFY_EMBED}/playlist/${id}?utm_source=generator`;

  // Strategy 1: Fast embed page
  const entity = await fetchEmbedPage(embedUrl);
  const trackList: any[] = Array.isArray(entity.trackList) ? entity.trackList : [];
  const tracks = normalizeTracks(trackList);
  const playlistName = entity.name || entity.title || 'Imported Spotify Playlist';
  const embedThumbnail = getCoverUrl(entity);

  // oEmbed is a more reliable cover source (clean square, public, no region
  // lock). Run it in parallel-ish: start it, then take whichever wins.
  const oembedThumbnail = await fetchSpotifyOembedCover(id);
  const thumbnail = oembedThumbnail || embedThumbnail;

  // If we got 100 tracks, the playlist likely has more — try the browser
  if (tracks.length >= 100) {
    try {
      console.log(
        `[Spotify] Got ${tracks.length} from embed, trying browser for full list...`,
      );
      const browserResult = await fetchAllTracksViaBrowser(id);
      if (browserResult.tracks.length > tracks.length) {
        console.log(
          `[Spotify] Browser got ${browserResult.tracks.length} tracks (more than embed)`,
        );
        return {
          name: browserResult.name || playlistName,
          thumbnail: browserResult.thumbnail || thumbnail,
          tracks: browserResult.tracks.map((t) => ({
            ...t,
            thumbnail: t.thumbnail || browserResult.thumbnail || thumbnail,
          })),
        };
      }
    } catch (err: any) {
      console.warn(
        `[Spotify] Browser extraction failed, falling back to embed data:`,
        err.message,
      );
    }
  }

  return { name: playlistName, thumbnail, tracks };
}
