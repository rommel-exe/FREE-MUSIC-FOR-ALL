/** Deterministic hue from any string ID */
function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

/** Rich CSS gradient for thumbnail placeholders — two-tone from deterministic hue */
export function thumbGradient(id: string): string {
  const hue = hashHue(id);
  return `linear-gradient(135deg, hsl(${hue}, 40%, 22%), hsl(${(hue + 40) % 360}, 35%, 30%))`;
}

/** Solid color variant for simpler cases */
export function thumbColor(id: string): string {
  return `hsl(${hashHue(id)}, 35%, 22%)`;
}

/** First letter or fallback symbol */
export function thumbLetter(name?: string): string {
  return (name?.trim().charAt(0) || '♪').toUpperCase();
}
