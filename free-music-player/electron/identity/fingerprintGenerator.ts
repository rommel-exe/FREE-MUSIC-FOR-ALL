import { createHash } from 'node:crypto';
import type { FingerprintData, NormalizedTrack, TrackInput } from './types';

// ── Constants ─────────────────────────────────────────────────────

/** Length of the truncated hex fingerprint (first 16 hex chars). */
export const FINGERPRINT_LENGTH = 16;

// ── Lazy import helper ────────────────────────────────────────────
// The MetadataNormalizer module may not exist yet; use a dynamic import
// guarded at runtime so this file compiles independently.

interface LazyNormalizerModule {
  MetadataNormalizer: new () => Normalizer;
}

let _normalizerModule: LazyNormalizerModule | undefined;

async function getMetadataNormalizerModule(): Promise<LazyNormalizerModule> {
  if (!_normalizerModule) {
    // @ts-ignore — metadataNormalizer.ts will be created separately
    const mod = await import('./metadataNormalizer');
    _normalizerModule = mod as unknown as LazyNormalizerModule;
  }
  return _normalizerModule;
}

// ── Interface for the normalizer dependency ────────────────────────

export interface Normalizer {
  normalize(input: TrackInput): NormalizedTrack;
}

// ── Pure helper: SHA-256 hash ─────────────────────────────────────

/**
 * Compute the SHA-256 hex digest, truncated to FINGERPRINT_LENGTH chars.
 */
function sha256Truncated(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, FINGERPRINT_LENGTH);
}

/**
 * Build the canonical fingerprint string from raw parts.
 *
 * Format: `artistCanonical \0 titleCanonical \0 roundedDuration`
 *
 * The null-byte separator prevents boundary collisions
 * (e.g. "ab" + "c" vs "a" + "bc").
 */
function buildFingerprintInput(
  artistCanonical: string,
  titleCanonical: string,
  roundedDuration: number,
): string {
  return `${artistCanonical}\0${titleCanonical}\0${roundedDuration.toString()}`;
}

// ── Pure exported functions ───────────────────────────────────────

/**
 * Quick fingerprint from raw artist / title / duration.
 *
 * This is a pure function — no normalization is applied.
 * The caller is responsible for canonical values.
 *
 * @returns 16-character hex string.
 */
export function generateFingerprint(artist: string, title: string, duration: number): string {
  const rounded = Math.round(duration);
  return sha256Truncated(buildFingerprintInput(artist, title, rounded));
}

/**
 * Hash with an optional salt for disambiguation.
 *
 * When two tracks share the same (artist, title, duration) but should
 * still be treated as distinct (e.g. different editions), a salt
 * differentiates them.
 *
 * @returns 16-character hex string.
 */
export function hashWithSalt(
  artist: string,
  title: string,
  duration: number,
  salt?: string,
): string {
  const rounded = Math.round(duration);
  const base = buildFingerprintInput(artist, title, rounded);
  const payload = salt ? `${base}\0${salt}` : base;
  return sha256Truncated(payload);
}

// ── FingerprintGenerator class ────────────────────────────────────

export class FingerprintGenerator {
  private readonly normalizer: Normalizer | undefined;

  /**
   * @param normalizer Optional pre-configured MetadataNormalizer.
   *                   If omitted, the module-level lazy import is used
   *                   when `fingerprintFromTrackInput` is called.
   */
  constructor(normalizer?: Normalizer) {
    this.normalizer = normalizer;
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Generate a fingerprint from an already-normalized track.
   */
  generate(normalized: NormalizedTrack): FingerprintData {
    const roundedDuration = Math.round(normalized.duration);

    return {
      fingerprint: generateFingerprint(
        normalized.artistCanonical,
        normalized.titleCanonical,
        roundedDuration,
      ),
      artistCanonical: normalized.artistCanonical,
      titleCanonical: normalized.titleCanonical,
      roundedDuration,
    };
  }

  /**
   * Generate a fingerprint from raw TrackInput + duration.
   *
   * Uses the injected normalizer to canonicalize artist and title
   * before hashing.
   */
  generateFromInput(input: TrackInput & { duration: number }): FingerprintData {
    const normalizer = this.normalizer ?? createNormalizerSync();
    const normalized = normalizer.normalize(input);
    return this.generate(normalized);
  }
}

// ── Convenience function ──────────────────────────────────────────

/**
 * Normalize a TrackInput and return the full FingerprintData.
 *
 * This is a convenience wrapper that uses either the provided
 * normalizer or the lazy-imported MetadataNormalizer module.
 */
export async function fingerprintFromTrackInput(
  input: TrackInput,
  normalizer?: Normalizer,
): Promise<FingerprintData> {
  let norm: Normalizer;

  if (normalizer) {
    norm = normalizer;
  } else {
    const mod = await getMetadataNormalizerModule();
    // The MetadataNormalizer class should expose a `.normalize()` method
    // that conforms to our Normalizer interface.
    norm = new mod.MetadataNormalizer();
  }

  const normalized = norm.normalize(input);
  const roundedDuration = Math.round(normalized.duration);

  return {
    fingerprint: generateFingerprint(
      normalized.artistCanonical,
      normalized.titleCanonical,
      roundedDuration,
    ),
    artistCanonical: normalized.artistCanonical,
    titleCanonical: normalized.titleCanonical,
    roundedDuration,
  };
}

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Synchronous fallback: create a minimal normalizer when none is
 * injected.  This performs only basic canonicalization (lowercase +
 * trim) so callers never get undefined.
 *
 * Prefer constructor injection for full normalization in production.
 */
function createNormalizerSync(): Normalizer {
  return {
    normalize(input: TrackInput): NormalizedTrack {
      const titleCanonical = input.title.toLowerCase().trim();
      const artistCanonical = input.artist.toLowerCase().trim();

      return {
        titleCanonical,
        artistCanonical,
        titleTokens: titleCanonical.split(/\s+/),
        artistTokens: artistCanonical.split(/\s+/),
        albumCanonical: input.album?.toLowerCase().trim(),
        duration: input.duration,
        source: input.source,
      };
    },
  };
}
