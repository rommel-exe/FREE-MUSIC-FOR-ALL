import type { MediaSource } from '@/types';

const api = window.electronAPI;

/** Shape returned by `stream.resolve` / `stream.getCached` in the preload. */
interface StreamResolveResult {
  url?: string;
  expiresAt?: number;
  bitrate?: number;
  error?: string;
}

function toMediaSource(videoId: string, result: StreamResolveResult | undefined): MediaSource | null {
  if (!result || result.error || !result.url) return null;
  return {
    audioUrl: result.url,
    expiresAt: result.expiresAt ?? Date.now() + 6 * 60 * 60 * 1000,
    bitrate: result.bitrate ?? 128,
    videoId,
  };
}

export const mediaResolver = {
  /** Resolve a video ID to a playable MediaSource. */
  async resolve(videoId: string): Promise<MediaSource | null> {
    try {
      const result = await api?.stream?.resolve?.(videoId);
      return toMediaSource(videoId, result);
    } catch {
      return null;
    }
  },

  /** Prefetch a media source in the background (fire-and-forget). */
  prefetch(videoId: string): void {
    api?.stream?.prefetch?.(videoId)?.catch(() => {});
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
