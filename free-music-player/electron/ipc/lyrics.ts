import { ipcMain } from 'electron';
import { getLyrics } from '../services/lyrics';

export function registerLyricsHandlers(): void {
  ipcMain.handle(
    'lyrics:getLyrics',
    async (_event, track: string, artist: string, album?: string, duration?: number) => {
      try {
        return await getLyrics(track, artist, album, duration);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to get lyrics: ${message}`);
      }
    },
  );
}
