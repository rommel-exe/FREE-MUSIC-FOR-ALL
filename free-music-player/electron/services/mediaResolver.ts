/**
 * MediaResolver — the ONLY module that touches yt-dlp or child_process.
 *
 * Exposes a local HTTP proxy so the renderer can fetch audio without CORS
 * or CORS-hating CDN restrictions.  The upstream URL is fetched via
 * Node's native http.request (streaming, no buffering).
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import type { MediaSource } from '../utils/types';

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

// ─── MediaResolver class ────────────────────────────────────────────────

class MediaResolver {
  /** videoId → cached resolve result */
  private cache = new Map<string, CacheEntry>();

  /** Local proxy server (created once in start()) */
  private server: http.Server | null = null;

  /** Port assigned to the proxy server after listen() */
  private port = 0;

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Resolve a YouTube video ID to a proxied audio source.
   *
   * Returns a cached entry when still valid.  Otherwise invokes yt-dlp,
   * stores the result and returns a fresh `MediaSource`.
   */
  async resolve(videoId: string): Promise<MediaSource> {
    const cached = this.getCached(videoId);
    if (cached) return cached;

    const streamUrl = await this.fetchUpstreamUrl(videoId);

    const source: MediaSource = {
      audioUrl: this.getProxyUrl(videoId),
      expiresAt: Date.now() + CACHE_TTL_MS,
      bitrate: 0, // yt-dlp --get-url doesn't report bitrate
      videoId,
    };

    this.cache.set(videoId, { source, streamUrl });

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
   * Return the cached `MediaSource` for `videoId`, or `null` if missing /
   * expired.
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

  /**
   * Start the local HTTP proxy server on a random available port.
   *
   * @returns The port the server is listening on.
   */
  start(): Promise<number> {
    if (this.server) return Promise.resolve(this.port);

    return new Promise<number>((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleProxyRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server?.address() ?? null;
        this.port = typeof addr === 'object' && addr ? addr.port : 0;
        console.log(`[MediaResolver] Proxy listening on port ${this.port}`);
        resolve(this.port);
      });
    });
  }

  /**
   * Stop the proxy server and clear all cached sources.
   */
  stop(): void {
    this.cache.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.port = 0;
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /**
   * Build the local proxy URL for a given video ID.
   */
  private getProxyUrl(videoId: string): string {
    return `http://127.0.0.1:${this.port}/stream?v=${videoId}`;
  }

  /**
   * Run yt-dlp to obtain the raw streaming URL for `videoId`.
   */
  private async fetchUpstreamUrl(videoId: string): Promise<string> {
    const { stdout } = await execFileAsync(
      YTDLP_PATH,
      [
        '-f',
        'bestaudio[ext=m4a]/bestaudio',
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
   * Handle an incoming request to the local proxy.
   *
   * The proxy looks up the cached upstream URL for the requested video ID
   * and pipes the response back to the client, supporting HTTP Range
   * requests for seeking.
   */
  private handleProxyRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    const videoId = reqUrl.searchParams.get('v');

    if (!videoId) {
      res.writeHead(400);
      res.end('Missing video ID');
      return;
    }

    this.proxyAudio(videoId, req, res).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end(`Proxy error: ${(err as Error).message ?? 'unknown'}`);
    });
  }

  /**
   * Pipe audio from the upstream URL to the local client.
   *
   * Uses Node's native `http.request` (streaming) — NOT `fetch`, which
   * would buffer the entire response into memory.
   */
  private proxyAudio(
    videoId: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const entry = this.cache.get(videoId);
    if (!entry) {
      return Promise.reject(new Error('Not cached — call resolve() first'));
    }

    const parsedUrl = new URL(entry.streamUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method || 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
    };

    return new Promise<void>((resolve, reject) => {
      const proxyReq = httpModule.request(options, (proxyRes) => {
        const headers: http.OutgoingHttpHeaders = {
          'Content-Type': (proxyRes.headers['content-type'] as string) || 'audio/mp4',
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        };
        if (proxyRes.headers['content-length']) {
          headers['Content-Length'] = proxyRes.headers['content-length'];
        }
        if (proxyRes.headers['content-range']) {
          headers['Content-Range'] = proxyRes.headers['content-range'];
        }

        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);

        proxyRes.on('end', resolve);
        proxyRes.on('error', reject);
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502);
        }
        res.end(`Upstream error: ${err.message}`);
        reject(err);
      });

      req.pipe(proxyReq);
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

/** The single MediaResolver instance shared across the app. */
export const mediaResolver = new MediaResolver();
