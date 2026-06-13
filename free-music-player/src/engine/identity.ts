/**
 * TrackIdentityEngine renderer bridge.
 *
 * All identity operations run in the Electron main process via IPC.
 * This module provides a type-safe bridge that the UI and store layers
 * can import directly.
 *
 * @module engine/identity
 */

import { ipc } from '@/utils/ipc';

/**
 * Identify a single track — returns a MatchResult with videoId, confidence, etc.
 * 
 * @param track - Track metadata (title, artist, duration required)
 */
function identify(track: {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  source?: string;
  youtubeId?: string;
  spotifyId?: string;
}): ReturnType<typeof ipc.identity.identify> {
  return ipc.identity.identify(track);
}

/**
 * Batch identify multiple tracks with progress callback.
 * 
 * @param tracks - Array of track metadata
 * @param onProgress - Optional progress callback
 */
function batchIdentify(
  tracks: Array<{ title: string; artist: string; duration: number; album?: string }>,
  onProgress?: (data: { completed: number; total: number }) => void,
): ReturnType<typeof ipc.identity.batchIdentify> {
  if (onProgress) {
    ipc.identity.onBatchProgress(onProgress);
  }
  return ipc.identity.batchIdentify(tracks);
}

/**
 * Force re-match a track (bypass all caches).
 */
function rematch(track: { title: string; artist: string; duration?: number }): ReturnType<typeof ipc.identity.rematch> {
  return ipc.identity.rematch(track);
}

/**
 * Invalidate a cached fingerprint.
 */
function invalidate(fingerprint: string): ReturnType<typeof ipc.identity.invalidate> {
  return ipc.identity.invalidate(fingerprint);
}

/**
 * Get TrackIdentityEngine stats.
 */
function getStats(): ReturnType<typeof ipc.identity.getStats> {
  return ipc.identity.getStats();
}

/**
 * Verify a specific candidate against a track.
 */
function verify(track: any, candidate: any): ReturnType<typeof ipc.identity.verify> {
  return ipc.identity.verify(track, candidate);
}

export const identityEngine = {
  identify,
  batchIdentify,
  rematch,
  invalidate,
  getStats,
  verify,
};

export type IdentityBridge = typeof identityEngine;

export default identityEngine;
