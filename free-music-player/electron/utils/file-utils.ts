import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get the default downloads path for music files.
 */
export function getDownloadsPath(): string {
  const downloadsPath = path.join(app.getPath('music'), 'FreeMusicPlayer', 'downloads');
  ensureDirectoryExists(downloadsPath);
  return downloadsPath;
}

/**
 * Get the application cache path.
 */
export function getCachePath(): string {
  const cachePath = path.join(app.getPath('userData'), 'Cache', 'FreeMusicPlayer');
  ensureDirectoryExists(cachePath);
  return cachePath;
}

/**
 * Format a duration in seconds to mm:ss or h:mm:ss.
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const sStr = s.toString().padStart(2, '0');

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sStr}`;
  }
  return `${m}:${sStr}`;
}

/**
 * Sanitize a filename by removing invalid characters.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}
