/**
 * AlignmentEngine — On-device lyric alignment using Whisper Base + CoreML.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  STRATEGY
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   LRCLIB Synced Lyrics  ─── (synced!)  ──► Display immediately
 *         │
 *         └── (unsynced) ── Check SQLite Cache
 *                              │
 *                              ├── Hit  ──► Display cached LRC
 *                              │
 *                              └── Miss ──► Run Whisper Base (CoreML)
 *                                             │
 *                                             ▼
 *                                      Download first 90s of audio
 *                                      │
 *                                      ▼
 *                                      Whisper.cpp → JSON segments
 *                                      │
 *                                      ▼
 *                                      Match segments → plain lyrics
 *                                      │
 *                                      ▼
 *                                      Generate LRC → Cache → Display
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  MODEL
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Model: ggml-base.en.bin (~74 MB)
 *  Source: https://huggingface.co/ggerganov/whisper.cpp/ggml-base.en.bin
 *  Path:   ~/Library/Application Support/Howle/models/ggml-base.en.bin
 *
 *  Downloaded ONCE on first alignment request if missing.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  PERFORMANCE
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  First play (cache miss):  3-10s  (depends on Mac model)
 *  Later plays (cache hit):  <10ms
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import { app } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { spawn } from 'node:child_process';
import { getAlignedLyrics, setAlignedLyrics } from '../utils/database';

/* ── Constants ──────────────────────────────────────────────────── */

/** Hugging Face URL for the whisper.cpp Base model. */
const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';

/** Filename of the Base model. */
const MODEL_FILENAME = 'ggml-base.en.bin';

/** Audio chunk duration to process (seconds). First 90s is enough for timing. */
const AUDIO_CHUNK_DURATION_S = 90;

/** Maximum audio bytes to download (~2MB should cover 90s of m4a). */
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

/** Whisper binary name. */
const WHISPER_BIN = 'whisper-cli';

/** Minimum confidence for a usable alignment (0–1). */
const MIN_CONFIDENCE = 0.3;

/** System prompt prefix used to detect hallucinated preamble. */
const HALLUCINATION_PREFIXES = [
  'thank you',
  'thanks for watching',
  'music',
  '[music]',
  '(music)',
  'foreign',
  'applause',
];

/* ─── Types ─────────────────────────────────────────────────────── */

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

export interface AlignmentResult {
  /** Generated LRC text (empty string if alignment failed). */
  lrc: string;
  /** Confidence score 0–1. */
  confidence: number;
  /** Duration of audio actually processed. */
  processedDuration: number;
  /** Whether the result came from cache. */
  fromCache: boolean;
}

/* ─── Engine ────────────────────────────────────────────────────── */

class AlignmentEngine {
  private modelsDir: string;
  private binariesDir: string;
  private modelPath: string;
  private modelDownloaded = false;
  private downloadInProgress = false;
  private downloadProgressListeners: Array<(pct: number) => void> = [];

  constructor() {
    const userData = app.getPath('userData');
    this.modelsDir = path.join(userData, 'models');
    this.binariesDir = path.join(userData, 'bin');
    this.modelPath = path.join(this.modelsDir, MODEL_FILENAME);

    // Ensure directories exist
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
    if (!fs.existsSync(this.binariesDir)) {
      fs.mkdirSync(this.binariesDir, { recursive: true });
    }
  }

  // ── Model management ─────────────────────────────────────────

  /** Check if the whisper model file exists on disk. */
  isModelDownloaded(): boolean {
    if (this.modelDownloaded) return true;
    const exists = fs.existsSync(this.modelPath);
    this.modelDownloaded = exists;
    return exists;
  }

  /** Get the path to the model file. */
  getModelPath(): string {
    return this.modelPath;
  }

  /** Subscribe to download progress (0–100). Returns unsubscribe function. */
  onDownloadProgress(fn: (pct: number) => void): () => void {
    this.downloadProgressListeners.push(fn);
    return () => {
      const idx = this.downloadProgressListeners.indexOf(fn);
      if (idx >= 0) this.downloadProgressListeners.splice(idx, 1);
    };
  }

  /** Download the model from Hugging Face if not already present. */
  async downloadModel(): Promise<boolean> {
    if (this.isModelDownloaded()) return true;
    if (this.downloadInProgress) {
      // Wait for the in-progress download
      while (this.downloadInProgress) {
        await new Promise((r) => setTimeout(r, 200));
      }
      return this.isModelDownloaded();
    }

    this.downloadInProgress = true;

    try {
      console.log('[Alignment] Downloading Whisper Base model (~74 MB)...');

      const tempPath = this.modelPath + '.downloading';
      const file = fs.createWriteStream(tempPath);

      const response = await this.fetchWithRedirect(MODEL_URL);
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;

      return new Promise<boolean>((resolve) => {
        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (totalSize > 0) {
            const pct = Math.min(100, Math.round((downloaded / totalSize) * 100));
            this.notifyProgress(pct);
          }
        });

        response.on('end', () => {
          file.end();
          fs.renameSync(tempPath, this.modelPath);
          this.modelDownloaded = true;
          this.downloadInProgress = false;
          this.notifyProgress(100);
          console.log('[Alignment] Model downloaded successfully');
          resolve(true);
        });

        response.on('error', (err) => {
          file.close();
          try { fs.unlinkSync(tempPath); } catch { /* noop */ }
          this.downloadInProgress = false;
          console.error('[Alignment] Model download failed:', err.message);
          resolve(false);
        });
      });
    } catch (err) {
      this.downloadInProgress = false;
      console.error('[Alignment] Model download error:', err);
      return false;
    }
  }

  /** Follow HTTP redirects (Hugging Face uses them). */
  private fetchWithRedirect(url: string): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
      const fetcher = url.startsWith('https') ? https.get : http.get;
      fetcher(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          const redirectUrl = new URL(res.headers.location, url).toString();
          this.fetchWithRedirect(redirectUrl).then(resolve).catch(reject);
          res.destroy();
        } else {
          resolve(res);
        }
      }).on('error', reject);
    });
  }

  private notifyProgress(pct: number): void {
    for (const fn of this.downloadProgressListeners) {
      try { fn(pct); } catch { /* noop */ }
    }
  }

  // ── Binary detection ────────────────────────────────────────

  /** Locate the whisper-cli binary. Searches bundled location, then PATH. */
  findWhisperBinary(): string | null {
    // 1. Check app resources (bundled in production)
    const resourcePath = path.join(process.resourcesPath || '', 'bin', WHISPER_BIN);
    if (fs.existsSync(resourcePath)) return resourcePath;

    // 2. Check user data binaries dir (downloaded)
    const userBinPath = path.join(this.binariesDir, WHISPER_BIN);
    if (fs.existsSync(userBinPath)) return userBinPath;

    // 3. Check PATH
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    for (const dir of pathDirs) {
      try {
        const fullPath = path.join(dir, WHISPER_BIN);
        if (fs.existsSync(fullPath)) return fullPath;
      } catch { /* skip invalid dirs */ }
    }

    // 4. Check common Homebrew location
    const brewPaths = [
      '/opt/homebrew/bin/whisper-cli',
      '/usr/local/bin/whisper-cli',
      '/opt/homebrew/bin/main',        // whisper.cpp default binary name
      '/usr/local/bin/main',
    ];
    for (const bp of brewPaths) {
      if (fs.existsSync(bp)) return bp;
    }

    return null;
  }

  // ── Audio download ──────────────────────────────────────────

  /**
   * Download the first N seconds of audio from a URL to a temp file.
   * Returns the path to the downloaded file.
   */
  async downloadAudioChunk(audioUrl: string): Promise<string | null> {
    const tempDir = app.getPath('temp');
    const ext = path.extname(new URL(audioUrl).pathname) || '.m4a';
    const tempFile = path.join(tempDir, `howle-align-${Date.now()}${ext}`);

    try {
      return await new Promise<string | null>((resolve) => {
        const fetcher = audioUrl.startsWith('https') ? https.get : http.get;
        const file = fs.createWriteStream(tempFile);
        let bytesDownloaded = 0;
        let aborted = false;

        const req = fetcher(audioUrl, (res) => {
          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close();
            try { fs.unlinkSync(tempFile); } catch { /* noop */ }
            const redirectUrl = new URL(res.headers.location, audioUrl).toString();
            this.downloadAudioChunk(redirectUrl).then(resolve);
            return;
          }

          res.on('data', (chunk: Buffer) => {
            if (aborted) return;
            bytesDownloaded += chunk.length;
            // Stop after ~AUDIO_CHUNK_DURATION_S worth of audio
            if (bytesDownloaded > MAX_AUDIO_BYTES) {
              aborted = true;
              req.destroy();
              file.end();
              resolve(tempFile);
            } else {
              file.write(chunk);
            }
          });

          res.on('end', () => {
            if (!aborted) {
              file.end();
              resolve(bytesDownloaded > 0 ? tempFile : null);
            }
          });

          res.on('error', () => {
            file.close();
            try { fs.unlinkSync(tempFile); } catch { /* noop */ }
            resolve(null);
          });
        });

        req.on('error', () => {
          file.close();
          try { fs.unlinkSync(tempFile); } catch { /* noop */ }
          resolve(null);
        });

        // Timeout after 30s
        req.setTimeout(30000, () => {
          req.destroy();
          file.close();
          try { fs.unlinkSync(tempFile); } catch { /* noop */ }
          resolve(null);
        });
      });
    } catch (err) {
      console.error('[Alignment] Audio download failed:', err);
      try { fs.unlinkSync(tempFile); } catch { /* noop */ }
      return null;
    }
  }

  // ── Whisper transcription ───────────────────────────────────

  /**
   * Run whisper on an audio file and return transcribed segments.
   * Uses CoreML acceleration on supported Macs.
   */
  async transcribe(audioPath: string): Promise<WhisperSegment[]> {
    const binaryPath = this.findWhisperBinary();
    if (!binaryPath) {
      console.error('[Alignment] whisper-cli binary not found');
      return [];
    }

    const modelPath = this.getModelPath();
    if (!fs.existsSync(modelPath)) {
      console.error('[Alignment] Model not found at:', modelPath);
      return [];
    }

    return new Promise<WhisperSegment[]>((resolve) => {
      // Build arg list
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '--json', 'true',           // JSON output
        '--coreml', 'true',         // CoreML acceleration
        '-t', '4',                  // 4 threads
        '-ml', '1',                 // max last words (for memory efficiency)
      ];

      const child = spawn(binaryPath, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.warn(`[Alignment] whisper exited code ${code}:`, stderr.slice(0, 200));
          resolve([]);
          return;
        }

        const segments = this.parseWhisperOutput(stdout);
        if (segments.length > 0) {
          console.log(`[Alignment] Whisper returned ${segments.length} segments`);
        } else {
          console.warn('[Alignment] No segments in whisper output');
        }
        resolve(segments);
      });

      child.on('error', (err) => {
        console.error('[Alignment] Whisper spawn error:', err.message);
        resolve([]);
      });

      // Safety timeout: kill after 60s
      setTimeout(() => {
        if (child.exitCode === null) {
          child.kill();
          resolve([]);
        }
      }, 60000);
    });
  }

  /**
   * Parse whisper.cpp JSON output into segments.
   * Handles both full JSON output and streaming NDJSON formats.
   */
  private parseWhisperOutput(output: string): WhisperSegment[] {
    try {
      // Try full JSON object first (--json output)
      const parsed = JSON.parse(output);
      if (parsed && Array.isArray(parsed.segments)) {
        return parsed.segments.map((s: any) => ({
          start: s.start ?? s.t0 ?? 0,
          end: s.end ?? s.t1 ?? 0,
          text: (s.text || '').trim(),
        })).filter((s: WhisperSegment) => s.text.length > 0);
      }
      if (parsed && Array.isArray(parsed.transcription)) {
        return parsed.transcription.map((s: any) => ({
          start: s.start ?? s.t0 ?? 0,
          end: s.end ?? s.t1 ?? 0,
          text: (s.text || '').trim(),
        })).filter((s: WhisperSegment) => s.text.length > 0);
      }
    } catch {
      // Not valid JSON — try NDJSON (one JSON object per line)
      const segments: WhisperSegment[] = [];
      const lines = output.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const text = (obj.text || '').trim();
          if (text.length > 0) {
            segments.push({
              start: obj.start ?? obj.t0 ?? 0,
              end: obj.end ?? obj.t1 ?? 0,
              text,
            });
          }
        } catch { /* skip invalid lines */ }
      }
      if (segments.length > 0) return segments;
    }

    return [];
  }

  // ── Lyric matching ──────────────────────────────────────────

  /**
   * Match whisper transcript segments to plain lyrics lines.
   * Returns an array of { time, text } for each matched lyric line.
   *
   * Algorithm:
   *   1. Normalize both sides (lowercase, strip punctuation)
   *   2. For each whisper segment, find best-matching plain lyric line
   *   3. Use lookahead for robustness against split/merged segments
   *   4. Interpolate timing for unmatched lines
   */
  matchLyrics(
    segments: WhisperSegment[],
    plainLines: string[],
  ): Array<{ time: number; text: string }> {
    if (segments.length === 0 || plainLines.length === 0) return [];

    // Filter out preamble/hallucination segments
    const filteredSegments = segments.filter((seg) => {
      const lower = seg.text.toLowerCase().trim();
      return !HALLUCINATION_PREFIXES.some((p) => lower.startsWith(p) || lower === p);
    });

    if (filteredSegments.length === 0) return [];

    // Normalize a string for comparison
    const normalize = (s: string): string =>
      s.toLowerCase().replace(/[^\w\s']/g, '').replace(/\s+/g, ' ').trim();

    // Convert a Levenshtein distance to a similarity score (0–1)
    const levenshteinSimilarity = (a: string, b: string): number => {
      if (a === b) return 1;
      if (a.length === 0 || b.length === 0) return 0;

      const dist = this.levenshteinDistance(a, b);
      const maxLen = Math.max(a.length, b.length);
      return 1 - dist / maxLen;
    };

    const normLines = plainLines.map(normalize);

    // Build word-level similarity for short segments (song lyrics are short lines)
    // For each plain line, find the best matching segment
    const matched: Array<{ time: number; text: string }> = [];
    let segIdx = 0;
    let lastAssignedTime = 0;

    for (let lineIdx = 0; lineIdx < normLines.length; lineIdx++) {
      const lineText = plainLines[lineIdx];
      const normLine = normLines[lineIdx];

      if (segIdx >= filteredSegments.length) {
        // No more segments — interpolate remaining lines
        const timeGap = (plainLines.length - lineIdx) > 0
          ? Math.min(5, lastAssignedTime * 0.1)  // ~10% spacing
          : 3;
        matched.push({ time: lastAssignedTime + timeGap, text: lineText });
        lastAssignedTime += timeGap;
        continue;
      }

      // Lookahead: check this and next 2 segments for best match
      let bestScore = 0;
      let bestSegIdx = segIdx;

      for (let lookahead = segIdx; lookahead < Math.min(segIdx + 3, filteredSegments.length); lookahead++) {
        const normSegText = normalize(filteredSegments[lookahead].text);

        // Exact match (after normalization) — perfect score
        if (normSegText === normLine) {
          bestScore = 1;
          bestSegIdx = lookahead;
          break;
        }

        const score = levenshteinSimilarity(normSegText, normLine);
        if (score > bestScore) {
          bestScore = score;
          bestSegIdx = lookahead;
        }

        // Also check if the segment text CONTAINS the line
        if (normSegText.includes(normLine) || normLine.includes(normSegText)) {
          bestScore = Math.max(bestScore, 0.85);
          bestSegIdx = lookahead;
          break;
        }
      }

      if (bestScore >= 0.3) {
        // Good match — assign the segment's start time
        const time = filteredSegments[bestSegIdx].start;

        // Clamp to prevent going backward
        const clampedTime = Math.max(time, lastAssignedTime);
        matched.push({ time: clampedTime, text: lineText });
        lastAssignedTime = clampedTime + 0.5; // minimum 0.5s gap
        segIdx = bestSegIdx + 1; // consume up to matched segment
      } else {
        // No good match — interpolate timing
        // Distribute remaining time proportionally
        const nextSegTime = segIdx < filteredSegments.length
          ? filteredSegments[segIdx].start
          : lastAssignedTime + 5;
        const interpolatedTime = lastAssignedTime + (nextSegTime - lastAssignedTime) * 0.5;
        matched.push({ time: interpolatedTime, text: lineText });
        lastAssignedTime = interpolatedTime + 0.3;
      }
    }

    // If we matched fewer than half the lines, confidence is low
    const matchedCount = matched.filter((m) => m.time > 0).length;
    if (matchedCount < plainLines.length * 0.5) {
      console.warn('[Alignment] Low match rate:', matchedCount, '/', plainLines.length);
    }

    return matched;
  }

  /**
   * Compute Levenshtein distance between two strings.
   */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    // Use single row for O(n) memory
    let prev = new Uint32Array(n + 1);
    let curr = new Uint32Array(n + 1);

    for (let j = 0; j <= n; j++) prev[j] = j;

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,       // deletion
          curr[j - 1] + 1,   // insertion
          prev[j - 1] + cost, // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  // ── LRC generation ──────────────────────────────────────────

  /** Build an LRC string from matched lyric timings. */
  generateLRC(matched: Array<{ time: number; text: string }>): string {
    return matched
      .map(({ time, text }) => {
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        const ms = Math.round((time - Math.floor(time)) * 100);
        const mm = String(min).padStart(2, '0');
        const ss = String(sec).padStart(2, '0');
        const cc = String(ms).padStart(2, '0');
        return `[${mm}:${ss}.${cc}]${text}`;
      })
      .join('\n');
  }

  /** Parse LRC to count lines for validation. */
  countLrcLines(lrc: string): number {
    return lrc.split('\n').filter((l) => l.startsWith('[')).length;
  }

  // ── Confidence scoring ──────────────────────────────────────

  /**
   * Calculate a confidence score for the alignment.
   * Factors:
   *   - Proportion of plain lines matched to segments
   *   - Average segment similarity score
   *   - Coverage: how much of the audio was mapped to lyrics
   */
  calculateConfidence(
    matched: Array<{ time: number; text: string }>,
    plainLines: string[],
    segments: WhisperSegment[],
  ): number {
    if (plainLines.length === 0 || matched.length === 0) return 0;

    // Ratio of matched lines to total
    const matchedRatio = matched.length / plainLines.length;
    if (matchedRatio < 0.5) return matchedRatio * 0.3; // penalize low match rates

    // Segment coverage: what portion of segments were assigned
    const segCoverage = segments.length > 0
      ? Math.min(1, matched.length / segments.length)
      : 0;

    // Timing reasonableness: matched lines should span a reasonable duration
    const lastTime = matched[matched.length - 1]?.time ?? 0;
    const firstTime = matched[0]?.time ?? 0;
    const span = lastTime - firstTime;
    const expectedSpan = Math.min(AUDIO_CHUNK_DURATION_S, span + 10);
    const spanScore = span > 0 ? Math.min(1, span / expectedSpan) : 0;

    // Combined score
    const confidence = matchedRatio * 0.5 + segCoverage * 0.25 + spanScore * 0.25;
    return Math.max(0, Math.min(1, confidence));
  }

  // ── Main alignment API ──────────────────────────────────────

  /**
   * Run the full alignment pipeline.
   *
   * @param videoId   - YouTube video ID (for cache lookup)
   * @param audioUrl  - Downloadable audio URL (local proxy or direct)
   * @param plainLyrics - Array of plain lyric lines (no timestamps)
   * @returns AlignmentResult with generated LRC
   */
  async align(
    videoId: string,
    audioUrl: string,
    plainLyrics: string[],
  ): Promise<AlignmentResult> {
    // ── 1. Check cache ────────────────────────────────────────
    const cached = getAlignedLyrics(videoId);
    if (cached && cached.lrc.length > 0) {
      console.log(`[Alignment] Cache hit for ${videoId} (confidence: ${cached.confidence})`);
      return {
        lrc: cached.lrc,
        confidence: cached.confidence,
        processedDuration: 0,
        fromCache: true,
      };
    }

    // ── 2. Ensure model is downloaded ─────────────────────────
    if (!this.isModelDownloaded()) {
      const ok = await this.downloadModel();
      if (!ok) {
        console.error('[Alignment] Failed to download model');
        return { lrc: '', confidence: 0, processedDuration: 0, fromCache: false };
      }
    }

    // ── 3. Download audio chunk ───────────────────────────────
    console.log(`[Alignment] Downloading audio for ${videoId}...`);
    const audioPath = await this.downloadAudioChunk(audioUrl);
    if (!audioPath) {
      console.error('[Alignment] Failed to download audio');
      return { lrc: '', confidence: 0, processedDuration: 0, fromCache: false };
    }

    // ── 4. Transcribe with Whisper ────────────────────────────
    console.log(`[Alignment] Transcribing ${audioPath}...`);
    const segments = await this.transcribe(audioPath);

    // Clean up temp file
    try { fs.unlinkSync(audioPath); } catch { /* noop */ }

    if (segments.length === 0) {
      console.error('[Alignment] Whisper returned no segments');
      return { lrc: '', confidence: 0, processedDuration: 0, fromCache: false };
    }

    // ── 5. Match segments to plain lyrics ─────────────────────
    console.log(`[Alignment] Matching ${segments.length} segments to ${plainLyrics.length} lines...`);
    const matched = this.matchLyrics(segments, plainLyrics);

    if (matched.length === 0) {
      console.error('[Alignment] No matching between segments and lyrics');
      return { lrc: '', confidence: 0, processedDuration: 0, fromCache: false };
    }

    // ── 6. Generate LRC ───────────────────────────────────────
    const lrc = this.generateLRC(matched);

    // ── 7. Score confidence ───────────────────────────────────
    const confidence = this.calculateConfidence(matched, plainLyrics, segments);

    // ── 8. Cache result ───────────────────────────────────────
    if (confidence >= MIN_CONFIDENCE) {
      setAlignedLyrics(videoId, lrc, confidence);
      console.log(`[Alignment] Cached LRC for ${videoId} (confidence: ${confidence.toFixed(2)})`);
    }

    // Compute processed duration from the audio
    const processedDuration = segments.length > 0
      ? segments[segments.length - 1].end
      : 0;

    return { lrc, confidence, processedDuration, fromCache: false };
  }

  /** Check if whisper binary and model are both available. */
  isReady(): boolean {
    return this.findWhisperBinary() !== null && this.isModelDownloaded();
  }

  /** Get detailed status for the renderer. */
  getStatus() {
    return {
      modelDownloaded: this.isModelDownloaded(),
      binaryFound: this.findWhisperBinary() !== null,
      modelPath: this.modelPath,
      binaryPath: this.findWhisperBinary(),
    };
  }
}

/** Singleton instance. */
export const alignmentEngine = new AlignmentEngine();
