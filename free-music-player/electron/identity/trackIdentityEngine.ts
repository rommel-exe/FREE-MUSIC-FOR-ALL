/**
 * TrackIdentityEngine — the central orchestrator that ties together all
 * identity sub-modules into a single, cohesive API.
 *
 * Every consumer (Search, Playlist Imports, Library Prematching,
 * Auto-recovery, Recommendations, Downloads, Queue Restoration) calls
 * into this class. It never throws — a valid `MatchResult` is always
 * returned, even on failure (with `status: 'none'`).
 *
 * @module
 */

import type {
  TrackInput,
  TrackIdentityOptions,
  NormalizedTrack,
  FingerprintData,
  CandidateTrack,
  CandidateProviderResult,
  ScoredCandidate,
  MatchCandidate,
  MatchResult,
  MatchStatus,
  VerificationResult,
  VersionMatchResult,
  ConsensusResult,
  IdentityRecord,
  IdentityStats,
  IdentityEvent,
  IdentityEventType,
} from './types';
import { DurationClass, VersionClass, CONFIDENCE_THRESHOLDS, DEFAULT_OPTIONS } from './types';
import { classifyScore } from './confidenceEngine';
import { emitTrace } from '../utils/trace';

import { MetadataNormalizer } from './metadataNormalizer';
import { FingerprintGenerator } from './fingerprintGenerator';
import { DurationEngine } from './durationEngine';
import { TitleEngine } from './titleEngine';
import { ArtistEngine } from './artistEngine';
import { VersionEngine } from './versionEngine';
import { TrustEngine } from './trustEngine';
import { CandidateProvider } from './candidateProvider';
import { ConsensusEngine } from './consensusEngine';
import { ConfidenceEngine } from './confidenceEngine';
import { VerificationEngine } from './verificationEngine';
import { IdentityStore } from './identityStore';
import { MatchCache } from './matchCache';

// ── Event System ──────────────────────────────────────────────────

export type IdentityEventHandler = (event: IdentityEvent) => void;

// ── TrackIdentityEngine ───────────────────────────────────────────

export class TrackIdentityEngine {
  // ── Sub-modules ─────────────────────────────────────────────────
  private readonly normalizer: MetadataNormalizer;
  private readonly fingerprintGen: FingerprintGenerator;
  private readonly durationEngine: DurationEngine;
  private readonly titleEngine: TitleEngine;
  private readonly artistEngine: ArtistEngine;
  private readonly versionEngine: VersionEngine;
  private readonly trustEngine: TrustEngine;
  private readonly candidateProvider: CandidateProvider;
  private readonly consensusEngine: ConsensusEngine;
  private readonly confidenceEngine: ConfidenceEngine;
  private readonly verificationEngine: VerificationEngine;
  private readonly store: IdentityStore;
  private readonly cache: MatchCache;

  // ── Options ─────────────────────────────────────────────────────
  private readonly options: {
    cacheSize: number;
    cacheTtlMs: number;
    maxCandidates: number;
    minConfidenceForAutoMatch: number;
    durationTolerance: number;
    enableConsensus: boolean;
    enableCache: boolean;
  };

  // ── State ───────────────────────────────────────────────────────
  private initialized = false;

  // ── Event listeners ─────────────────────────────────────────────
  private readonly listeners = new Map<string, IdentityEventHandler[]>();

  // ── Constructor ─────────────────────────────────────────────────

  constructor(options?: TrackIdentityOptions) {
    this.options = {
      cacheSize: options?.cacheSize ?? DEFAULT_OPTIONS.cacheSize!,
      cacheTtlMs: options?.cacheTtlMs ?? DEFAULT_OPTIONS.cacheTtlMs!,
      maxCandidates: options?.maxCandidates ?? DEFAULT_OPTIONS.maxCandidates!,
      minConfidenceForAutoMatch: options?.minConfidenceForAutoMatch ?? DEFAULT_OPTIONS.minConfidenceForAutoMatch!,
      durationTolerance: options?.durationTolerance ?? DEFAULT_OPTIONS.durationTolerance!,
      enableConsensus: options?.enableConsensus ?? DEFAULT_OPTIONS.enableConsensus!,
      enableCache: options?.enableCache ?? DEFAULT_OPTIONS.enableCache!,
    };

    // Create all sub-modules
    this.normalizer = new MetadataNormalizer();
    this.fingerprintGen = new FingerprintGenerator(this.normalizer);
    this.durationEngine = new DurationEngine();
    this.titleEngine = new TitleEngine();
    this.artistEngine = new ArtistEngine();
    this.versionEngine = new VersionEngine();
    this.trustEngine = new TrustEngine();
    this.candidateProvider = new CandidateProvider({
      maxCandidates: this.options.maxCandidates,
    });
    this.consensusEngine = new ConsensusEngine();
    this.confidenceEngine = new ConfidenceEngine();
    this.verificationEngine = new VerificationEngine(
      this.durationEngine,
      this.titleEngine,
      this.artistEngine,
      this.versionEngine,
    );
    this.store = new IdentityStore();
    this.cache = new MatchCache({
      maxSize: this.options.cacheSize,
      ttlMs: this.options.cacheTtlMs,
    });
  }

  // ── Initialization ──────────────────────────────────────────────

  /** Initialize the engine — call once at app startup. */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.store.init();
      this.initialized = true;
      console.log('[TrackIdentityEngine] Initialized successfully');
      console.log(
        `[TrackIdentityEngine] Options: cacheSize=${this.options.cacheSize}, ` +
          `cacheTtl=${this.options.cacheTtlMs}ms, maxCandidates=${this.options.maxCandidates}, ` +
          `enableConsensus=${this.options.enableConsensus}, enableCache=${this.options.enableCache}`
      );
    } catch (err) {
      console.error('[TrackIdentityEngine] Initialization failed:', err);
      // Still mark as initialized — we'll degrade gracefully
      this.initialized = true;
    }
  }

  // ── Primary API ─────────────────────────────────────────────────

  /**
   * Identify a single track — the primary entry point.
   *
   * Runs the full pipeline: normalize → fingerprint → cache check →
   * store check → candidate search → duration filter → title/artist
   * scoring → version detection → trust scoring → consensus →
   * confidence ranking → verification → store/cache → return.
   */
  async identify(track: TrackInput): Promise<MatchResult> {
    this.ensureInitialized();

    emitTrace(track.title, track.artist, 'IDENTITY_INPUT', {
      duration: track.duration,
    });

    // Step 1: Normalize metadata
    let normalizedTrack: NormalizedTrack;
    try {
      normalizedTrack = this.normalizer.normalize(track);
    } catch (err) {
      console.error('[TrackIdentityEngine] normalize failed:', err);
      return this.buildEmptyResult(track, 'Failed to normalize metadata');
    }

    // Step 2: Generate fingerprint
    let fingerprintData: FingerprintData;
    try {
      fingerprintData = this.fingerprintGen.generate(normalizedTrack);
    } catch (err) {
      console.error('[TrackIdentityEngine] fingerprint generation failed:', err);
      return this.buildEmptyResult(track, 'Failed to generate fingerprint');
    }

    const { fingerprint } = fingerprintData;

    // Step 3: Check in-memory cache
    if (this.options.enableCache) {
      try {
        const cached = this.cache.get(fingerprint);
        if (cached) {
          this.emitEvent('cache_hit', fingerprint);
          return { ...cached, fromCache: true };
        }
      } catch (err) {
        console.error('[TrackIdentityEngine] cache read failed:', err);
      }
    }

    // Step 4: Check persistent store
    try {
      const record = this.store.get(fingerprint);
      if (record && record.verified) {
        const confidence = record.confidence;
        if (confidence >= this.options.minConfidenceForAutoMatch) {
          this.store.recordMatch(fingerprint);
          const result = this.buildResultFromRecord(
            fingerprint,
            normalizedTrack,
            record,
          );
          if (this.options.enableCache) {
            this.cache.set(fingerprint, result);
          }
          this.emitEvent('match', fingerprint, record.youtubeId, confidence);
          return result;
        }
      }
    } catch (err) {
      console.error('[TrackIdentityEngine] store read failed:', err);
    }

    // Step 5: Find candidates via multi-strategy search
    let strategyResults: CandidateProviderResult[];
    try {
      strategyResults = await this.candidateProvider.findCandidates({
        artist: normalizedTrack.artistCanonical,
        title: normalizedTrack.titleCanonical,
        duration: normalizedTrack.duration,
        limit: this.options.maxCandidates,
      });
    } catch (err) {
      console.error('[TrackIdentityEngine] candidate search failed:', err);
      return this.buildEmptyResult(track, 'Failed to search for candidates');
    }

    // Flatten all candidates from all strategies
    const allCandidates: CandidateTrack[] = [];
    for (const sr of strategyResults) {
      allCandidates.push(...sr.candidates);
    }

    // Deduplicate by videoId (first occurrence wins — strategy order preserved)
    const seenIds = new Set<string>();
    const deduped: CandidateTrack[] = [];
    for (const c of allCandidates) {
      if (c.videoId && !seenIds.has(c.videoId)) {
        seenIds.add(c.videoId);
        deduped.push(c);
      }
    }

    emitTrace(track.title, track.artist, 'CANDIDATES', {
      count: deduped.length,
      candidates: deduped.slice(0, 20).map(c => ({
        videoId: c.videoId,
        title: c.title,
        artist: c.artist,
        duration: c.duration,
      })),
    });

    if (deduped.length === 0) {
      const result = this.buildEmptyResult(track, 'No candidates found');
      if (this.options.enableCache) {
        this.cache.set(fingerprint, result);
      }
      return result;
    }

    // Step 6: Reject duration outliers via density clustering
    // Finds the dominant duration cluster in the candidate pool and removes
    // candidates that are clearly outside it (wrong song, extended version, etc.).
    // This is a PRE-FILTER — it narrows the pool but does NOT replace the
    // source metadata duration used for the downstream DurationEngine.
    const clusterCenter = this.computeDominantDurationCluster(deduped);
    let durationFiltered: CandidateTrack[] = deduped;

    if (clusterCenter > 0) {
      const tolerance = Math.max(25, clusterCenter * 0.2);
      const kept = deduped.filter(c => {
        if (c.duration <= 0) return true; // keep unknown durations
        return Math.abs(c.duration - clusterCenter) <= tolerance;
      });
      if (kept.length > 0) {
        durationFiltered = kept;
        if (kept.length < deduped.length) {
          console.log(
            `[TrackIdentityEngine] Duration outlier rejection: kept ${kept.length}/${deduped.length} ` +
            `candidates within ${tolerance.toFixed(0)}s of cluster center ${clusterCenter}s ` +
            `for "${normalizedTrack.titleCanonical}"`
          );
        }
      }
    }

    // Step 7: Filter by duration (removes INVALID candidates)
    // Uses SOURCE duration (not cluster center). The cluster center was
    // only used for outlier rejection above — the existing DurationEngine
    // pipeline remains unchanged.
    let scoredCandidates: ScoredCandidate[];
    try {
      scoredCandidates = this.durationEngine.filter(
        normalizedTrack.duration,
        durationFiltered,
      );
    } catch (err) {
      console.error('[TrackIdentityEngine] duration filter failed:', err);
      scoredCandidates = [];
    }

    // Fallback: retry with ALL deduped candidates if outlier-filtered pool
    // is too restrictive
    if (scoredCandidates.length === 0 && durationFiltered !== deduped) {
      console.warn(
        `[TrackIdentityEngine] Outlier-filtered pool (${durationFiltered.length}) produced no ` +
        `candidates for "${normalizedTrack.titleCanonical}" — falling back to all ${deduped.length}`
      );
      try {
        scoredCandidates = this.durationEngine.filter(normalizedTrack.duration, deduped);
      } catch {
        scoredCandidates = [];
      }
    }

    emitTrace(track.title, track.artist, 'AFTER_DURATION', {
      count: scoredCandidates.length,
    });

    if (scoredCandidates.length === 0) {
      const result = this.buildEmptyResult(track, 'All candidates failed duration check');
      if (this.options.enableCache) {
        this.cache.set(fingerprint, result);
      }
      return result;
    }

    // Step 7–10: Score titles, artists, detect versions, compute trust
    for (const candidate of scoredCandidates) {
      try {
        candidate.titleScore = this.titleEngine.score(
          normalizedTrack.titleCanonical,
          candidate.title,
        );
      } catch {
        candidate.titleScore = 0;
      }

      try {
        candidate.artistScore = this.artistEngine.score(
          normalizedTrack.artistCanonical,
          candidate.artist,
        );
      } catch {
        candidate.artistScore = 0;
      }

      try {
        const versionResult = this.versionEngine.detectAndCheck(
          normalizedTrack.titleCanonical,
          candidate.title,
        );
        candidate.versionClass = versionResult.candidateVersion;
      } catch {
        candidate.versionClass = VersionClass.UNKNOWN;
      }

      try {
        // TrustEngine.score expects raw title/artist, not normalized
        const rawTitle = candidate.title || normalizedTrack.titleCanonical;
        const rawArtist = candidate.artist || normalizedTrack.artistCanonical;
        candidate.trustScore = this.trustEngine.score(
          rawTitle,
          rawArtist,
          candidate.duration,
          candidate.channelTitle,
        );
      } catch {
        candidate.trustScore = 0;
      }
    }

    // Step 11: Build consensus across strategies
    let consensusResult: ConsensusResult | undefined;
    if (this.options.enableConsensus && strategyResults.length > 1) {
      try {
        consensusResult = this.consensusEngine.compute(strategyResults);
        // Apply consensus scores to candidates
        for (const candidate of scoredCandidates) {
          candidate.consensusScore = this.consensusEngine.scoreForVideoId(
            candidate.videoId,
            strategyResults,
          );
        }
      } catch (err) {
        console.error('[TrackIdentityEngine] consensus computation failed:', err);
      }
    }

    // Step 12–13: Compute final confidence and rank
    let rankedCandidates: ScoredCandidate[];
    try {
      rankedCandidates = this.confidenceEngine.rank(scoredCandidates);
    } catch (err) {
      console.error('[TrackIdentityEngine] confidence ranking failed:', err);
      rankedCandidates = scoredCandidates;
    }

    // Step 14: Verify top candidates
    let verificationResult: VerificationResult;
    try {
      verificationResult = this.verificationEngine.verify(
        track,
        rankedCandidates,
        this.titleEngine,
        this.artistEngine,
        this.versionEngine,
        this.durationEngine,
      );
    } catch (err) {
      console.error('[TrackIdentityEngine] verification failed:', err);
      verificationResult = {
        passed: false,
        status: 'unverified',
        confidenceSeparation: 0,
        reason: `verification error: ${(err as Error).message}`,
      };
    }

    // Step 15–16: Build, store, and cache the result
    const bestCandidate = rankedCandidates[0];
    const versionResult: VersionMatchResult = bestCandidate
      ? (() => {
          try {
            return this.versionEngine.detectAndCheck(
              normalizedTrack.titleCanonical,
              bestCandidate.title,
            );
          } catch {
            return {
              localVersion: VersionClass.UNKNOWN,
              candidateVersion: VersionClass.UNKNOWN,
              compatible: true,
            };
          }
        })()
      : {
          localVersion: VersionClass.UNKNOWN,
          candidateVersion: VersionClass.UNKNOWN,
          compatible: true,
        };

    const matchStatus: MatchStatus =
      verificationResult.status === 'verified' && bestCandidate
        ? classifyScore(bestCandidate.confidence)
        : 'ambiguous';

    const matchResult: MatchResult = {
      fingerprint,
      videoId: bestCandidate?.videoId ?? null,
      confidence: bestCandidate?.confidence ?? 0,
      status: bestCandidate ? matchStatus : 'none',
      normalizedTrack,
      candidates: rankedCandidates.slice(0, 5) as MatchCandidate[],
      durationClass: bestCandidate?.durationClass ?? DurationClass.INVALID,
      titleScore: bestCandidate?.titleScore ?? 0,
      artistScore: bestCandidate?.artistScore ?? 0,
      trustScore: bestCandidate?.trustScore ?? 0,
      consensusScore: consensusResult?.consensusScore ?? 0,
      versionMatch: versionResult,
      verification: verificationResult,
      matchedAt: Date.now(),
      fromCache: false,
    };

    if (bestCandidate) {
      emitTrace(track.title, track.artist, 'WINNER', {
        videoId: bestCandidate.videoId,
        candidateTitle: bestCandidate.title,
        candidateArtist: bestCandidate.artist,
        candidateDuration: bestCandidate.duration,
        score: bestCandidate.confidence,
      });
    }

    // Store in persistent store
    try {
      if (bestCandidate) {
        const record: IdentityRecord = {
          fingerprint,
          youtubeId: bestCandidate.videoId,
          confidence: bestCandidate.confidence,
          verified: verificationResult.passed,
          verifiedAt: verificationResult.passed ? Date.now() : null,
          matchedAt: Date.now(),
          matchCount: 1,
          lastMatchedAt: Date.now(),
          metadataJson: JSON.stringify({
            title: normalizedTrack.titleCanonical,
            artist: normalizedTrack.artistCanonical,
            duration: normalizedTrack.duration,
          }),
        };
        this.store.set(record);
      }
    } catch (err) {
      console.error('[TrackIdentityEngine] store write failed:', err);
    }

    // Cache in memory
    if (this.options.enableCache) {
      try {
        this.cache.set(fingerprint, matchResult);
      } catch (err) {
        console.error('[TrackIdentityEngine] cache write failed:', err);
      }
    }

    this.emitEvent('match', fingerprint, matchResult.videoId ?? undefined, matchResult.confidence);
    return matchResult;
  }

  // ── Verify ──────────────────────────────────────────────────────

  /**
   * Verify a known candidate against a track.
   *
   * Used when a caller already has a specific candidate (e.g., from a
   * previous search or manual selection) and wants to check if it
   * matches the local track.
   */
  async verify(
    track: TrackInput,
    candidate: CandidateTrack,
  ): Promise<VerificationResult> {
    this.ensureInitialized();

    try {
      // Build a minimal ScoredCandidate from the provided candidate
      const normalizedTrack = this.normalizer.normalize(track);

      const versionResult = this.versionEngine.detectAndCheck(
        normalizedTrack.titleCanonical,
        candidate.title,
      );

      const titleScore = this.titleEngine.score(
        normalizedTrack.titleCanonical,
        candidate.title,
      );

      const artistScore = this.artistEngine.score(
        normalizedTrack.artistCanonical,
        candidate.artist,
      );

      const trustScore = this.trustEngine.score(
        candidate.title,
        candidate.artist,
        candidate.duration,
        candidate.channelTitle,
      );

      const durationCheck = this.durationEngine.check(
        normalizedTrack.duration,
        candidate.duration,
      );

      const scoredCandidate: ScoredCandidate = {
        ...candidate,
        trustScore,
        durationScore: durationCheck.durationClass === DurationClass.INVALID ? 0 : 80,
        durationClass: durationCheck.durationClass,
        titleScore,
        artistScore,
        versionClass: versionResult.candidateVersion,
        confidence: 0,
        consensusScore: 0,
      };

      // Compute confidence
      const confResult = this.confidenceEngine.compute(scoredCandidate);
      scoredCandidate.confidence = confResult.finalScore;

      // Run verification
      const result = this.verificationEngine.verify(
        track,
        [scoredCandidate],
        this.titleEngine,
        this.artistEngine,
        this.versionEngine,
        this.durationEngine,
      );

      this.emitEvent(
        'verify',
        '',
        candidate.videoId,
        scoredCandidate.confidence,
      );

      return result;
    } catch (err) {
      console.error('[TrackIdentityEngine] verify failed:', err);
      return {
        passed: false,
        status: 'unverified',
        confidenceSeparation: 0,
        reason: `verification error: ${(err as Error).message}`,
      };
    }
  }

  // ── Batch Identify ──────────────────────────────────────────────

  /**
   * Batch identify multiple tracks with progress reporting.
   *
   * Processes tracks with limited concurrency (default 3). Results are
   * returned in the same order as the input array. Errors per-track are
   * caught and returned as `MatchResult` with `status: 'none'`.
   */
  async batchIdentify(
    tracks: TrackInput[],
    onProgress?: (completed: number, total: number) => void,
  ): Promise<MatchResult[]> {
    this.ensureInitialized();

    const concurrency = 3;
    const results: MatchResult[] = new Array(tracks.length);
    let completed = 0;

    // Process in batches of `concurrency`
    for (let i = 0; i < tracks.length; i += concurrency) {
      const batch = tracks.slice(i, i + concurrency);
      const batchPromises = batch.map(async (track, batchIdx) => {
        const globalIdx = i + batchIdx;
        try {
          results[globalIdx] = await this.identify(track);
        } catch (err) {
          console.error(
            `[TrackIdentityEngine] batchIdentify failed for track at index ${globalIdx}:`,
            err,
          );
          results[globalIdx] = this.buildEmptyResult(
            track,
            `Batch identify error: ${(err as Error).message}`,
          );
        }
        completed++;
        if (onProgress) {
          try {
            onProgress(completed, tracks.length);
          } catch {
            // Don't let progress callback errors break the batch
          }
        }
      });

      await Promise.all(batchPromises);
    }

    return results;
  }

  // ── Rematch ─────────────────────────────────────────────────────

  /**
   * Force re-match — skips cache and store, re-runs the full pipeline
   * from scratch. Updates the stored result on success.
   */
  async rematch(track: TrackInput): Promise<MatchResult> {
    this.ensureInitialized();

    // Step 1: Normalize & fingerprint (same as identify)
    let normalizedTrack: NormalizedTrack;
    try {
      normalizedTrack = this.normalizer.normalize(track);
    } catch (err) {
      console.error('[TrackIdentityEngine] rematch normalize failed:', err);
      return this.buildEmptyResult(track, 'Failed to normalize metadata');
    }

    let fingerprintData: FingerprintData;
    try {
      fingerprintData = this.fingerprintGen.generate(normalizedTrack);
    } catch (err) {
      console.error('[TrackIdentityEngine] rematch fingerprint failed:', err);
      return this.buildEmptyResult(track, 'Failed to generate fingerprint');
    }

    const { fingerprint } = fingerprintData;

    // Step 2: Find candidates (skip cache & store)
    let strategyResults: CandidateProviderResult[];
    try {
      strategyResults = await this.candidateProvider.findCandidates({
        artist: normalizedTrack.artistCanonical,
        title: normalizedTrack.titleCanonical,
        duration: normalizedTrack.duration,
        limit: this.options.maxCandidates,
      });
    } catch (err) {
      console.error('[TrackIdentityEngine] rematch candidate search failed:', err);
      return this.buildEmptyResult(track, 'Failed to search for candidates');
    }

    // Flatten & deduplicate
    const allCandidates: CandidateTrack[] = [];
    for (const sr of strategyResults) {
      allCandidates.push(...sr.candidates);
    }
    const seenIds = new Set<string>();
    const deduped: CandidateTrack[] = [];
    for (const c of allCandidates) {
      if (c.videoId && !seenIds.has(c.videoId)) {
        seenIds.add(c.videoId);
        deduped.push(c);
      }
    }

    if (deduped.length === 0) {
      return this.buildEmptyResult(track, 'No candidates found');
    }

    // Step 3: Reject duration outliers via density clustering
    const clusterCenter = this.computeDominantDurationCluster(deduped);
    let durationFiltered: CandidateTrack[] = deduped;

    if (clusterCenter > 0) {
      const tolerance = Math.max(25, clusterCenter * 0.2);
      const kept = deduped.filter(c => {
        if (c.duration <= 0) return true;
        return Math.abs(c.duration - clusterCenter) <= tolerance;
      });
      if (kept.length > 0) {
        durationFiltered = kept;
        if (kept.length < deduped.length) {
          console.log(
            `[TrackIdentityEngine] rematch: kept ${kept.length}/${deduped.length} within ` +
            `${tolerance.toFixed(0)}s of cluster ${clusterCenter}s for "${normalizedTrack.titleCanonical}"`
          );
        }
      }
    }

    // Step 4: Filter by duration (removes INVALID candidates)
    // Uses SOURCE duration, not cluster center. The cluster center was only
    // used for outlier rejection above.
    let scoredCandidates: ScoredCandidate[];
    try {
      scoredCandidates = this.durationEngine.filter(
        normalizedTrack.duration,
        durationFiltered,
      );
    } catch {
      scoredCandidates = [];
    }

    // Fallback: retry with ALL deduped candidates if outlier-filtered pool
    // is too restrictive
    if (scoredCandidates.length === 0 && durationFiltered !== deduped) {
      try {
        scoredCandidates = this.durationEngine.filter(normalizedTrack.duration, deduped);
      } catch {
        scoredCandidates = [];
      }
    }

    if (scoredCandidates.length === 0) {
      return this.buildEmptyResult(track, 'All candidates failed duration check');
    }

    // Step 4: Score each candidate
    for (const candidate of scoredCandidates) {
      try {
        candidate.titleScore = this.titleEngine.score(
          normalizedTrack.titleCanonical,
          candidate.title,
        );
      } catch {
        candidate.titleScore = 0;
      }

      try {
        candidate.artistScore = this.artistEngine.score(
          normalizedTrack.artistCanonical,
          candidate.artist,
        );
      } catch {
        candidate.artistScore = 0;
      }

      try {
        const vr = this.versionEngine.detectAndCheck(
          normalizedTrack.titleCanonical,
          candidate.title,
        );
        candidate.versionClass = vr.candidateVersion;
      } catch {
        candidate.versionClass = VersionClass.UNKNOWN;
      }

      try {
        const rawTitle = candidate.title || normalizedTrack.titleCanonical;
        const rawArtist = candidate.artist || normalizedTrack.artistCanonical;
        candidate.trustScore = this.trustEngine.score(
          rawTitle,
          rawArtist,
          candidate.duration,
          candidate.channelTitle,
        );
      } catch {
        candidate.trustScore = 0;
      }
    }

    // Step 5: Consensus
    let consensusResult: ConsensusResult | undefined;
    if (this.options.enableConsensus && strategyResults.length > 1) {
      try {
        consensusResult = this.consensusEngine.compute(strategyResults);
        for (const candidate of scoredCandidates) {
          candidate.consensusScore = this.consensusEngine.scoreForVideoId(
            candidate.videoId,
            strategyResults,
          );
        }
      } catch (err) {
        console.error('[TrackIdentityEngine] rematch consensus failed:', err);
      }
    }

    // Step 6: Rank
    let rankedCandidates: ScoredCandidate[];
    try {
      rankedCandidates = this.confidenceEngine.rank(scoredCandidates);
    } catch {
      rankedCandidates = scoredCandidates;
    }

    // Step 7: Verify
    let verificationResult: VerificationResult;
    try {
      verificationResult = this.verificationEngine.verify(
        track,
        rankedCandidates,
        this.titleEngine,
        this.artistEngine,
        this.versionEngine,
        this.durationEngine,
      );
    } catch (err) {
      verificationResult = {
        passed: false,
        status: 'unverified',
        confidenceSeparation: 0,
        reason: `verification error: ${(err as Error).message}`,
      };
    }

    // Step 8: Build result
    const bestCandidate = rankedCandidates[0];
    const versionResult: VersionMatchResult = bestCandidate
      ? (() => {
          try {
            return this.versionEngine.detectAndCheck(
              normalizedTrack.titleCanonical,
              bestCandidate.title,
            );
          } catch {
            return {
              localVersion: VersionClass.UNKNOWN,
              candidateVersion: VersionClass.UNKNOWN,
              compatible: true,
            };
          }
        })()
      : {
          localVersion: VersionClass.UNKNOWN,
          candidateVersion: VersionClass.UNKNOWN,
          compatible: true,
        };

    const matchStatus: MatchStatus =
      verificationResult.status === 'verified' && bestCandidate
        ? classifyScore(bestCandidate.confidence)
        : 'ambiguous';

    const matchResult: MatchResult = {
      fingerprint,
      videoId: bestCandidate?.videoId ?? null,
      confidence: bestCandidate?.confidence ?? 0,
      status: bestCandidate ? matchStatus : 'none',
      normalizedTrack,
      candidates: rankedCandidates.slice(0, 5) as MatchCandidate[],
      durationClass: bestCandidate?.durationClass ?? DurationClass.INVALID,
      titleScore: bestCandidate?.titleScore ?? 0,
      artistScore: bestCandidate?.artistScore ?? 0,
      trustScore: bestCandidate?.trustScore ?? 0,
      consensusScore: consensusResult?.consensusScore ?? 0,
      versionMatch: versionResult,
      verification: verificationResult,
      matchedAt: Date.now(),
      fromCache: false,
    };

    // Step 9: Update persistent store (overwrite)
    try {
      if (bestCandidate) {
        const existing = this.store.get(fingerprint);
        const record: IdentityRecord = {
          fingerprint,
          youtubeId: bestCandidate.videoId,
          confidence: bestCandidate.confidence,
          verified: verificationResult.passed,
          verifiedAt: verificationResult.passed ? Date.now() : null,
          matchedAt: Date.now(),
          matchCount: (existing?.matchCount ?? 0) + 1,
          lastMatchedAt: Date.now(),
          metadataJson: JSON.stringify({
            title: normalizedTrack.titleCanonical,
            artist: normalizedTrack.artistCanonical,
            duration: normalizedTrack.duration,
          }),
        };
        this.store.set(record);
      }
    } catch (err) {
      console.error('[TrackIdentityEngine] rematch store write failed:', err);
    }

    // Step 10: Update cache
    if (this.options.enableCache) {
      try {
        this.cache.set(fingerprint, matchResult);
      } catch (err) {
        console.error('[TrackIdentityEngine] rematch cache write failed:', err);
      }
    }

    this.emitEvent('rematch', fingerprint, matchResult.videoId ?? undefined, matchResult.confidence);
    return matchResult;
  }

  // ── Invalidate ──────────────────────────────────────────────────

  /**
   * Invalidate a cached fingerprint — removes from both in-memory
   * cache and persistent store.
   */
  async invalidate(fingerprint: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.cache.delete(fingerprint);
    } catch (err) {
      console.error('[TrackIdentityEngine] cache invalidate failed:', err);
    }

    try {
      this.store.delete(fingerprint);
    } catch (err) {
      console.error('[TrackIdentityEngine] store invalidate failed:', err);
    }

    this.emitEvent('invalidate', fingerprint);
  }

  // ── Statistics ──────────────────────────────────────────────────

  /** Get engine statistics including cache stats. */
  getStats(): IdentityStats & { cacheStats: { size: number; hitRate: number } } {
    this.ensureInitialized();

    let storeStats: IdentityStats;
    try {
      storeStats = this.store.getStats();
    } catch {
      storeStats = {
        totalEntries: 0,
        verifiedEntries: 0,
        unverifiedEntries: 0,
        averageConfidence: 0,
        cacheHitRate: 0,
      };
    }

    let cacheStats = { size: 0, hitRate: 0 };
    try {
      const cs = this.cache.stats();
      cacheStats = { size: cs.size, hitRate: cs.hitRate };
    } catch {
      // defaults already set
    }

    return {
      ...storeStats,
      cacheHitRate: cacheStats.hitRate,
      cacheStats,
    };
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  /**
   * Clean up old/low-confidence entries from both the persistent store
   * and the in-memory cache.
   *
   * @returns The number of entries removed from the persistent store.
   */
  async cleanup(): Promise<number> {
    this.ensureInitialized();

    let storeRemoved = 0;
    try {
      storeRemoved = this.store.cleanup();
    } catch (err) {
      console.error('[TrackIdentityEngine] store cleanup failed:', err);
    }

    try {
      this.cache.prune();
    } catch (err) {
      console.error('[TrackIdentityEngine] cache prune failed:', err);
    }

    console.log(`[TrackIdentityEngine] Cleanup: removed ${storeRemoved} store entries`);
    return storeRemoved;
  }

  // ── Event System ────────────────────────────────────────────────

  /** Subscribe to an engine event. */
  on(event: IdentityEventType, handler: IdentityEventHandler): void {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  /** Unsubscribe from an engine event. */
  off(event: IdentityEventType, handler: IdentityEventHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const idx = handlers.indexOf(handler);
    if (idx !== -1) {
      handlers.splice(idx, 1);
    }
    if (handlers.length === 0) {
      this.listeners.delete(event);
    }
  }

  /** Emit an event to all registered handlers. */
  private emitEvent(
    type: IdentityEventType,
    fingerprint: string,
    videoId?: string,
    confidence?: number,
  ): void {
    const event: IdentityEvent = {
      type,
      fingerprint,
      videoId,
      confidence,
      timestamp: Date.now(),
    };

    const handlers = this.listeners.get(type);
    if (!handlers || handlers.length === 0) return;

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[TrackIdentityEngine] event handler error for "${type}":`, err);
      }
    }
  }

  // ── Private Helpers ─────────────────────────────────────────────

  /**
   * Find the dominant duration cluster center among candidates.
   *
   * Uses density-based clustering: for each candidate duration, counts
   * neighbors within a 10-second window. Returns the duration with the
   * densest neighborhood (tie-break: shorter).
   *
   * This is NOT a replacement for trust scoring — it's a pre-filter to
   * reject obvious outliers (e.g., a 3:42 upload when everyone else is
   * 2:41). It considers ALL candidates regardless of remix/cover status
   * because if the TRACK ITSELF is a remix, every legitimate YouTube
   * result will also be a remix.
   *
   * Returns 0 if no reasonable cluster can be determined.
   */
  private computeDominantDurationCluster(candidates: CandidateTrack[]): number {
    // Step 1: collect plausible durations (10s–1hr range)
    const durations = candidates
      .map(c => Math.round(c.duration))
      .filter(d => d > 10 && d < 3600);

    if (durations.length === 0) return 0;

    // Step 2: remove outliers >50% from median
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const outlierThreshold = Math.max(median * 0.5, 30); // at least 30s
    const filtered = durations.filter(d => Math.abs(d - median) <= outlierThreshold);

    if (filtered.length === 0) return 0;

    // Step 3: density estimation — find the duration with the most
    // neighbors within a 10-second window
    const WINDOW = 10;
    let bestDuration = 0;
    let bestDensity = 0;

    for (const candidate of filtered) {
      let density = 0;
      for (const other of filtered) {
        if (Math.abs(other - candidate) <= WINDOW) density++;
      }
      // Tie-break: prefer shorter duration
      if (density > bestDensity || (density === bestDensity && (bestDuration === 0 || candidate < bestDuration))) {
        bestDensity = density;
        bestDuration = candidate;
      }
    }

    return bestDuration;
  }

  /** Ensure the engine has been initialized. */
  private ensureInitialized(): void {
    if (!this.initialized) {
      console.warn('[TrackIdentityEngine] Engine not initialized — calling initialize() now');
      // Synchronous fallback — init() will be awaited on the first identify() call
      this.store.init();
      this.initialized = true;
    }
  }

  /**
   * Build an empty (no-match) MatchResult for error/empty cases.
   * Always returns a valid MatchResult with status 'none'.
   */
  private buildEmptyResult(
    track: TrackInput,
    reason?: string,
  ): MatchResult {
    let normalizedTrack: NormalizedTrack;
    try {
      normalizedTrack = this.normalizer.normalize(track);
    } catch {
      // Minimal fallback normalization
      normalizedTrack = {
        titleCanonical: (track.title || '').toLowerCase().trim(),
        artistCanonical: (track.artist || '').toLowerCase().trim(),
        titleTokens: [],
        artistTokens: [],
        duration: track.duration,
        source: track.source,
      };
    }

    let fingerprint = '';
    try {
      const fp = this.fingerprintGen.generate(normalizedTrack);
      fingerprint = fp.fingerprint;
    } catch {
      // empty fingerprint is fine for error cases
    }

    return {
      fingerprint,
      videoId: null,
      confidence: 0,
      status: 'none',
      normalizedTrack,
      candidates: [],
      durationClass: DurationClass.INVALID,
      titleScore: 0,
      artistScore: 0,
      trustScore: 0,
      consensusScore: 0,
      versionMatch: {
        localVersion: VersionClass.UNKNOWN,
        candidateVersion: VersionClass.UNKNOWN,
        compatible: true,
      },
      verification: {
        passed: false,
        status: 'unverified',
        confidenceSeparation: 0,
        reason,
      },
      matchedAt: Date.now(),
      fromCache: false,
    };
  }

  /**
   * Build a MatchResult from a persisted IdentityRecord.
   * Used when returning results from the store without re-running the pipeline.
   */
  private buildResultFromRecord(
    fingerprint: string,
    normalizedTrack: NormalizedTrack,
    record: IdentityRecord,
  ): MatchResult {
    return {
      fingerprint,
      videoId: record.youtubeId || null,
      confidence: record.confidence,
      status: classifyScore(record.confidence),
      normalizedTrack,
      candidates: [],
      durationClass: DurationClass.EXACT,
      titleScore: 0,
      artistScore: 0,
      trustScore: 0,
      consensusScore: 0,
      versionMatch: {
        localVersion: VersionClass.UNKNOWN,
        candidateVersion: VersionClass.UNKNOWN,
        compatible: true,
      },
      verification: {
        passed: record.verified,
        status: record.verified ? 'verified' : 'unverified',
        confidenceSeparation: 100,
      },
      matchedAt: record.lastMatchedAt,
      fromCache: false,
    };
  }
}

// ── Singleton Factory ─────────────────────────────────────────────

/**
 * Global singleton — created with default options.
 * Call `trackIdentityEngine.initialize()` once at app startup.
 */
export const trackIdentityEngine: TrackIdentityEngine = new TrackIdentityEngine();

/**
 * Create a shared engine instance with specific options.
 *
 * Each call creates a new independent instance — use this when you
 * need custom configuration (e.g., different cache sizes for tests).
 */
export function createIdentityEngine(options?: TrackIdentityOptions): TrackIdentityEngine {
  return new TrackIdentityEngine(options);
}
