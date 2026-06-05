/**
 * High-performance LRU cache with TTL support.
 *
 * Uses a Map internally to preserve insertion order, enabling O(1) access
 * and O(1) eviction of the least-recently-used entry.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_MAX_SIZE = 500;
const DEFAULT_TTL_MS = 55 * 60 * 1000; // 55 minutes

/**
 * Generic LRU (Least Recently Used) cache with optional per-entry TTL.
 *
 * @typeParam T - The type of values stored in the cache.
 */
export class LRUCache<T = unknown> {
  private readonly cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  /**
   * @param maxSize  Maximum number of entries before eviction (default 500).
   * @param defaultTtlMs  Default time-to-live in milliseconds (default 55 min).
   */
  constructor(maxSize: number = DEFAULT_MAX_SIZE, defaultTtlMs: number = DEFAULT_TTL_MS) {
    this.maxSize = Math.max(1, maxSize);
    this.defaultTtlMs = Math.max(0, defaultTtlMs);
  }

  /**
   * Retrieve a cached value by key.
   *
   * Returns `undefined` when the key is absent **or** the entry has expired.
   * Successfully reading an entry refreshes its position (marks it most-recent).
   *
   * @param key - Cache key.
   * @returns The stored value, or `undefined`.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most-recently-used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Store a value in the cache.
   *
   * If the key already exists the previous entry is overwritten and its
   * position is refreshed. When the cache exceeds `maxSize` the oldest
   * (least-recently-used) entry is evicted first.
   *
   * @param key     - Cache key.
   * @param value   - Value to store.
   * @param ttlMs   - Optional per-entry TTL override (milliseconds).
   */
  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;

    // If key already exists, remove it first so re-insertion places it at the end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry when at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Check whether a non-expired entry exists for the given key.
   *
   * Does **not** refresh the entry's recency position.
   *
   * @param key - Cache key.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a single entry from the cache.
   *
   * @param key - Cache key.
   * @returns `true` if the key existed, `false` otherwise.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Remove all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current number of (non-expired) entries.
   *
   * Note: may include entries whose TTL has lapsed since the last access.
   * Call `prune()` first if an exact count is required.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries from the cache.
   *
   * Useful for reclaiming memory proactively in long-running processes.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

/** Default singleton cache instance (500 entries, 55 min TTL). */
export const cacheEngine = new LRUCache();
