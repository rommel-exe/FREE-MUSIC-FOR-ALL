import type { Track } from '@/types';
import { ipc } from '@/utils/ipc';

/** Maximum number of tracks kept in the local listening history. */
const HISTORY_LIMIT = 100;

/**
 * Local recommendation engine that builds suggestions from the user's
 * listening history and uses YouTube search for fresh candidates.
 *
 * Usage:
 *   import { recommendationEngine } from '@/engine/recommendationEngine';
 *   recommendationEngine.recordPlay(track);
 *   const picks = await recommendationEngine.getRecommendations(20);
 */
export class RecommendationEngine {
  /** Circular buffer of recently played tracks (most recent at the end). */
  private history: Track[] = [];

  /** Per-track skip counter (keyed by track.id). */
  private skipCounts = new Map<string, number>();

  /** Per-artist play counter. */
  private artistCounts = new Map<string, number>();

  // ── Recording ──────────────────────────────────────────────────────

  /**
   * Record a track play. Adds to history, increments the artist's play
   * count, and persists the play-count via IPC.
   */
  recordPlay(track: Track): void {
    this.history.push(track);
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }

    const count = this.artistCounts.get(track.artist) ?? 0;
    this.artistCounts.set(track.artist, count + 1);

    // Fire-and-forget persistence
    ipc.library.incrementPlayCount(track.id).catch(() => {});
  }

  /**
   * Record that a track was skipped. Increments the skip counter for the
   * track and adds it to the history so the algorithm can avoid it later.
   */
  recordSkip(track: Track): void {
    const count = this.skipCounts.get(track.id) ?? 0;
    this.skipCounts.set(track.id, count + 1);

    // Also add to history so it counts towards artist weighting
    this.history.push(track);
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }
  }

  // ── Queries ────────────────────────────────────────────────────────

  /**
   * Return the most-played artists, sorted descending by play count.
   * @param limit  Maximum number of artists to return (default 10).
   */
  getTopArtists(limit = 10): string[] {
    return [...this.artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([artist]) => artist);
  }

  /**
   * Return recently played tracks from the local history.
   * @param limit  Maximum number of tracks to return (default 20).
   */
  getRecentlyPlayed(limit = 20): Track[] {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Get personalised recommendations based on listening history.
   *
   * Algorithm:
   * 1. Pick the top 3 most-played artists.
   * 2. Use one of those artists as a seed search query.
   * 3. Search YouTube for fresh results.
   * 4. Filter out tracks already in history (by youtubeId).
   * 5. Return the ranked list.
   *
   * @param limit  Desired number of recommendations (default 20).
   */
  async getRecommendations(limit = 20): Promise<Track[]> {
    const topArtists = this.getTopArtists(3);

    if (topArtists.length === 0) {
      return [];
    }

    // Pick a seed artist (rotate through top 3 to add variety)
    const seedIndex = this.history.length % topArtists.length;
    const seedArtist = topArtists[seedIndex];

    // Build a search query from the seed artist
    const query = `${seedArtist} music`;
    const results = await ipc.search.searchYouTube(query, limit + 50);

    // IDs already heard
    const heardIds = new Set(this.history.map((t) => t.youtubeId));

    // Skip heavily-skipped tracks
    const heavilySkipped = new Set(
      [...this.skipCounts.entries()]
        .filter(([, count]) => count >= 3)
        .map(([id]) => id),
    );

    // Convert search results to Track-like objects and filter
    const recommendations: Track[] = results
      .filter((r) => !heardIds.has(r.id))
      .filter((r) => !heavilySkipped.has(r.id))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        album: '',
        duration: r.duration,
        thumbnail: r.thumbnail,
        path: '',
        youtubeId: r.id,
        source: 'youtube' as const,
        isFavorite: false,
        playCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

    return recommendations;
  }

  // ── Maintenance ────────────────────────────────────────────────────

  /** Clear all listening history, skip counts, and artist counts. */
  clear(): void {
    this.history = [];
    this.skipCounts.clear();
    this.artistCounts.clear();
  }
}

/** Singleton recommendation engine instance. */
export const recommendationEngine = new RecommendationEngine();
