import youtubedl from 'youtube-dl-exec';
import type { SearchResult, PlaylistTrackResult } from '../utils/types';

// Use custom yt-dlp binary path if default isn't in PATH
const YT_DLP_PATH = '/Users/jackfu/Library/Python/3.9/bin/yt-dlp';
let ytExec: any;
try {
  const mod = youtubedl as any;
  const createFn = mod.create || mod.default?.create;
  ytExec = createFn ? createFn(YT_DLP_PATH) : (mod.default || mod);
} catch {
  ytExec = youtubedl;
}

// ─── getStreamUrl ───────────────────────────────────────────────────────

export async function getStreamUrl(videoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await ytExec(url, {
    format: '18/bestaudio[ext=m4a]/bestaudio/best',
    getUrl: true as any,
    noWarnings: true,
    quiet: true,
    noCheckCertificates: true,
    extractorArgs: 'youtube:player_client=android',
  });
  const streamUrl = typeof info === 'string' ? info.trim() : String(info).trim();
  if (!streamUrl) throw new Error('No stream URL returned');
  return streamUrl;
}

/**
 * Download YouTube audio to a local temp file and return the path.
 * The renderer plays it via the `stream://` custom protocol.
 * Returns immediately if the file is already cached.
 */
export async function getLocalStreamPath(videoId: string): Promise<string> {
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs');
  const { spawn } = await import('child_process');

  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `freemusic-${videoId}.m4a`);

  // If already cached, return immediately
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
    return outputPath;
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const proc = spawn(YT_DLP_PATH, [
    url,
    '-f', '18/bestaudio[ext=m4a]/bestaudio/best',
    '-o', outputPath,
    '--no-warnings',
    '--no-check-certificates',
    '--no-playlist',
    '--extractor-args', 'youtube:player_client=android',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });
    proc.on('error', (err) => reject(new Error(`yt-dlp spawn failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
  });
}

// ─── downloadTrack ──────────────────────────────────────────────────────

export async function downloadTrack(
  videoId: string,
  outputPath: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const proc = (ytExec as any).exec(url, {
    format: 'bestaudio/best',
    output: outputPath,
    // CRITICAL: extractAudio: true is required to trigger ffmpeg postprocessor.
    // Without it, yt-dlp just downloads the source format (mp4/webm) and renames
    // it to .mp3, resulting in a file that won't play in MP3 players.
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: '0',
    noWarnings: true,
    quiet: true,
    newline: true,
    extractorArgs: 'youtube:player_client=android',
  });

  if (onProgress && proc.stdout) {
    proc.stdout.on('data', (data: Buffer) => {
      const line = data.toString();
      const match = line.match(/(\d+\.?\d*)%/);
      if (match) onProgress(parseFloat(match[1]));
    });
  }

  await proc;
  onProgress?.(100);
  return outputPath;
}

// ─── getVideoInfo ───────────────────────────────────────────────────────

export async function getVideoInfo(
  videoId: string,
): Promise<{ title: string; artist: string; duration: number; thumbnail: string }> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await ytExec(url, {
    dumpSingleJson: true as any,
    noWarnings: true,
    quiet: true,
    noCheckCertificates: true,
  });

  const data = typeof info === 'string' ? JSON.parse(info) : info;
  let artist = data.uploader || data.channel || '';
  let title = data.title || '';

  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    artist = artist || parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  return {
    title,
    artist,
    duration: data.duration || 0,
    thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || '',
  };
}

// ─── searchYouTube ──────────────────────────────────────────────────────

export async function searchYouTube(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  const result = await ytExec(`ytsearch${limit}:${query}`, {
    dumpSingleJson: true as any,
    noWarnings: true,
    quiet: true,
    noCheckCertificates: true,
    flatPlaylist: true as any,
  });

  const data = typeof result === 'string' ? JSON.parse(result) : result;
  const entries: SearchResult[] = [];

  if (data._type === 'playlist' && data.entries) {
    for (const entry of data.entries) {
      if (!entry.id) continue;
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
    }
  } else if (data.id) {
    let artist = data.uploader || data.channel || '';
    let title = data.title || '';
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = artist || parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
    entries.push({
      id: data.id,
      title,
      artist,
      duration: data.duration || 0,
      thumbnail: data.thumbnail || '',
      url: `https://www.youtube.com/watch?v=${data.id}`,
    });
  }

  return entries;
}

// ─── getPlaylistTracks ──────────────────────────────────────────────────

export async function getPlaylistTracks(
  playlistId: string,
): Promise<PlaylistTrackResult[]> {
  const result = await ytExec(`https://www.youtube.com/playlist?list=${playlistId}`, {
    dumpSingleJson: true as any,
    noWarnings: true,
    quiet: true,
    noCheckCertificates: true,
    flatPlaylist: true as any,
  });

  const data = typeof result === 'string' ? JSON.parse(result) : result;
  const entries: PlaylistTrackResult[] = [];

  if (data.entries) {
    data.entries.forEach((entry: any, index: number) => {
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
        thumbnail: entry.thumbnail || '',
        url: `https://www.youtube.com/watch?v=${entry.id}`,
        position: index,
      });
    });
  }

  return entries;
}
