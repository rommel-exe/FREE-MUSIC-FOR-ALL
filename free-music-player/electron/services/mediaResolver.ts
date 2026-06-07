/**
 * MediaResolver — audio stream resolver using an HTTP proxy.
 *
 * Spawns a lightweight Node.js HTTP server on a random available port
 * to proxy audio streams from YouTube. The renderer plays audio via
 * `http://127.0.0.1:<port>/stream/<videoId>`.
 *
 * This approach is more reliable than Electron's `protocol.handle`
 * for audio streaming because Node.js `http` module handles streaming
 * responses natively, without the serialization issues that occur when
 * passing `ReadableStream` objects through Electron's protocol layer.
 *
 * Features:
 *  - Resolve-time validation: checks availability, live_status, duration
 *  - Auto-recovery: when resolve fails, searches YouTube Music for the
 *    official audio track and plays that instead
 *  - Verification cache: stores resolved state so repeat plays are instant
 *  - Strict audio-only format selection with bitrate floor
 */

import { createServer } from 'node:http';
import { net } from 'electron';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AddressInfo } from 'node:net';
import type { MediaSource } from '../utils/types';
import { getVerifiedTrack, setVerifiedTrack } from '../utils/database';

const execFileAsync = promisify(execFile);

const YTDLP_PATH =
  '/Library/Frameworks/Python.framework/Versions/3.12/bin/yt-dlp';
const CACHE_TTL_MS = 55 * 60 * 1000;

// ─── Types ──────────────────────────────────────────────────────────────

interface CacheEntry {
  source: MediaSource;
  /** Raw upstream URL returned by yt-dlp */
  streamUrl: string;
}

/** Optional track metadata for auto-recovery fallback. */
export interface TrackMetadata {
  artist: string;
  title: string;
}

// ─── MediaResolver class ────────────────────────────────────────────────

class MediaResolver {
  /** videoId → cached resolve result */
  private cache = new Map<string, CacheEntry>();

  /** The Node.js HTTP server instance (started via `start()`). */
  private server: ReturnType<typeof createServer> | null = null;

  /** The port the server is listening on (0 until started). */
  private port = 0;

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Start the HTTP proxy server on a random available port.
   * Idempotent — safe to call multiple times.
   */
  start(): Promise<void> {
    if (this.server) return Promise.resolve();

    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        this.handleProxyRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        this.port = (this.server!.address() as AddressInfo).port;
        console.log(`[MediaResolver] HTTP proxy started on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP proxy server. Safe to call even if not started.
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.port = 0;
      console.log('[MediaResolver] HTTP proxy stopped');
    }
  }

  /**
   * Get the port the proxy server is listening on.
   * Returns 0 if the server hasn't been started.
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Resolve a YouTube video ID to a proxied audio source.
   *
   * Uses a two-pass approach:
   *  1. yt-dlp -j → validate playability (public, not live, 30-900s, has audio)
   *  2. yt-dlp --get-url → get the actual stream URL
   *
   * If the primary video fails resolve and track metadata is available,
   * automatically searches YouTube Music for the official audio track
   * and returns that instead (the user never knows).
   *
   * @param videoId  - The YouTube video ID to resolve.
   * @param metadata - Optional track metadata for auto-recovery fallback.
   * @returns        - A MediaSource or null if all attempts failed.
   */
  async resolve(videoId: string, metadata?: TrackMetadata): Promise<MediaSource | null> {
    // Check in-memory cache first
    const cached = this.getCached(videoId);
    if (cached) return cached;

    // 1) Try primary video
    const primaryResult = await this.tryResolve(videoId);
    if (primaryResult) return primaryResult;

    console.log(`[MediaResolver] Primary resolve failed for ${videoId}, attempting auto-recovery...`);

    // 2) Auto-recovery: search for official audio track
    if (metadata?.artist && metadata?.title) {
      const recoveryVideoId = await this.searchOfficialSong(metadata.artist, metadata.title);
      if (recoveryVideoId && recoveryVideoId !== videoId) {
        console.log(`[MediaResolver] Recovery: ${videoId} → ${recoveryVideoId}`);
        const recoveryResult = await this.tryResolve(recoveryVideoId);
        if (recoveryResult) return recoveryResult;
      }
    }

    return null;
  }

  /**
   * Fire-and-forget: resolve a video in the background so the URL is
   * ready when the user actually plays it.
   */
  prefetch(videoId: string): void {
    if (this.hasCached(videoId)) return;
    this.resolve(videoId).catch(() => {
      /* swallow — prefetch is best-effort */
    });
  }

  /**
   * Check whether we have a non-expired cached source for `videoId`.
   */
  hasCached(videoId: string): boolean {
    const entry = this.cache.get(videoId);
    if (!entry) return false;
    if (entry.source.expiresAt < Date.now()) {
      this.cache.delete(videoId);
      return false;
    }
    return true;
  }

  /**
   * Return the cached `MediaSource` for `videoId`, or `null` if missing / expired.
   */
  getCached(videoId: string): MediaSource | null {
    const entry = this.cache.get(videoId);
    if (!entry) return null;
    if (entry.source.expiresAt < Date.now()) {
      this.cache.delete(videoId);
      return null;
    }
    return entry.source;
  }

  /**
   * Clear every cached source.
   */
  clear(): void {
    this.cache.clear();
  }

  // ── Proxy request handler ───────────────────────────────────────────

  /**
   * Handle an incoming HTTP request to the proxy server.
   * Expects URLs of the form `/stream/<videoId>`.
   */
  private handleProxyRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const videoId = url.pathname.replace('/stream/', '');

    if (!videoId) {
      res.writeHead(400);
      res.end('Missing video ID');
      return;
    }

    const entry = this.cache.get(videoId);
    if (!entry) {
      console.error(`[MediaResolver] Proxy request for uncached video: ${videoId}`);
      res.writeHead(404);
      res.end('Not cached — call resolve() first');
      return;
    }

    this.proxyAudio(entry.streamUrl, req, res);
  }

  /**
   * Proxy audio from the upstream URL to the renderer's response,
   * supporting Range requests for seeking.
   *
   * Uses Electron's `net.request` (Chromium network stack) for the upstream
   * request because YouTube's CDN (googlevideo.com) often requires specific
   * headers and TLS handling that Node's built-in `https` module doesn't
   * provide correctly. `net.request` reuses Chrome's networking stack which
   * already has the right certificates, ciphers, and YouTube-specific handling.
   */
  private proxyAudio(upstreamUrl: string, req: IncomingMessage, res: ServerResponse): void {
    // Build headers for the upstream request
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    };

    // Forward Range header from the audio element for seeking support
    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    try {
      const clientRequest = net.request({
        method: 'GET',
        url: upstreamUrl,
        headers,
      });

      clientRequest.on('response', (proxyRes) => {
        const statusCode = proxyRes.statusCode || 200;

        const responseHeaders: Record<string, string | number | string[]> = {
          'access-control-allow-origin': '*',
          'accept-ranges': 'bytes',
        };

        const forwardedKeys = [
          'content-type',
          'content-length',
          'content-range',
          'accept-ranges',
        ];
        for (const key of forwardedKeys) {
          const val = proxyRes.headers[key];
          if (val !== undefined) {
            responseHeaders[key] = val;
          }
        }

        if (!responseHeaders['content-type']) {
          responseHeaders['content-type'] = 'audio/mp4';
        }

        res.writeHead(statusCode, responseHeaders);
        proxyRes.on('data', (chunk: Buffer) => {
          res.write(chunk);
        });
        proxyRes.on('end', () => {
          res.end();
        });
      });

      clientRequest.on('error', (err) => {
        console.error('[MediaResolver] Upstream request failed:', err.message);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Upstream request failed');
        }
      });

      clientRequest.on('abort', () => {
        if (!res.headersSent) {
          res.writeHead(502);
          res.end('Upstream request aborted');
        }
      });

      req.on('close', () => {
        clientRequest.abort();
      });

      clientRequest.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MediaResolver] Failed to create upstream request:', msg);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Upstream request failed');
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /**
   * Attempt to resolve a single videoId with validation.
   *
   * 1. Checks the SQLite verification cache first (instant).
   * 2. If not cached or expired, runs a fresh yt-dlp validation + URL fetch.
   * 3. Validates: availability == public, !live, 30-900s duration, has audio formats.
   * 4. On success, caches in both in-memory (for fast proxy) and SQLite (for repeat).
   * 5. On failure, stores the failure in SQLite so we don't retry.
   */
  private async tryResolve(videoId: string): Promise<MediaSource | null> {
    // Step 1: Check in-memory cache
    const inMemory = this.getCached(videoId);
    if (inMemory) return inMemory;

    try {
      // Step 2: Check SQLite verification cache for recent (≤1h) verified entry
      const verified = getVerifiedTrack(videoId);
      const isRecentlyVerified =
        verified &&
        verified.verified &&
        verified.playable &&
        Date.now() - new Date(verified.lastChecked).getTime() < 60 * 60 * 1000;

      if (isRecentlyVerified && verified.trustScore >= 80) {
        // Still needs the stream URL — fetch it
        return this.fetchAndCache(videoId);
      }

      // Step 3: Full verification run — yt-dlp -j + validation
      const { stdout } = await execFileAsync(
        YTDLP_PATH,
        ['-j', '--no-warnings', `https://www.youtube.com/watch?v=${videoId}`],
        { timeout: 15_000 },
      );

      const data = JSON.parse(stdout);

      // ── Validation ──────────────────────────────────────────────────
      const availability = data.availability || 'public';
      const liveStatus = data.live_status || 'not_live';
      const duration = data.duration || 0;
      const hasAudio = (data.formats || []).some(
        (f: any) => f.audio_ext && f.audio_ext !== 'none' && f.audio_ext !== '',
      );

      if (availability !== 'public') {
        // Store the failure in SQLite cache so we don't retry
        this.storeVerificationFailure(videoId, 'availability', availability);
        throw new Error(`Video ${videoId}: ${availability}`);
      }

      if (liveStatus !== 'not_live') {
        this.storeVerificationFailure(videoId, 'live_status', liveStatus);
        throw new Error(`Video ${videoId}: is ${liveStatus}`);
      }

      if (duration < 30 || duration > 900) {
        this.storeVerificationFailure(videoId, 'duration', String(duration));
        throw new Error(`Video ${videoId}: duration ${duration}s out of range`);
      }

      if (!hasAudio) {
        this.storeVerificationFailure(videoId, 'has_audio', 'false');
        throw new Error(`Video ${videoId}: no audio formats available`);
      }

      // Store successful verification
      setVerifiedTrack({
        videoId,
        verified: true,
        playable: true,
        trustScore: 100,
        channel: data.channel || data.uploader || '',
        availability,
        liveStatus,
        duration,
        hasAudio,
        lastChecked: new Date().toISOString(),
      });

      // Step 4: Fetch the actual stream URL with audio-only format selection
      return this.fetchAndCache(videoId);

    } catch (err) {
      console.error(`[MediaResolver] Failed to resolve ${videoId}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Fetch the stream URL with strict audio-only format selection and cache it.
   */
  private async fetchAndCache(videoId: string): Promise<MediaSource | null> {
    try {
      const streamUrl = await this.fetchUpstreamUrl(videoId);

      const source: MediaSource = {
        audioUrl: `http://127.0.0.1:${this.port}/stream/${videoId}`,
        expiresAt: Date.now() + CACHE_TTL_MS,
        bitrate: 0,
        videoId,
      };

      this.cache.set(videoId, { source, streamUrl });
      return source;
    } catch (err) {
      console.error(`[MediaResolver] Failed to fetch stream URL for ${videoId}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Store a failed verification in the SQLite cache so we don't retry.
   */
  private storeVerificationFailure(videoId: string, reason: string, detail: string): void {
    try {
      setVerifiedTrack({
        videoId,
        verified: true,
        playable: false,
        trustScore: 0,
        channel: '',
        availability: reason === 'availability' ? detail : 'unknown',
        liveStatus: reason === 'live_status' ? detail : 'unknown',
        duration: 0,
        hasAudio: false,
        lastChecked: new Date().toISOString(),
      });
    } catch {
      // Swallow — SQLite errors shouldn't break the resolve flow
    }
  }

  /**
   * Run yt-dlp --get-url to obtain the raw streaming URL for `videoId`.
   * Uses strict audio-only format selection with bitrate floor.
   */
  private async fetchUpstreamUrl(videoId: string): Promise<string> {
    const { stdout } = await execFileAsync(
      YTDLP_PATH,
      [
        '-f',
        'bestaudio[ext=m4a][abr>64]/bestaudio[abr>64]/bestaudio',
        '--get-url',
        '--no-warnings',
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { timeout: 15_000 },
    );

    const url = stdout.trim().split('\n')[0];
    if (!url) throw new Error('No URL returned by yt-dlp');
    return url;
  }

  /**
   * Auto-recovery: search YouTube Music for the official audio track.
   *
   * Uses ytmusic-api (not yt-dlp) because it's much better at finding
   * the canonical song entry. Searches for "Artist Title" and returns
   * the first Topic channel result, or failing that, the first song result.
   *
   * @param artist - Artist name from the track metadata.
   * @param title  - Song title from the track metadata.
   * @returns      - A YouTube video ID, or null if no result found.
   */
  private async searchOfficialSong(artist: string, title: string): Promise<string | null> {
    try {
      const mod = await import('ytmusic-api');
      const YTMusic = mod.default;
      const yt = new YTMusic();
      await yt.initialize();

      const query = `${artist} ${title}`.trim();
      const results = await yt.searchSongs(query);

      if (!results || results.length === 0) return null;

      // Prefer Topic channel results
      for (const r of results) {
        const channelName = r.artist?.name || '';
        if (channelName.toLowerCase().includes(' - topic')) {
          return r.videoId;
        }
      }

      // Fallback: return first result
      return results[0].videoId || null;
    } catch (err) {
      console.error('[MediaResolver] Recovery search failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

/** The single MediaResolver instance shared across the app. */
export const mediaResolver = new MediaResolver();
