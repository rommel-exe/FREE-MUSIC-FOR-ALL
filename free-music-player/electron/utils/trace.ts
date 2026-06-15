/**
 * Shared trace registry for end-to-end pipeline debugging.
 *
 * Usage:
 *   1. When a track first enters the system, call `registerTrace(title, artist)`
 *      to create and store a traceId.
 *   2. At every pipeline stage, call `emitTrace(title, artist, stage, extra)`
 *      to log the trace event.
 *   3. Only tracks matching the debug filter (title/artist contains "numb")
 *      actually emit logs — other tracks are silently skipped.
 *
 * This makes it easy to follow a single problematic track through the entire
 * pipeline without drowning in logs for every track.
 */

// ── Registry ──────────────────────────────────────────────────────────────

const traceRegistry = new Map<string, string>();

function registryKey(title: string, artist: string): string {
  return `${(title ?? '').toLowerCase().trim()}|${(artist ?? '').toLowerCase().trim()}`;
}

/**
 * Register a track by title+artist and generate a traceId.
 * Returns the traceId (8-char hex prefix of a UUID).
 * Re-registering the same track returns the same traceId.
 */
export function registerTrace(title: string, artist: string): string {
  const key = registryKey(title, artist);
  let traceId = traceRegistry.get(key);
  if (!traceId) {
    traceId = crypto.randomUUID().slice(0, 8);
    traceRegistry.set(key, traceId);
  }
  return traceId;
}

/**
 * Look up an existing traceId for a track.
 */
export function getTrace(title: string, artist: string): string | undefined {
  const key = registryKey(title, artist);
  return traceRegistry.get(key);
}

// ── Debug filter ─────────────────────────────────────────────────────────

/**
 * Only emit trace logs for tracks whose title or artist contains "numb".
 * This keeps the noise down when hunting a specific problem track.
 * Remove or widen this filter when debugging other tracks.
 */
export function isDebugTrack(title?: string, artist?: string): boolean {
  const t = (title ?? '').toLowerCase();
  const a = (artist ?? '').toLowerCase();
  return t.includes('numb') || a.includes('numb');
}

// ── Emit ─────────────────────────────────────────────────────────────────

/**
 * Emit a trace log line for a pipeline stage.
 *
 * Silently skipped unless `isDebugTrack` returns true for the given
 * title/artist. This means only tracks matching the debug filter
 * ("numb") produce output.
 *
 * @param title   - Track title at this stage.
 * @param artist  - Track artist at this stage.
 * @param stage   - Pipeline stage name (e.g. "IMPORT", "DB_INSERT", "IDENTITY_INPUT").
 * @param extra   - Optional extra fields to include in the log output.
 */
export function emitTrace(
  title: string,
  artist: string,
  stage: string,
  extra?: Record<string, unknown>,
): void {
  if (!isDebugTrack(title, artist)) return;

  const traceId = getTrace(title, artist) ?? registerTrace(title, artist);

  console.log('[TRACK_TRACE]', {
    traceId,
    stage,
    title,
    artist: artist ?? '',
    ...extra,
  });
}
