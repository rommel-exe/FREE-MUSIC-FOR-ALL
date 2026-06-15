import type { TrackInput, NormalizedTrack } from './types';
import { emitTrace } from '../utils/trace';

// ── Pure Helper Functions ─────────────────────────────────────────

/** Lowercase the input string. */
export function lowercase(text: string): string {
  return text.toLowerCase();
}

/**
 * Remove punctuation while preserving:
 * - hyphens between word characters (e.g. "AC/DC", "E-40")
 * - slashes (e.g. "AC/DC")
 * - digits (e.g. "U2")
 *
 * Preserves CJK characters (already handled by the regex not matching them).
 */
export function removePunctuation(text: string): string {
  // Remove anything that is NOT:
  // - a word character (letters, digits, underscore)
  // - whitespace
  // - hyphen (but only between word chars — we'll handle that via preservation)
  // - slash (for AC/DC style names)
  //
  // Strategy: remove all punctuation characters except slash, then
  // keep hyphens that are surrounded by word characters on both sides.
  let result = text;

  // Remove common punctuation but keep: alphanumerics, whitespace, hyphens, slashes
  // This regex strips: !"'()*+,./:;<=>?@[\]_`{|}~  and other symbols
  // We preserve: word chars (\w), whitespace (\s), hyphen (-), slash (/)
  result = result.replace(/[^\w\s\-/]/g, ' ');

  // Now remove hyphens that are NOT between two word characters
  // (e.g. leading/trailing hyphens, double hyphens)
  // Keep: "E-40", "co-op" — Remove: "-hello", "hello-", "--"
  result = result.replace(/(?<![a-zA-Z0-9])-(?=[a-zA-Z0-9])/g, ' ');  // leading hyphen: "-40" → " 40"
  result = result.replace(/(?<=[a-zA-Z0-9])-(?![a-zA-Z0-9])/g, ' ');  // trailing hyphen: "e-" → "e "
  result = result.replace(/--/g, ' ');                                   // double hyphen

  // Remove standalone slashes (not between letters like "AC/DC")
  // Keep: "AC/DC", "P!nk" → "/" between letters stays
  // Remove: "/" at start/end or standalone
  result = result.replace(/(?<![a-zA-Z])\/(?![a-zA-Z])/g, ' ');
  result = result.replace(/(?<![a-zA-Z0-9])\/|\/(?![a-zA-Z0-9])/g, ' ');

  // Collapse multiple spaces
  result = result.replace(/\s{2,}/g, ' ');

  return result.trim();
}

/** Normalize unicode to NFKC form. */
export function normalizeUnicode(text: string): string {
  return text.normalize('NFKC');
}

/** Normalize feat./ft./featuring to a standard "feat" token. */
export function normalizeFeat(text: string): string {
  // Match "feat.", "ft.", "featuring" as standalone words (case-insensitive)
  // Replace with standardized "feat" for matching purposes
  return text.replace(/\b(?:feat\.?|ft\.?|featuring)\b/gi, 'feat');
}

/** Normalize "&" to "and". */
export function normalizeAmpersand(text: string): string {
  return text.replace(/&/g, ' and ');
}

/**
 * Remove parenthesized and bracketed noise patterns from the text.
 * Handles both `(...)` and `[...]` including nested brackets.
 * The entire bracketed content is removed (including the delimiters).
 *
 * This runs iteratively to handle nested brackets.
 */
export function stripNoiseWords(text: string): string {
  const noisePatterns = new Set([
    // Video/audio descriptors
    'official video',
    'official music video',
    'official audio',
    'official',
    'audio',
    'video',
    'music video',
    'lyric video',
    'lyrics video',

    // Quality
    'hd',
    '4k',
    '8k',
    'uhd',
    'fhd',
    'sd',

    // Licensing / versioning
    'explicit',
    'clean',
    'edited',
    'censored',

    // Version type
    'album version',
    'album track',
    'radio edit',
    'single',
    'edit',
    'extended mix',
    'extended',
    'deluxe',
    'bonus track',
    'bonus',

    // Format / tech
    '360ra',
    '360 reality audio',
    '360° audio',
    '360 audio',
    'dolby atmos',
    'spatial audio',
    'immersive audio',

    // Visual
    'visualizer',
    'visualiser',

    // Lyrics
    'with lyrics',
    'lyrics',

    // Version labels with size
    '4k version',
    'hd version',
    'uhd version',

    // Tempo/mood variants
    'nightcore',
    'slowed',
    'sped up',
    'slowed and reverb',
    'reverb',

    // Covers / performances
    'live',
    'acoustic',
    'unplugged',
    'session',
    'cover',
    'karaoke',
    'instrumental',
    'remix',

    // Topic channels (artist - topic)
    'topic',
    'vevo',
  ]);

  let result = text;
  let changed = true;

  // Iterate to handle nested brackets: (( ... [ ... ] ... ))
  while (changed) {
    changed = false;

    // Match parentheses and brackets (including nested)
    result = result.replace(/(\([^()]*\)|\[[^\[\]]*\])/g, (match) => {
      // Strip the delimiters to get inner content
      const inner = match.slice(1, -1).trim().toLowerCase();

      // Check if the inner content (or any part of it) matches a noise pattern
      if (noisePatterns.has(inner)) {
        changed = true;
        return ' ';
      }

      // Keep "remastered" — it's useful version info, not noise
      if (inner.startsWith('remastered')) {
        return match;
      }

      // Check multi-word noise: split and check if ALL words are noise words
      // or the full string matches
      const words = inner.split(/\s+/);
      const allNoise = words.every((w) => noisePatterns.has(w));
      if (allNoise && words.length > 0) {
        changed = true;
        return ' ';
      }

      // Check if any individual noise pattern is a substring
      for (const pattern of noisePatterns) {
        if (inner.includes(pattern)) {
          changed = true;
          return ' ';
        }
      }

      // Keep the content — it's not noise, it's part of the title
      return match;
    });
  }

  // Clean up remaining whitespace
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * Strip common dash-separated suffixes from titles/artists.
 * Handles patterns like "Title - Single", "Title - Edit", "Title - Radio Edit".
 *
 * These typically appear as " - <type>" at the end of a string and should be
 * stripped during normalization.
 */
export function stripSuffixes(text: string): string {
  const suffixPatterns = [
    // Dash-separated suffixes (order matters: longest first)
    /\s+-\s+radio edit$/i,
    /\s+-\s+extended mix$/i,
    /\s+-\s+album version$/i,
    /\s+-\s+album track$/i,
    /\s+-\s+bonus track$/i,
    /\s+-\s+deluxe edition$/i,
    /\s+-\s+single$/i,
    /\s+-\s+edit$/i,
    /\s+-\s+extended$/i,
    /\s+-\s+explicit$/i,
    /\s+-\s+clean$/i,
    /\s+-\s+deluxe$/i,
    /\s+-\s+bonus$/i,
    /\s+-\s+remix$/i,
    /\s+-\s+live$/i,
    /\s+-\s+acoustic$/i,
    /\s+-\s+instrumental$/i,
    /\s+-\s+karaoke$/i,
    /\s+-\s+remastered$/i,
    /\s+-\s+remaster$/i,
    /\s+-\s+version$/i,
    /\s+-\s+visualizer$/i,
    /\s+-\s+nightcore$/i,
    /\s+-\s+slowed$/i,
    /\s+-\s+sped up$/i,
    /\s+-\s+sped.up$/i,
    /\s+-\s+topic$/i,
    /\s+-\s+vevo$/i,
  ];

  let result = text;
  for (const pattern of suffixPatterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

/**
 * Strip " - topic" / " - vevo" style channel suffixes.
 * These come from YouTube topic/vevo channels in search results.
 */
export function stripTopicSuffix(text: string): string {
  return text.replace(/\s*[-–—]\s*(topic|vevo)\s*$/i, '');
}

/** Split text into word tokens, filtering out empty strings. */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// ── Full Normalization Pipelines ──────────────────────────────────

/**
 * Normalize an artist name to canonical form.
 *
 * Pipeline:
 * 1. NFKC unicode normalization
 * 2. Lowercase
 * 3. Normalize "&" → "and"
 * 4. Normalize feat./ft./featuring → "feat"
 * 5. Strip parenthesized/bracketed noise
 * 6. Strip dash-separated suffixes (e.g. " - Topic")
 * 7. Remove punctuation (preserving meaningful hyphens, slashes)
 * 8. Collapse whitespace and trim
 */
export function normalizeArtist(artist: string): string {
  let result = artist;
  result = normalizeUnicode(result);
  result = lowercase(result);
  result = normalizeAmpersand(result);
  result = normalizeFeat(result);
  result = stripNoiseWords(result);
  result = stripTopicSuffix(result);
  result = stripSuffixes(result);
  result = removePunctuation(result);
  result = result.replace(/\s{2,}/g, ' ').trim();
  return result;
}

/**
 * Normalize a track title to canonical form.
 *
 * Same pipeline as artist normalization.
 */
export function normalizeTitle(title: string): string {
  let result = title;
  result = normalizeUnicode(result);
  result = lowercase(result);
  result = normalizeAmpersand(result);
  result = normalizeFeat(result);
  result = stripNoiseWords(result);
  result = stripSuffixes(result);
  result = removePunctuation(result);
  result = result.replace(/\s{2,}/g, ' ').trim();
  return result;
}

// ── MetadataNormalizer Class ──────────────────────────────────────

/**
 * Transforms messy, inconsistent metadata into canonical form suitable
 * for fingerprinting and fuzzy matching.
 *
 * @example
 * ```ts
 * const normalizer = new MetadataNormalizer();
 * const result = normalizer.normalize({
 *   title: 'Numb (Official Video)',
 *   artist: 'Linkin Park',
 *   duration: 188,
 * });
 * // result.titleCanonical === 'numb'
 * // result.artistCanonical === 'linkin park'
 * ```
 */
export class MetadataNormalizer {
  normalize(input: TrackInput): NormalizedTrack {
    emitTrace(input.title, input.artist, 'NORMALIZE_BEFORE');

    const titleCanonical = normalizeTitle(input.title);
    const artistCanonical = normalizeArtist(input.artist);
    const albumCanonical = input.album ? normalizeTitle(input.album) : undefined;

    emitTrace(input.title, input.artist, 'NORMALIZE_AFTER', {
      normalizedTitle: titleCanonical,
      normalizedArtist: artistCanonical,
    });

    return {
      titleCanonical,
      artistCanonical,
      titleTokens: tokenize(titleCanonical),
      artistTokens: tokenize(artistCanonical),
      albumCanonical,
      duration: input.duration,
      source: input.source,
    };
  }
}
