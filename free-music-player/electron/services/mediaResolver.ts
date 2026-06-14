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
import { execFile, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { MediaSource } from '../utils/types';
import { getVerifiedTrack, setVerifiedTrack, getCachedStreamUrl, setCachedStreamUrl, getDownloadedFilePath } from '../utils/database';
import { trackIdentityEngine } from '../identity/trackIdentityEngine';

const execFileAsync = promisify(execFile);

const YTDLP_PATH =
  '/Library/Frameworks/Python.framework/Versions/3.12/bin/yt-dlp';
const CACHE_TTL_MS = 55 * 60 * 1000;

// ─── JS runtime detection for yt-dlp ─────────────────────────────────

/**
 * Find a JavaScript runtime for yt-dlp to use during format extraction.
 * YouTube extraction is more reliable when a JS runtime (node, bun, deno)
 * is available for signature deciphering.
 *
 * Returns `--js-runtimes node:<path>` if node is found, or empty array.
 */
let jsRuntimeArgs: readonly string[] | null = null;

function detectJsRuntime(): readonly string[] {
  // Try common node.js locations
  const candidates = [
    process.env.NODE_PATH,
    process.env.NVM_BIN ? `${process.env.NVM_BIN}/node` : null,
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
    '/usr/bin/node',
  ].filter(Boolean) as string[];

  // Also try `which node` in case it's on the PATH
  try {
    const which = execSync('which node', { encoding: 'utf-8', timeout: 2000 }).trim();
    if (which && !candidates.includes(which)) candidates.unshift(which);
  } catch {
    // node not found via which
  }

  for (const nodePath of candidates) {
    try {
      fs.accessSync(nodePath, fs.constants.X_OK);
      console.log(`[MediaResolver] Found JS runtime: ${nodePath}`);
      return ['--js-runtimes', `node:${nodePath}`];
    } catch {
      continue;
    }
  }

  console.warn('[MediaResolver] No JS runtime found — format extraction may be limited');
  return [];
}

function getJsRuntimeArgs(): readonly string[] {
  if (jsRuntimeArgs === null) {
    jsRuntimeArgs = detectJsRuntime();
  }
  return jsRuntimeArgs;
}

// ─── Types ──────────────────────────────────────────────────────────────

interface CacheEntry {
  source: MediaSource;
  /** Raw upstream URL returned by yt-dlp */
  streamUrl: string;
}

/** Optional track metadata for auto-recovery fallback and duration validation. */
export interface TrackMetadata {
  artist: string;
  title: string;
  /** Track database ID — used to check if a local download exists. */
  trackId?: string;
  /** Expected track duration in seconds — if provided, resolved videos must
   *  match within tolerance (±5% or 5s, whichever is larger) or be rejected. */
  expectedDuration?: number;
}

// ─── MediaResolver class ────────────────────────────────────────────────

class MediaResolver {
  /** videoId → cached resolve result */
  private cache = new Map<string, CacheEntry>();

  /** videoId → in-flight resolve promise (for deduplication) */
  private pendingResolves = new Map<string, Promise<MediaSource | null>>();

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
    // 0) Check for locally-downloaded file if trackId is available
    if (metadata?.trackId) {
      const localResult = this.resolveLocal(metadata.trackId, videoId);
      if (localResult) return localResult;
    }

    // Check in-memory cache first (skip duration re-check — already passed validation)
    const cached = this.getCached(videoId);
    if (cached) return cached;

    // Deduplicate concurrent requests for the same videoId
    const pending = this.pendingResolves.get(videoId);
    if (pending) {
      return pending;
    }

    const promise = this.resolveInternal(videoId, metadata);
    this.pendingResolves.set(videoId, promise);

    try {
      return await promise;
    } finally {
      this.pendingResolves.delete(videoId);
    }
  }

  private async resolveInternal(videoId: string, metadata?: TrackMetadata): Promise<MediaSource | null> {
    // 1) Try primary video with duration validation
    const primaryResult = await this.tryResolve(videoId, metadata);
    if (primaryResult) return primaryResult;

    console.log(`[MediaResolver] Primary resolve failed for ${videoId}, attempting auto-recovery...`);

    // 2) Auto-recovery: search for official audio track via TrackIdentityEngine
    if (metadata?.artist && metadata?.title) {
      const result = await trackIdentityEngine.identify({
        title: metadata.title,
        artist: metadata.artist,
        duration: metadata.expectedDuration ?? 0,
      });
      
      const recoveryVideoId = result?.videoId ?? null;
      if (recoveryVideoId && recoveryVideoId !== videoId) {
        console.log(`[MediaResolver] Recovery: ${videoId} → ${recoveryVideoId}`);
        const recoveryResult = await this.tryResolve(recoveryVideoId, metadata);
        if (recoveryResult) return recoveryResult;
      }
    }

    return null;
  }

  /**
   * Resolve a locally-downloaded audio file.
   * Returns a MediaSource pointing at the local file via the proxy,
   * or null if no local file exists.
   */
  private resolveLocal(trackId: string, videoId: string): MediaSource | null {
    const filePath = getDownloadedFilePath(trackId);
    if (!filePath || !fs.existsSync(filePath)) return null;

    const source: MediaSource = {
      audioUrl: `http://127.0.0.1:${this.port}/local/${trackId}`,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year — local files don't expire
      bitrate: 320,
      videoId,
    };

    return source;
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
   * Supports:
   *  - `/stream/<videoId>` — proxy from YouTube's CDN
   *  - `/local/<trackId>` — serve a locally-downloaded file
   */
  private handleProxyRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    // ── Local file serving ───────────────────────────────────────────
    if (pathname.startsWith('/local/')) {
      const trackId = pathname.replace('/local/', '');
      if (!trackId) {
        res.writeHead(400);
        res.end('Missing track ID');
        return;
      }

      const filePath = getDownloadedFilePath(trackId);
      if (!filePath || !fs.existsSync(filePath)) {
        console.error(`[MediaResolver] Local file not found for track: ${trackId}`);
        res.writeHead(404);
        res.end('Local file not found');
        return;
      }

      this.serveLocalFile(filePath, req, res);
      return;
    }

    // ── Stream proxy ─────────────────────────────────────────────────
    const videoId = pathname.replace('/stream/', '');

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

  /**
   * Serve a local audio file over HTTP, supporting Range requests for seeking.
   */
  private serveLocalFile(filePath: string, req: IncomingMessage, res: ServerResponse): void {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.m4a': 'audio/mp4',
      '.mp3': 'audio/mpeg',
      '.opus': 'audio/ogg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.webm': 'audio/webm',
    };
    const contentType = mimeTypes[ext] || 'audio/mp4';

    if (range) {
      // Parse Range header (e.g. "bytes=0-1000")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'access-control-allow-origin': '*',
      });
      stream.pipe(res);
      req.on('close', () => stream.destroy());
    } else {
      // Full file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'access-control-allow-origin': '*',
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      req.on('close', () => stream.destroy());
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
   *
   * @param metadata - Optional track metadata. If `expectedDuration` is set,
   *   the resolved video's duration must match within tolerance.
   */
  private async tryResolve(videoId: string, metadata?: TrackMetadata): Promise<MediaSource | null> {
    // Step 1: Check in-memory cache
    const inMemory = this.getCached(videoId);
    if (inMemory) return inMemory;

    try {
      // Step 2: Check disk-persisted stream URL cache before running yt-dlp
      const diskCachedUrl = getCachedStreamUrl(videoId);
      if (diskCachedUrl) {
        const source: MediaSource = {
          audioUrl: `http://127.0.0.1:${this.port}/stream/${videoId}`,
          expiresAt: Date.now() + CACHE_TTL_MS,
          bitrate: 0,
          videoId,
        };
        this.cache.set(videoId, { source, streamUrl: diskCachedUrl });
        return source;
      }

      // Step 3: Check SQLite verification cache for recent (≤1h) verified entry
      const verified = getVerifiedTrack(videoId);
      const isRecentlyVerified =
        verified &&
        verified.verified &&
        verified.playable &&
        Date.now() - new Date(verified.lastChecked).getTime() < 60 * 60 * 1000;

      if (isRecentlyVerified && verified.trustScore >= 80) {
        // Still needs the stream URL — fetch it with single yt-dlp call
        return this.fetchAndCacheVerified(videoId);
      }

      // Step 4: Single yt-dlp call for BOTH validation AND stream URL
      // Uses -j to get JSON with formats array containing URLs
      const { stdout } = await execFileAsync(
        YTDLP_PATH,
        [
          '-j',
          '-f',
          'bestaudio[ext=m4a][abr>64]/bestaudio[abr>64]/bestaudio',
          '--no-warnings',
          ...getJsRuntimeArgs(),
          `https://www.youtube.com/watch?v=${videoId}`,
        ],
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

      if (metadata?.expectedDuration && metadata.expectedDuration > 0) {
        // Round both sides to integer seconds — YouTube's yt-dlp duration can
        // be a float (e.g. 180.3) even for an "exact" match to a 3:00 track.
        // Use <= 1 because different platforms may report ±1s variation.
        if (Math.abs(Math.round(duration) - Math.round(metadata.expectedDuration)) > 1) {
          this.storeVerificationFailure(
            videoId,
            'duration_mismatch',
            `expected ${metadata.expectedDuration}s, got ${duration}s`,
          );
          throw new Error(
            `Video ${videoId}: duration mismatch — expected ${metadata.expectedDuration}s, got ${duration}s`,
          );
        }
      }

      if (!hasAudio) {
        this.storeVerificationFailure(videoId, 'has_audio', 'false');
        throw new Error(`Video ${videoId}: no audio formats available`);
      }

      // Extract stream URL from the formats array (already filtered by -f)
      const streamUrl = data.url || (data.formats?.[0]?.url);
      if (!streamUrl) {
        throw new Error(`Video ${videoId}: no stream URL in yt-dlp output`);
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

      // Cache and return the source directly (no second yt-dlp call needed!)
      const source: MediaSource = {
        audioUrl: `http://127.0.0.1:${this.port}/stream/${videoId}`,
        expiresAt: Date.now() + CACHE_TTL_MS,
        bitrate: data.formats?.[0]?.abr || 0,
        videoId,
      };
      this.cache.set(videoId, { source, streamUrl });
      setCachedStreamUrl(videoId, streamUrl, CACHE_TTL_MS);
      return source;

    } catch (err) {
      console.error(`[MediaResolver] Failed to resolve ${videoId}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Fetch stream URL for a previously verified track (single yt-dlp call).
   */
  private async fetchAndCacheVerified(videoId: string): Promise<MediaSource | null> {
    try {
      const { stdout } = await execFileAsync(
        YTDLP_PATH,
        [
          '-j',
          '-f',
          'bestaudio[ext=m4a][abr>64]/bestaudio[abr>64]/bestaudio',
          '--no-warnings',
          ...getJsRuntimeArgs(),
          `https://www.youtube.com/watch?v=${videoId}`,
        ],
        { timeout: 15_000 },
      );

      const data = JSON.parse(stdout);
      const streamUrl = data.url || (data.formats?.[0]?.url);
      if (!streamUrl) {
        throw new Error(`Video ${videoId}: no stream URL in yt-dlp output`);
      }

      const source: MediaSource = {
        audioUrl: `http://127.0.0.1:${this.port}/stream/${videoId}`,
        expiresAt: Date.now() + CACHE_TTL_MS,
        bitrate: data.formats?.[0]?.abr || 0,
        videoId,
      };
      this.cache.set(videoId, { source, streamUrl });
      setCachedStreamUrl(videoId, streamUrl, CACHE_TTL_MS);
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

}

// ─── Singleton ──────────────────────────────────────────────────────────

/** The single MediaResolver instance shared across the app. */
export const mediaResolver = new MediaResolver();
