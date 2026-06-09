/**
 * Engine module exports.
 *
 * MediaEngine is the single source of truth for all playback decisions.
 * Other modules are utilities consumed by MediaEngine.
 *
 * @module engine
 */

export { mediaEngine, MediaEngine } from './mediaEngine';
export type { EngineState } from './mediaEngine';

export { queueEngine, QueueEngine } from './queueEngine';
export type { RepeatMode, QueueState } from './queueEngine';

export { AudioService } from './audioService';

export { cacheEngine, LRUCache } from './cacheEngine';
export { queryEngine, QueryEngine } from './queryEngine';
export { prefetchEngine, PrefetchEngine } from './prefetchEngine';
export { recommendationEngine, RecommendationEngine } from './recommendationEngine';

// ── Alignment engine (IPC bridge to Electron main process) ──────
import { ipc } from '@/utils/ipc';

export const alignmentEngine = {
  align: ipc.alignment.align,
  getCached: ipc.alignment.getCached,
  getStatus: ipc.alignment.getStatus,
  removeCached: ipc.alignment.removeCached,
  downloadModel: ipc.alignment.downloadModel,
  onDownloadProgress: ipc.alignment.onDownloadProgress,
};
