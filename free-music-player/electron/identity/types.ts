// ── Input ────────────────────────────────────────────────────────

/** Track input to the identity engine. */
export interface TrackInput {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  source?: string;
  youtubeId?: string;
  spotifyId?: string;
}

// ── Output ───────────────────────────────────────────────────────

export type MatchStatus = 'exact' | 'high' | 'medium' | 'low' | 'none' | 'ambiguous';

export interface MatchResult {
  fingerprint: string;
  videoId: string | null;
  confidence: number;
  status: MatchStatus;
  normalizedTrack: NormalizedTrack;
  candidates: MatchCandidate[];
  durationClass: DurationClass;
  titleScore: number;
  artistScore: number;
  trustScore: number;
  consensusScore: number;
  versionMatch: VersionMatchResult;
  verification: VerificationResult;
  matchedAt: number;
  fromCache: boolean;
}

export interface VerificationResult {
  passed: boolean;
  status: 'verified' | 'ambiguous' | 'rejected' | 'unverified';
  confidenceSeparation: number;
  reason?: string;
}

// ── Normalized ───────────────────────────────────────────────────

export interface NormalizedTrack {
  titleCanonical: string;
  artistCanonical: string;
  titleTokens: string[];
  artistTokens: string[];
  albumCanonical?: string;
  duration: number;
  source?: string;
}

// ── Fingerprint ──────────────────────────────────────────────────

export interface FingerprintData {
  fingerprint: string;
  artistCanonical: string;
  titleCanonical: string;
  roundedDuration: number;
}

// ── Candidates ───────────────────────────────────────────────────

export interface CandidateTrack {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  channelTitle?: string;
  viewCount?: number;
  thumbnail?: string;
  nativePosition?: number;
  /** Raw search result from the provider */
  raw?: any;
}

export interface ScoredCandidate extends CandidateTrack {
  trustScore: number;
  durationScore: number;
  durationClass: DurationClass;
  titleScore: number;
  artistScore: number;
  versionClass: VersionClass;
  confidence: number;
  consensusScore: number;
}

/** Alias for ScoredCandidate used in MatchResult */
export type MatchCandidate = ScoredCandidate;

// ── Duration ─────────────────────────────────────────────────────

export enum DurationClass {
  EXACT = 'exact',
  VERY_CLOSE = 'very_close',
  CLOSE = 'close',
  INVALID = 'invalid',
}

export interface DurationCheck {
  durationClass: DurationClass;
  tolerance: number;
  difference: number;
}

// ── Version ──────────────────────────────────────────────────────

export enum VersionClass {
  STUDIO = 'studio',
  LIVE = 'live',
  ACOUSTIC = 'acoustic',
  REMIX = 'remix',
  KARAOKE = 'karaoke',
  INSTRUMENTAL = 'instrumental',
  EXTENDED = 'extended',
  REMASTER = 'remaster',
  UNKNOWN = 'unknown',
}

export interface VersionMatchResult {
  localVersion: VersionClass;
  candidateVersion: VersionClass;
  compatible: boolean;
  rejectionReason?: string;
}

// ── Confidence ───────────────────────────────────────────────────

export interface ConfidenceResult {
  finalScore: number;
  weightedComponents: ConfidenceComponents;
}

export interface ConfidenceComponents {
  titleScore: number;
  artistScore: number;
  trustScore: number;
  consensusScore: number;
  durationScore: number;
}

export const CONFIDENCE_WEIGHTS = {
  /** Duration score — the SINGLE most important signal. Song length is definitive. */
  durationScore: 0.40,
  titleScore: 0.25,
  artistScore: 0.20,
  trustScore: 0.10,
  consensusScore: 0.05,
} as const;

export const CONFIDENCE_THRESHOLDS = {
  EXACT: 95,
  HIGH: 85,
  MEDIUM: 70,
  LOW: 50,
} as const;

// ── Provider ─────────────────────────────────────────────────────

export interface CandidateQuery {
  artist?: string;
  title?: string;
  duration?: number;
  limit?: number;
}

export type SearchStrategy =
  | 'artist_title'
  | 'title_only'
  | 'artist_only'
  | 'artist_duration'
  | 'title_duration';

export interface CandidateProviderResult {
  candidates: CandidateTrack[];
  strategy: SearchStrategy;
  query: string;
}

// ── Consensus ────────────────────────────────────────────────────

export interface ConsensusResult {
  bestVideoId: string;
  consensusScore: number;
  totalSearches: number;
  agreements: number;
  videoIdFrequency: Map<string, number>;
}

// ── Verification ─────────────────────────────────────────────────

export interface VerificationCheck {
  durationConsistent: boolean;
  artistConsistent: boolean;
  versionConsistent: boolean;
  confidenceSeparation: number;
  confidenceSeparationOk: boolean;
  passed: boolean;
}

// ── Identity Store ───────────────────────────────────────────────

export interface IdentityRecord {
  fingerprint: string;
  youtubeId: string;
  confidence: number;
  verified: boolean;
  verifiedAt: number | null;
  matchedAt: number;
  matchCount: number;
  lastMatchedAt: number;
  metadataJson: string;
}

export interface IdentityStats {
  totalEntries: number;
  verifiedEntries: number;
  unverifiedEntries: number;
  averageConfidence: number;
  cacheHitRate: number;
}

// ── Cache ────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
}

// ── Engine Options ───────────────────────────────────────────────

export interface TrackIdentityOptions {
  cacheSize?: number;
  cacheTtlMs?: number;
  maxCandidates?: number;
  minConfidenceForAutoMatch?: number;
  durationTolerance?: number;
  enableConsensus?: boolean;
  enableCache?: boolean;
}

export const DEFAULT_OPTIONS: TrackIdentityOptions = {
  cacheSize: 10_000,
  cacheTtlMs: 30 * 60 * 1000, // 30 minutes
  maxCandidates: 50,
  minConfidenceForAutoMatch: 70,
  durationTolerance: 0.015, // 1.5% of duration
  enableConsensus: true,
  enableCache: true,
};

// ── Events ───────────────────────────────────────────────────────

export type IdentityEventType = 'match' | 'verify' | 'rematch' | 'invalidate' | 'cache_miss' | 'cache_hit';

export interface IdentityEvent {
  type: IdentityEventType;
  fingerprint: string;
  videoId?: string;
  confidence?: number;
  duration?: number;
  timestamp: number;
}
