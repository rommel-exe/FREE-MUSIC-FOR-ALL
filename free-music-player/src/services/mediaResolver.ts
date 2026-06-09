import type { MediaSource } from '@/types';

const api = window.electronAPI;

/** Shape returned by `stream.resolve` / `stream.getCached` in the preload. */
interface StreamResolveResult {
  url?: string;
  expiresAt?: number;
  bitrate?: number;
  videoId?: string;
  error?: string;
}

function toMediaSource(videoId: string, result: StreamResolveResult | undefined): MediaSource | null {
  if (!result || result.error || !result.url) return null;
  return {
    audioUrl: result.url,
    expiresAt: result.expiresAt ?? Date.now() + 6 * 60 * 60 * 1000,
    bitrate: result.bitrate ?? 128,
    videoId: result.videoId ?? videoId,
  };
}

export const mediaResolver = {
  /**
   * Resolve a video ID to a playable MediaSource.
   * Optionally pass track metadata so the main process can auto-recover
   * by searching for the official audio if the primary ID fails.
   */
  async resolve(videoId: string, metadata?: { artist: string; title: string; expectedDuration?: number; trackId?: string }): Promise<MediaSource | null> {
    try {
      const result = await api?.stream?.resolve?.(videoId, metadata);
      return toMediaSource(videoId, result);
    } catch {
      return null;
    }
  },

  /** Prefetch a media source in the background (fire-and-forget). */
  prefetch(videoId: string): void {
    api?.stream?.prefetch?.(videoId)?.catch(() => {});
  },

  /** Batch-prefetch multiple videoIds in parallel on the main process. */
  async prefetchBatch(videoIds: string[]): Promise<void> {
    try {
      await api?.stream?.prefetchBatch?.(videoIds);
    } catch {}
  },

  /**
   * Check if we have a non-expired cached source.
   * Returns `false` — callers should rely on `resolve()` (which is
   * already cache-aware on the main process) rather than a separate
   * pre-check, since cache state can change between check and use.
   */
  hasCached(_videoId: string): boolean {
    return false;
  },

  /** Get cached source asynchronously if available. */
  async getCached(videoId: string): Promise<MediaSource | null> {
    try {
      const result = await api?.stream?.getCached?.(videoId);
      return toMediaSource(videoId, result);
    } catch {
      return null;
    }
  },
};
