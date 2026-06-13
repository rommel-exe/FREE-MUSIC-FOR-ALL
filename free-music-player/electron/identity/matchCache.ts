/**
 * In-memory LRU cache for MatchResult lookups.
 *
 * Provides fast fingerprint → MatchResult access without hitting SQLite
 * or the network. Uses a generic LRUCache<K, V> internally so the cache
 * can be reused by other engines.
 *
 * Uses a Map to preserve insertion order, enabling O(1) access and
 * O(1) eviction of the least-recently-used entry.
 */

import type { MatchResult } from './types';

// ── Defaults ──────────────────────────────────────────────────────

/** Default maximum number of cache entries. */
export const FINGERPRINT_CACHE_SIZE = 10_000;

/** Default time-to-live for cache entries (30 minutes). */
export const FINGERPRINT_CACHE_TTL_MS = 30 * 60 * 1000;

// ── Internal Types ────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
}

// ── Generic LRU Cache ─────────────────────────────────────────────

/**
 * Generic LRU (Least Recently Used) cache with optional per-entry TTL
 * and per-entry access count tracking.
 *
 * @typeParam K - The type of keys stored in the cache.
 * @typeParam V - The type of values stored in the cache.
 */
export class LRUCache<K, V> {
  private readonly cache: Map<K, CacheEntry<V>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtlMs: number;

  /**
   * @param maxSize  Maximum number of entries before eviction.
   * @param ttlMs    Default time-to-live in milliseconds (0 = no expiry).
   */
  constructor(maxSize: number, ttlMs?: number) {
    this.maxSize = Math.max(1, maxSize);
    this.defaultTtlMs = Math.max(0, ttlMs ?? 0);
  }

  /**
   * Retrieve a cached value by key.
   *
   * Returns `null` when the key is absent **or** the entry has expired.
   * Successfully reading an entry refreshes its position (marks it most-recent).
   *
   * @param key - Cache key.
   * @returns The stored value, or `null`.
   */
  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most-recently-used) by re-inserting
    entry.accessCount++;
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
  set(key: K, value: V, ttlMs?: number): void {
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
      accessCount: 0,
    });
  }

  /**
   * Check whether a non-expired entry exists for the given key.
   *
   * Does **not** refresh the entry's recency position.
   *
   * @param key - Cache key.
   */
  has(key: K): boolean {
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
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Remove all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current number of entries (may include expired ones not yet pruned).
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Remove all expired entries from the cache.
   *
   * @returns The number of entries removed.
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

// ── Match Cache ───────────────────────────────────────────────────

/**
 * In-memory LRU cache for MatchResult objects, keyed by fingerprint.
 *
 * Provides O(1) lookups without hitting SQLite or the network.
 * Tracks hit/miss statistics for analytics.
 */
export class MatchCache {
  private readonly cache: LRUCache<string, MatchResult>;
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  /**
   * @param options.maxSize - Maximum cache entries (default 10 000).
   * @param options.ttlMs   - Entry TTL in ms (default 30 min).
   */
  constructor(options?: { maxSize?: number; ttlMs?: number }) {
    this.maxSize = options?.maxSize ?? FINGERPRINT_CACHE_SIZE;
    this.cache = new LRUCache(
      this.maxSize,
      options?.ttlMs ?? FINGERPRINT_CACHE_TTL_MS,
    );
  }

  /**
   * Get a cached match result by fingerprint.
   *
   * @param fingerprint - Audio fingerprint string.
   * @returns The cached MatchResult, or `null` on miss / expiry.
   */
  get(fingerprint: string): MatchResult | null {
    const result = this.cache.get(fingerprint);
    if (result !== null) {
      this.hits++;
    } else {
      this.misses++;
    }
    return result;
  }

  /**
   * Store a match result in the cache.
   *
   * @param fingerprint - Audio fingerprint string.
   * @param result      - MatchResult to cache.
   */
  set(fingerprint: string, result: MatchResult): void {
    this.cache.set(fingerprint, result);
  }

  /**
   * Check if a fingerprint is cached and not expired.
   *
   * Does **not** count as a hit or miss for statistics.
   *
   * @param fingerprint - Audio fingerprint string.
   */
  has(fingerprint: string): boolean {
    return this.cache.has(fingerprint);
  }

  /**
   * Delete a cached entry.
   *
   * @param fingerprint - Audio fingerprint string.
   * @returns `true` if the entry existed, `false` otherwise.
   */
  delete(fingerprint: string): boolean {
    return this.cache.delete(fingerprint);
  }

  /** Clear the entire cache and reset statistics. */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics.
   *
   * @returns Object with size, maxSize, hitRate, hits, and misses.
   */
  stats(): { size: number; maxSize: number; hitRate: number; hits: number; misses: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /**
   * Remove all expired entries from the cache.
   *
   * @returns The number of entries pruned.
   */
  prune(): number {
    return this.cache.prune();
  }
}
