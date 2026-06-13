/**
 * TitleEngine — composite title-similarity scoring for track matching.
 *
 * Compares a local title against a candidate title using five
 * sub-algorithms blended into a single 0–100 score.
 */

// ── Types ────────────────────────────────────────────────────────

// No special imports needed from types.ts for this module.

// ── Normalization helpers ────────────────────────────────────────

/** Lowercase, strip parenthesized content, collapse whitespace. */
export function normalizeForTitleComparison(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')   // strip (…)
    .replace(/\[[^\]]*\]/g, '')  // strip […]
    .replace(/\{[^}]*\}/g, '')   // strip {…}
    .replace(/[^\w\s]/g, ' ')    // punctuation → space
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim();
}

/** Split on whitespace, filter empties, lowercase. */
export function tokenizeForComparison(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

// ── 1. Token Match ──────────────────────────────────────────────

/**
 * For each local token, check whether it appears (as a substring)
 * inside any candidate token. Score = matched / total local tokens.
 */
export function tokenMatchScore(localTokens: string[], candidateTokens: string[]): number {
  if (!localTokens.length || !candidateTokens.length) return 0;

  const candidateJoined = candidateTokens.join(' ');
  let matched = 0;

  for (const token of localTokens) {
    if (!token) continue;
    if (candidateJoined.includes(token)) {
      matched++;
    }
  }

  return (matched / localTokens.length) * 100;
}

// ── 2. Levenshtein ──────────────────────────────────────────────

/**
 * Normalised Levenshtein similarity.
 * Returns 0 when either string is ≤ 3 chars.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a.length <= 3 || b.length <= 3) return 0;

  const lenA = a.length;
  const lenB = b.length;

  // DP row (two-row optimisation)
  let prev = new Array<number>(lenB + 1);
  let curr = new Array<number>(lenB + 1);

  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[lenB];
  const maxLen = Math.max(lenA, lenB);
  return ((1 - distance / maxLen) * 100);
}

// ── 3. Jaccard ──────────────────────────────────────────────────

/**
 * Jaccard coefficient on word-level token sets.
 */
export function jaccardSimilarity(localTokens: string[], candidateTokens: string[]): number {
  if (!localTokens.length || !candidateTokens.length) return 0;

  const setA = new Set(localTokens);
  const setB = new Set(candidateTokens);

  let intersectionSize = 0;
  for (const t of setA) {
    if (setB.has(t)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0;

  return (intersectionSize / unionSize) * 100;
}

// ── 4. Dice Coefficient ────────────────────────────────────────

/** Return the set of character bigrams for a string. */
function bigrams(s: string): string[] {
  const bags: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    bags.push(s.substring(i, i + 2));
  }
  return bags;
}

/**
 * Sørensen–Dice coefficient on character bigrams.
 */
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const bgA = bigrams(a);
  const bgB = bigrams(b);

  if (!bgA.length || !bgB.length) return 0;

  // Build frequency map for B
  const freqB = new Map<string, number>();
  for (const bg of bgB) {
    freqB.set(bg, (freqB.get(bg) ?? 0) + 1);
  }

  let intersectionSize = 0;
  for (const bg of bgA) {
    const count = freqB.get(bg);
    if (count && count > 0) {
      intersectionSize++;
      freqB.set(bg, count - 1);
    }
  }

  return (2 * intersectionSize) / (bgA.length + bgB.length) * 100;
}

// ── 5. Word Position Analysis ───────────────────────────────────

/**
 * Check whether local words appear in the candidate in the same
 * relative order. Short queries (< 5 words) require every word.
 * Longer queries allow a 1-word skip.
 */
export function wordPositionScore(localTokens: string[], candidateTokens: string[]): number {
  if (!localTokens.length || !candidateTokens.length) return 0;

  const allowSkip = localTokens.length >= 5;

  let candidateIdx = 0;

  for (let i = 0; i < localTokens.length; i++) {
    const word = localTokens[i];
    let found = false;

    while (candidateIdx < candidateTokens.length) {
      if (candidateTokens[candidateIdx] === word) {
        candidateIdx++;
        found = true;
        break;
      }
      candidateIdx++;
    }

    if (!found) {
      if (allowSkip) {
        // Allow skip — try next candidate position without advancing
        // but we still need the rest of the words to appear
        continue;
      }
      return 0;
    }
  }

  return 100;
}

// ── Composite Engine ────────────────────────────────────────────

/** Weight map for composite scoring. */
const WEIGHTS = {
  tokenMatch: 0.50,
  levenshtein: 0.20,
  jaccard: 0.15,
  dice: 0.10,
  wordPosition: 0.05,
} as const;

export class TitleEngine {
  /**
   * Full composite score between two raw title strings.
   * Normalises inputs, runs all sub-algorithms, and returns 0–100.
   */
  score(localTitle: string, candidateTitle: string): number {
    const normLocal = normalizeForTitleComparison(localTitle);
    const normCandidate = normalizeForTitleComparison(candidateTitle);

    const localTokens = tokenizeForComparison(normLocal);
    const candidateTokens = tokenizeForComparison(normCandidate);

    return this.scoreTokenized(localTokens, candidateTokens);
  }

  /**
   * Composite score from pre-tokenised arrays.
   * Short-circuits to 0 when token match is 0.
   */
  scoreTokenized(localTokens: string[], candidateTokens: string[]): number {
    const tokenScore = tokenMatchScore(localTokens, candidateTokens);

    // Short-circuit: no words in common → 0
    if (tokenScore === 0) return 0;

    // Join tokens back into strings for character-level algorithms
    const localStr = localTokens.join('');
    const candidateStr = candidateTokens.join('');

    const levScore = levenshteinSimilarity(localStr, candidateStr);
    const jacScore = jaccardSimilarity(localTokens, candidateTokens);
    const diceScore = diceSimilarity(localStr, candidateStr);
    const posScore = wordPositionScore(localTokens, candidateTokens);

    const composite =
      tokenScore   * WEIGHTS.tokenMatch +
      levScore     * WEIGHTS.levenshtein +
      jacScore     * WEIGHTS.jaccard +
      diceScore    * WEIGHTS.dice +
      posScore     * WEIGHTS.wordPosition;

    return Math.min(100, Math.max(0, Math.round(composite)));
  }
}
