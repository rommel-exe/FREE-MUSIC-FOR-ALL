import Database from 'better-sqlite3';
import type { IdentityRecord, IdentityStats } from './types';
import { getDb } from '../utils/database';

// ── Constants ────────────────────────────────────────────────────────

const TABLE_NAME = 'track_identity';
const DEFAULT_MIN_CONFIDENCE = 30;
const CLEANUP_MAX_AGE_DAYS = 30;

// ── Helpers ──────────────────────────────────────────────────────────

/** Convert a DB row (snake_case) to an IdentityRecord (camelCase). */
export function mapIdentityRow(row: any): IdentityRecord {
  if (!row) return row;
  return {
    fingerprint: row.fingerprint,
    youtubeId: row.youtube_id ?? '',
    confidence: row.confidence ?? 0,
    verified: (row.verified ?? 0) === 1,
    verifiedAt: row.verified_at ?? null,
    matchedAt: row.matched_at ?? 0,
    matchCount: row.match_count ?? 1,
    lastMatchedAt: row.last_matched_at ?? 0,
    metadataJson: row.metadata_json ?? '{}',
  };
}

/** Check if the track_identity table exists in the database. */
export function identityTableExists(): boolean {
  const db = getDb();
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(TABLE_NAME) as { name: string } | undefined;
  return !!row;
}

// ── IdentityStore ────────────────────────────────────────────────────

export class IdentityStore {
  private db: Database.Database;
  private _initialized = false;

  // Prepared statements (created once on init)
  private stmtGet!: Database.Statement;
  private stmtSet!: Database.Statement;
  private stmtHas!: Database.Statement;
  private stmtDelete!: Database.Statement;
  private stmtVerify!: Database.Statement;
  private stmtRecordMatch!: Database.Statement;
  private stmtGetYoutubeId!: Database.Statement;
  private stmtGetByYoutubeId!: Database.Statement;
  private stmtCount!: Database.Statement;
  private stmtCleanup!: Database.Statement;
  private stmtStatsTotal!: Database.Statement;
  private stmtStatsVerified!: Database.Statement;
  private stmtStatsAvgConfidence!: Database.Statement;

  constructor() {
    this.db = getDb();
  }

  /** Initialize the database table and prepared statements. Called once at startup. */
  init(): void {
    if (this._initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          fingerprint    TEXT PRIMARY KEY,
          youtube_id     TEXT NOT NULL DEFAULT '',
          confidence     REAL NOT NULL DEFAULT 0,
          verified       INTEGER NOT NULL DEFAULT 0,
          verified_at    INTEGER,
          matched_at     INTEGER NOT NULL,
          match_count    INTEGER NOT NULL DEFAULT 1,
          last_matched_at INTEGER NOT NULL,
          metadata_json  TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_track_identity_youtube_id ON ${TABLE_NAME}(youtube_id);
      CREATE INDEX IF NOT EXISTS idx_track_identity_verified ON ${TABLE_NAME}(verified);
      CREATE INDEX IF NOT EXISTS idx_track_identity_confidence ON ${TABLE_NAME}(confidence);
    `);

    // Pre-prepare all statements for performance
    this.stmtGet = this.db.prepare(
      `SELECT * FROM ${TABLE_NAME} WHERE fingerprint = ?`
    );
    this.stmtSet = this.db.prepare(`
      INSERT INTO ${TABLE_NAME} (fingerprint, youtube_id, confidence, verified, verified_at, matched_at, match_count, last_matched_at, metadata_json)
      VALUES (@fingerprint, @youtubeId, @confidence, @verified, @verifiedAt, @matchedAt, @matchCount, @lastMatchedAt, @metadataJson)
      ON CONFLICT(fingerprint) DO UPDATE SET
        youtube_id = excluded.youtube_id,
        confidence = excluded.confidence,
        verified = excluded.verified,
        verified_at = excluded.verified_at,
        matched_at = excluded.matched_at,
        match_count = excluded.match_count,
        last_matched_at = excluded.last_matched_at,
        metadata_json = excluded.metadata_json
    `);
    this.stmtHas = this.db.prepare(
      `SELECT 1 FROM ${TABLE_NAME} WHERE fingerprint = ?`
    );
    this.stmtDelete = this.db.prepare(
      `DELETE FROM ${TABLE_NAME} WHERE fingerprint = ?`
    );
    this.stmtVerify = this.db.prepare(
      `UPDATE ${TABLE_NAME} SET verified = 1, verified_at = ? WHERE fingerprint = ?`
    );
    this.stmtRecordMatch = this.db.prepare(
      `UPDATE ${TABLE_NAME} SET match_count = match_count + 1, last_matched_at = ? WHERE fingerprint = ?`
    );
    this.stmtGetYoutubeId = this.db.prepare(
      `SELECT youtube_id FROM ${TABLE_NAME} WHERE fingerprint = ?`
    );
    this.stmtGetByYoutubeId = this.db.prepare(
      `SELECT * FROM ${TABLE_NAME} WHERE youtube_id = ?`
    );
    this.stmtCount = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM ${TABLE_NAME}`
    );
    this.stmtCleanup = this.db.prepare(
      `DELETE FROM ${TABLE_NAME} WHERE confidence < ? AND last_matched_at < ?`
    );
    this.stmtStatsTotal = this.db.prepare(
      `SELECT COUNT(*) AS total FROM ${TABLE_NAME}`
    );
    this.stmtStatsVerified = this.db.prepare(
      `SELECT COUNT(*) AS cnt FROM ${TABLE_NAME} WHERE verified = 1`
    );
    this.stmtStatsAvgConfidence = this.db.prepare(
      `SELECT COALESCE(AVG(confidence), 0) AS avg_conf FROM ${TABLE_NAME}`
    );

    this._initialized = true;
  }

  private ensureInit(): void {
    if (!this._initialized) this.init();
  }

  /** Get an identity record by fingerprint. */
  get(fingerprint: string): IdentityRecord | null {
    this.ensureInit();
    const row = this.stmtGet.get(fingerprint) as Record<string, unknown> | undefined;
    return row ? mapIdentityRow(row) : null;
  }

  /** Set or update an identity record (upsert). */
  set(record: IdentityRecord): void {
    this.ensureInit();
    this.stmtSet.run({
      fingerprint: record.fingerprint,
      youtubeId: record.youtubeId,
      confidence: record.confidence,
      verified: record.verified ? 1 : 0,
      verifiedAt: record.verifiedAt,
      matchedAt: record.matchedAt,
      matchCount: record.matchCount,
      lastMatchedAt: record.lastMatchedAt,
      metadataJson: record.metadataJson,
    });
  }

  /** Check if a fingerprint exists in the store. */
  has(fingerprint: string): boolean {
    this.ensureInit();
    return !!this.stmtHas.get(fingerprint);
  }

  /** Delete an identity record. Returns true if a row was deleted. */
  delete(fingerprint: string): boolean {
    this.ensureInit();
    return this.stmtDelete.run(fingerprint).changes > 0;
  }

  /** Mark a match as verified. */
  verify(fingerprint: string): void {
    this.ensureInit();
    this.stmtVerify.run(Date.now(), fingerprint);
  }

  /** Increment match count and update last_matched_at. */
  recordMatch(fingerprint: string): void {
    this.ensureInit();
    this.stmtRecordMatch.run(Date.now(), fingerprint);
  }

  /** Get the youtube_id for a fingerprint (fast path — single column). */
  getYoutubeId(fingerprint: string): string | null {
    this.ensureInit();
    const row = this.stmtGetYoutubeId.get(fingerprint) as { youtube_id: string } | undefined;
    return row?.youtube_id ?? null;
  }

  /** Get identity by youtube_id (reverse lookup). */
  getByYoutubeId(youtubeId: string): IdentityRecord | null {
    this.ensureInit();
    const row = this.stmtGetByYoutubeId.get(youtubeId) as Record<string, unknown> | undefined;
    return row ? mapIdentityRow(row) : null;
  }

  /** Get all records for a list of fingerprints. */
  getBatch(fingerprints: string[]): Map<string, IdentityRecord> {
    this.ensureInit();
    const map = new Map<string, IdentityRecord>();
    if (fingerprints.length === 0) return map;

    const placeholders = fingerprints.map(() => '?').join(',');
    const rows = this.db.prepare(
      `SELECT * FROM ${TABLE_NAME} WHERE fingerprint IN (${placeholders})`
    ).all(...fingerprints) as Record<string, unknown>[];

    for (const row of rows) {
      const record = mapIdentityRow(row);
      map.set(record.fingerprint, record);
    }
    return map;
  }

  /** Get statistics about the identity store. */
  getStats(): IdentityStats {
    this.ensureInit();
    const total = (this.stmtStatsTotal.get() as { total: number }).total;
    const verified = (this.stmtStatsVerified.get() as { cnt: number }).cnt;
    const avgConf = (this.stmtStatsAvgConfidence.get() as { avg_conf: number }).avg_conf;

    return {
      totalEntries: total,
      verifiedEntries: verified,
      unverifiedEntries: total - verified,
      averageConfidence: Math.round(avgConf * 100) / 100,
      // Cache hit rate is tracked externally by the engine; default to 0 here
      cacheHitRate: 0,
    };
  }

  /** Get total number of stored identities. */
  count(): number {
    this.ensureInit();
    return (this.stmtCount.get() as { cnt: number }).cnt;
  }

  /** Clear all expired/low-confidence entries. Returns number of deleted rows. */
  cleanup(minConfidence: number = DEFAULT_MIN_CONFIDENCE): number {
    this.ensureInit();
    const cutoffMs = Date.now() - CLEANUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const result = this.stmtCleanup.run(minConfidence, cutoffMs);
    return result.changes;
  }
}
