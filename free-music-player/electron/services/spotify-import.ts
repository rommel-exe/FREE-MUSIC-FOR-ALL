/**
 * Spotify playlist import via direct embed page parsing.
 * Uses two strategies:
 * 1. Fetch the embed page HTML and parse __NEXT_DATA__ (gets first 100 tracks, fast)
 * 2. If the playlist has more tracks, use a hidden BrowserWindow to render the
 *    non-embed page and extract all tracks from the DOM
 * No API key required.
 */

import { BrowserWindow } from 'electron';

const SPOTIFY_EMBED = 'https://open.spotify.com/embed';
const SPOTIFY_OPEN = 'https://open.spotify.com';

interface SpotifyTrack {
  title: string;
  artist: string;
  album: string;
  duration: number;
}

interface SpotifyPlaylist {
  name: string;
  description: string;
  thumbnail: string;
  tracks: SpotifyTrack[];
}

function extractId(url: string, type: 'playlist' | 'album' | 'track'): string {
  const m = url.match(new RegExp(`open\\.spotify\\.com\\/${type}\\/([a-zA-Z0-9]+)`));
  if (!m) throw new Error(`Invalid Spotify ${type} URL: ${url}`);
  return m[1];
}

function getCoverUrl(entity: any): string {
  const sources = entity?.coverArt?.sources;
  if (Array.isArray(sources) && sources.length > 0) {
    return sources[sources.length - 1].url || '';
  }
  return '';
}

/**
 * Deep-search a parsed JSON object for the first node that has
 * both a `trackList` array and a `name` string — that's a playlist entity.
 */
function findPlaylistEntity(node: any, depth = 0): any | null {
  if (depth > 10 || node === null || node === undefined) return null;
  if (typeof node !== 'object') return null;
  if (Array.isArray(node.trackList) && node.trackList.length > 0 && typeof node.name === 'string') {
    return node;
  }
  for (const key of Object.keys(node)) {
    try {
      const result = findPlaylistEntity(node[key], depth + 1);
      if (result) return result;
    } catch {
      // skip
    }
  }
  return null;
}

function normalizeTracks(trackList: any[]): SpotifyTrack[] {
  return trackList.map((t: any) => {
    let title = '';
    if (typeof t.title === 'string') title = t.title;
    else if (typeof t.name === 'string') title = t.name;

    let artist = '';
    if (typeof t.subtitle === 'string') artist = t.subtitle;
    else if (Array.isArray(t.artists)) {
      artist = t.artists.map((a: any) => a.name || a).filter(Boolean).join(', ');
    } else if (Array.isArray(t.authors)) {
      artist = t.authors.map((a: any) => a.name).filter(Boolean).join(', ');
    }

    let duration = 0;
    if (typeof t.duration === 'number') duration = t.duration;
    else if (typeof t.duration_ms === 'number') duration = t.duration_ms;
    if (duration > 10000) duration = Math.round(duration / 1000);

    return { title, artist, album: '', duration };
  });
}

async function fetchEmbedPage(embedUrl: string): Promise<any> {
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Playlist not found on Spotify (404). It may be private, deleted, or region-restricted.');
    }
    throw new Error(`Spotify embed fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Could not find __NEXT_DATA__ in Spotify embed page');

  let json: any;
  try {
    json = JSON.parse(match[1]);
  } catch (e: any) {
    throw new Error(`Failed to parse __NEXT_DATA__ JSON: ${e.message}`);
  }

  if (json?.props?.pageProps?.status === 404) {
    throw new Error(`Playlist not found on Spotify (404). Title: ${json?.props?.pageProps?.title || 'unknown'}`);
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
 * Extract all tracks from the non-embed page using a hidden BrowserWindow.
 * Renders the full Spotify web player page, scrolls to load all tracks,
 * then extracts track data from the DOM.
 */
async function fetchAllTracksViaBrowser(playlistId: string): Promise<{ name: string; thumbnail: string; tracks: SpotifyTrack[] }> {
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
    console.log(`[Spotify] Browser: page loaded, waiting for render...`);

    // Wait for the page to render and load initial tracks
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Scroll the page to load all tracks (virtualized list)
    console.log(`[Spotify] Browser: scrolling to load all tracks...`);
    const scrollCount: number = await win.webContents.executeJavaScript(`
      (async () => {
        // Find the scrollable container — try multiple selectors
        const scrollContainer = document.querySelector('[data-testid="infinite-scroll-list"]')
          || document.querySelector('[role="grid"]')
          || document.querySelector('main')
          || document.scrollingElement
          || document.body;

        let lastCount = 0;
        let stableRounds = 0;
        const maxRounds = 80;

        for (let i = 0; i < maxRounds; i++) {
          // Scroll the container to bottom
          if (scrollContainer && scrollContainer.scrollHeight) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
          // Also scroll window
          window.scrollTo(0, document.body.scrollHeight);

          // Dispatch scroll event to trigger lazy loading
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
    console.log(`[Spotify] Browser: after scrolling, found ${scrollCount} track rows`);

    // Extract playlist metadata and tracks
    const result = await win.webContents.executeJavaScript(`
      (() => {
        const nameEl = document.querySelector('[data-testid="playlist-page"] h1, [data-testid="entityTitle"] h1, h1');
        const name = nameEl ? nameEl.textContent.trim() : 'Imported Spotify Playlist';
        const imgEl = document.querySelector('[data-testid="playlist-image"] img, [data-testid="cover-art"] img, img[src*="scdn.co"]');
        const thumbnail = imgEl ? imgEl.src : '';
        const trackRows = document.querySelectorAll('[data-testid="track-row"]');
        const tracks = [];
        trackRows.forEach(row => {
          // The track row has: index cell, title+artist cell, album cell, date cell, duration cell
          // Get the track link (has the title)
          const titleEl = row.querySelector('a[data-testid="internal-track-link"], a[href*="/track/"]');
          // Get artist links
          const artistEls = row.querySelectorAll('a[data-testid="internal-artist-link"], a[href*="/artist/"]');
          // Duration is in the last span
          const allSpans = row.querySelectorAll('span');
          let duration = 0;
          // Look for a span that looks like a duration (M:SS or H:MM:SS)
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
            if (title && artist) {
              tracks.push({ title, artist, album: '', duration });
            }
          }
        });
        return { name, thumbnail, tracks };
      })();
    `);

    console.log(`[Spotify] Browser extracted: name="${result.name}", tracks=${result.tracks.length}`);

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

export async function importPlaylist(url: string): Promise<SpotifyPlaylist> {
  const id = extractId(url, 'playlist');
  const embedUrl = `${SPOTIFY_EMBED}/playlist/${id}?utm_source=generator`;

  // Strategy 1: Fast — get first 100 tracks from embed page
  const entity = await fetchEmbedPage(embedUrl);
  const trackList: any[] = Array.isArray(entity.trackList) ? entity.trackList : [];
  const tracks = normalizeTracks(trackList);

  // If we got 100 tracks, the playlist likely has more — try to get all via browser
  if (tracks.length >= 100) {
    try {
      console.log(`[Spotify] Got ${tracks.length} from embed, trying browser for full list...`);
      const browserResult = await fetchAllTracksViaBrowser(id);
      if (browserResult.tracks.length > tracks.length) {
        console.log(`[Spotify] Browser got ${browserResult.tracks.length} tracks (more than embed)`);
        return {
          name: browserResult.name || entity.name || entity.title || 'Imported Spotify Playlist',
          description: entity.description || '',
          thumbnail: browserResult.thumbnail || getCoverUrl(entity),
          tracks: browserResult.tracks,
        };
      }
    } catch (err: any) {
      console.warn(`[Spotify] Browser extraction failed, falling back to embed data:`, err.message);
    }
  }

  return {
    name: entity.name || entity.title || 'Imported Spotify Playlist',
    description: entity.description || '',
    thumbnail: getCoverUrl(entity),
    tracks,
  };
}

export function parseSpotifyUrl(url: string): { type: 'track' | 'playlist' | 'album'; id: string } {
  const patterns: [RegExp, 'track' | 'playlist' | 'album'][] = [
    [/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/, 'track'],
    [/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/, 'playlist'],
    [/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/, 'album'],
  ];
  for (const [re, type] of patterns) {
    const match = url.match(re);
    if (match) return { type, id: match[1] };
  }
  throw new Error('Invalid Spotify URL');
}
