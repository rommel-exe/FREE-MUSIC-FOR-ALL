// ── Artist Engine ────────────────────────────────────────────────
// Specialized artist matching — aliases, featured artists,
// ordering differences, and punctuation variations.
// ─────────────────────────────────────────────────────────────────

// ── Alias Database ──────────────────────────────────────────────

/** Canonical name → known variations (all lowercase). */
export const ARTIST_ALIASES: Record<string, string[]> = {
  // ── Classic Rock / Rock ──
  'led zeppelin': ['led zeplin', 'zeppelin', 'led zeppelin official'],
  'guns n roses': ['guns and roses', "guns n' roses", 'gnr', 'guns n\' roses official'],
  'pink floyd': ['pink floyd official', 'pink floyd – topic'],
  'queen': ['queen official', 'queen – topic'],
  'the rolling stones': ['rolling stones', 'rolling stones official'],
  'eagles': ['the eagles', 'eagles official'],
  'fleetwood mac': ['fleetwood mac official'],
  'journey': ['journey official'],
  'bon jovi': ['bon jovi official'],
  'def leppard': ['def leppard official'],
  'the doors': ['doors', 'the doors official'],
  'the white stripes': ['white stripes', 'white stripes official'],
  'foo fighters': ['foo fighters official'],
  'green day': ['green day official'],
  'nirvana': ['nirvana official'],
  'metallica': ['metallica official', 'metallika'],
  'aerosmith': ['aero smith', 'aerosmith official'],
  'red hot chili peppers': ['red hot chili peppers official', 'rhcp'],
  'linkin park': ['linkin park official'],
  'system of a down': ['system of a down official', 'soad'],
  'slipknot': ['slipknot official'],
  'tool': ['tool official'],
  'radiohead': ['radiohead official'],
  'coldplay': ['coldplay official'],
  'u2': ['u2 official'],

  // ── Metal ──
  'motley crue': ['mötley crüe', 'motley crue official', 'mötley crüe official'],
  'iron maiden': ['iron maiden official'],
  'black sabbath': ['black sabbath official', 'sabbath'],
  'judas priest': ['judas priest official'],
  'megadeth': ['megadeth official', 'megadeth – topic'],
  'pantera': ['pantera official'],
  'randy rhoads': ['randy rhoads official'],

  // ── Pop / Modern ──
  'taylor swift': ['taylor swift official'],
  'ed sheeran': ['ed sheeran official'],
  'beyoncé': ['beyonce', 'beyoncé official', 'beyonce official'],
  'lady gaga': ['lady gaga official', 'stefani germanotta'],
  'billie eilish': ['billie eilish official'],
  'post malone': ['post malone official'],
  'ariana grande': ['ariana grande official'],
  'drake': ['drake official'],
  'kanye west': ['kanye west official', 'ye'],
  'eminem': ['eminem official', 'marshall mathers', 'slim shady', 'eminem – topic'],
  'rihanna': ['rihanna official'],
  'adele': ['adele official'],
  'bruno mars': ['bruno mars official'],
  'katy perry': ['katy perry official'],

  // ── R&B / Soul / Hip-Hop ──
  'the weeknd': ['weeknd', 'abel tesfaye', 'the weeknd official'],
  'sza': ['sza official'],
  'frank ocean': ['frank ocean official'],
  'kendrick lamar': ['kendrick lamar official', 'kendrick'],
  'j cole': ['j. cole', 'j cole official', 'jermaine cole'],
  'travis scott': ['travis scott official'],
  'migos': ['migos official'],
  'cardi b': ['cardi b official'],
  'nicki minaj': ['nicki minaj official'],

  // ── Band Names / Alternative ──
  'the beatles': ['beatles', 'the beatles official'],
  'the who': ['who', 'the who official'],
  'the stooges': ['stooges', 'iggy and the stooges'],
  'the cure': ['cure', 'the cure official'],
  'the kinks': ['kinks', 'the kinks official'],

  // ── Country / Folk ──
  'johnny cash': ['johnny cash official'],
  'bob marley': ['bob marley official', 'bob marley & the wailers', 'bob marley and the wailers'],
  'willie nelson': ['willie nelson official'],

  // ── Legends ──
  'elvis presley': ['elvis presley official', 'elvis'],
  'michael jackson': ['michael jackson official', 'mj'],
  'prince': ['prince official'],
  'madonna': ['madonna official'],
  'david bowie': ['david bowie official', 'bowie'],
  'jimi hendrix': ['jimi hendrix official'],

  // ── Synthwave / Niche ──
  'gunship': ['gunship official'],
  'the midnight': ['midnight', 'the midnight official'],
  'timecop1983': ['timecop1983 official'],
  'fm-84': ['fm84', 'fm-84 official'],

  // ── AC/DC special handling ──
  'ac/dc': ['acdc', 'ac dc', 'ac/dc official'],
};

// Build reverse lookup: alias (normalized) → canonical name
const ALIAS_LOOKUP: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(ARTIST_ALIASES)) {
  ALIAS_LOOKUP.set(canonical, canonical);
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(alias, canonical);
  }
}

// ── Normalization ───────────────────────────────────────────────

/**
 * Strip common artist suffixes/prefixes and normalize for comparison.
 * Pure function — no side effects.
 */
export function normalizeForArtistComparison(artist: string): string {
  let s = artist.toLowerCase().trim();

  // Strip parenthetical content: "(official)", "(VEVO)", "[official video]" etc.
  s = s.replace(/[\(\[\{][^)\]\}]*[\)\]\}]/g, '');

  // Strip " - Topic" suffix (YouTube auto-generated channel suffix)
  s = s.replace(/\s*-\s*topic$/i, '');

  // Strip "feat.", "ft.", "featuring" and everything after
  s = s.replace(/\s+(feat\.?|ft\.?|featuring)\b.*$/i, '');

  // Normalize unicode diacritics (Mötley → motley, Beyoncé → beyonce)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Normalize "&" → "and" before removing punctuation
  s = s.replace(/&/g, 'and');

  // Remove "the " prefix (but only when it's a standalone prefix)
  s = s.replace(/^the\s+/, '');

  // Remove punctuation EXCEPT "/" (meaningful for AC/DC) and "-" (for fm-84)
  s = s.replace(/[^\w\s/\-]/g, '');

  // Normalize slashes with surrounding spaces: "AC / DC" → "AC/DC"
  s = s.replace(/\s*\/\s*/g, '/');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

// ── Utility Functions ───────────────────────────────────────────

/**
 * Look up whether an artist string is an alias for a known canonical name.
 * Returns the canonical name if found, undefined otherwise.
 */
export function findAlias(artist: string): string | undefined {
  const normalized = normalizeForArtistComparison(artist);
  return ALIAS_LOOKUP.get(normalized);
}

/**
 * Jaccard similarity between two sets of words.
 * Returns a value between 0 (no overlap) and 1 (identical sets).
 */
export function jaccardArtistSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeForArtistComparison(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalizeForArtistComparison(b).split(/\s+/).filter(Boolean));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) intersection++;
  });

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── ArtistEngine Class ──────────────────────────────────────────

export class ArtistEngine {
  /**
   * Score how well two artist strings match.
   * Returns 0–100.
   */
  score(localArtist: string, candidateArtist: string): number {
    const localNorm = normalizeForArtistComparison(localArtist);
    const candidateNorm = normalizeForArtistComparison(candidateArtist);

    // 0. Empty inputs
    if (!localNorm && !candidateNorm) return 100;
    if (!localNorm || !candidateNorm) return 0;

    // 1. Exact match → 100
    if (localNorm === candidateNorm) return 100;

    // 2. Alias match → 85
    const localCanonical = findAlias(localArtist);
    const candidateCanonical = findAlias(candidateArtist);
    if (localCanonical && candidateCanonical && localCanonical === candidateCanonical) {
      return 85;
    }
    // Also check if normalized form matches a canonical name via aliases
    if (localCanonical && candidateNorm === localCanonical) return 85;
    if (candidateCanonical && localNorm === candidateCanonical) return 85;

    // 3. One contains the other → 90
    //    (e.g., "Eminem" is contained in "Eminem feat. Rihanna")
    if (localNorm.length <= candidateNorm.length) {
      if (candidateNorm.includes(localNorm)) return 90;
    }
    if (candidateNorm.length <= localNorm.length) {
      if (localNorm.includes(candidateNorm)) return 90;
    }

    // 4. Every word from local appears in candidate → 80
    const localWords = localNorm.split(/\s+/).filter(Boolean);
    const candidateWords = candidateNorm.split(/\s+/).filter(Boolean);
    if (localWords.length > 0 && localWords.every((w) => candidateWords.includes(w))) {
      return 80;
    }
    if (candidateWords.length > 0 && candidateWords.every((w) => localWords.includes(w))) {
      return 80;
    }

    // 5. Jaccard similarity > 0.5 → 70
    const jaccard = jaccardArtistSimilarity(localArtist, candidateArtist);
    if (jaccard > 0.5) return 70;

    // 6. No match → 0
    return 0;
  }

  /**
   * Check if localArtist appears within candidateArtist.
   * Used by VerificationEngine for safety checks.
   */
  containsArtist(localArtist: string, candidateArtist: string): boolean {
    const localNorm = normalizeForArtistComparison(localArtist);
    const candidateNorm = normalizeForArtistComparison(candidateArtist);

    if (!localNorm) return false;

    // Direct substring containment
    if (candidateNorm.includes(localNorm)) return true;

    // Check alias containment
    const localCanonical = findAlias(localArtist);
    if (localCanonical && candidateNorm.includes(localCanonical)) return true;

    const candidateCanonical = findAlias(candidateArtist);
    if (candidateCanonical && localNorm.includes(candidateCanonical)) return true;

    // Check if all local words appear in candidate (order-independent)
    const localWords = localNorm.split(/\s+/).filter(Boolean);
    const candidateWords = candidateNorm.split(/\s+/).filter(Boolean);
    return localWords.length > 0 && localWords.every((w) => candidateWords.includes(w));
  }
}
