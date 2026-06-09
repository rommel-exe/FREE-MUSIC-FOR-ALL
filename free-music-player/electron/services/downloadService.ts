/**
 * DownloadService — Download YouTube audio for offline playback.
 *
 * Uses yt-dlp to download the best audio quality and saves it to the app's
 * userData directory. Integrates with the track library so downloaded songs
 * play from the local file instead of streaming.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
import {
  getTrackById,
  addTrack,
  updateTrack,
  getDownloadedFilePath,
  hasCompletedDownload,
  createDownload,
  updateDownloadProgress,
  completeDownload,
  failDownload,
  deleteDownloadRecord,
  getDownloadsForTrack,
} from '../utils/database';

const execFileAsync = promisify(execFile);

const YTDLP_PATH =
  '/Library/Frameworks/Python.framework/Versions/3.12/bin/yt-dlp';

/** Callback for progress updates (0.0 to 1.0). Also receives the download DB id. */
export type DownloadProgressCallback = (progress: number, downloadId?: number) => void;

class DownloadService {
  /** Active download tasks: downloadId -> AbortController */
  private activeDownloads = new Map<number, AbortController>();
  /** Track ID -> downloadId mapping for cancel-by-trackId */
  private trackToDownloadId = new Map<string, number>();

  /**
   * Get the directory where downloaded audio files are stored.
   */
  private getDownloadDir(): string {
    const dir = path.join(app.getPath('userData'), 'downloads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Generate a safe file path for a downloaded track.
   */
  private getFilePath(videoId: string, ext: string): string {
    return path.join(this.getDownloadDir(), `${videoId}.${ext}`);
  }

  /**
   * Download a track's audio using yt-dlp.
   *
   * @param track - Track object with videoId, title, artist, duration
   * @param onProgress - Optional callback for download progress (0-1)
   * @returns The local file path on success
   */
  async downloadTrack(
    track: {
      id: string;
      youtubeId: string;
      title: string;
      artist: string;
      album?: string;
      duration: number;
      thumbnail?: string;
      source?: string;
    },
    onProgress?: DownloadProgressCallback,
  ): Promise<string> {
    const { youtubeId, id: trackId } = track;

    // Check if already downloaded
    const existingPath = getDownloadedFilePath(trackId);
    if (existingPath && fs.existsSync(existingPath)) {
      console.log(`[DownloadService] Track ${trackId} already downloaded at ${existingPath}`);
      return existingPath;
    }

    // Ensure the track exists in the library BEFORE creating the download
    // record (foreign key constraint: downloads.track_id → tracks.id).
    let existing = getTrackById(trackId);
    if (!existing) {
      addTrack({
        id: trackId,
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        duration: track.duration,
        thumbnail: track.thumbnail || '',
        youtube_id: youtubeId,
        source: 'local',
        path: '',
        play_count: 0,
      });
    }

    // Create the download record
    const dlId = createDownload({
      trackId,
      videoId: youtubeId,
      title: track.title,
      artist: track.artist,
      filePath: '',
      fileSize: 0,
      status: 'downloading',
      progress: 0,
      error: '',
    });

    const abortController = new AbortController();
    this.activeDownloads.set(dlId, abortController);
    this.trackToDownloadId.set(trackId, dlId);
    onProgress?.(0, dlId);

    try {

      // Download with yt-dlp using best audio quality
      const outputTemplate = path.join(this.getDownloadDir(), '%(id)s.%(ext)s');

      // First, probe to find the best audio extension
      const { stdout: probeOut } = await execFileAsync(
        YTDLP_PATH,
        [
          '-f', 'bestaudio[ext=m4a][abr>64]/bestaudio[abr>64]/bestaudio',
          '--print', 'ext',
          '--no-warnings',
          `https://www.youtube.com/watch?v=${youtubeId}`,
        ],
        { timeout: 15_000, signal: abortController.signal },
      );

      const ext = probeOut.trim().split('\n')[0] || 'm4a';

      // Download the audio file
      const args = [
        '-f', 'bestaudio[ext=m4a][abr>64]/bestaudio[abr>64]/bestaudio',
        '--extract-audio',
        '--audio-format', ext === 'webm' ? 'opus' : ext,
        '--audio-quality', '0', // best quality
        '-o', outputTemplate,
        '--no-warnings',
        '--no-playlist',
        '--print', 'after_move:filename', // print the final file path
        `https://www.youtube.com/watch?v=${youtubeId}`,
      ];

      const { stdout } = await execFileAsync(
        YTDLP_PATH,
        args,
        {
          timeout: 120_000, // 2 min per track
          signal: abortController.signal,
        },
      );

      // Parse the output to get the actual file path
      const lines = stdout.trim().split('\n');
      const filePathLine = lines[lines.length - 1]?.trim();
      const finalPath = filePathLine || this.getFilePath(youtubeId, ext);

      // Get file size
      let fileSize = 0;
      try {
        const stat = fs.statSync(finalPath);
        fileSize = stat.size;
      } catch {}

      // Update the download record
      completeDownload(dlId, fileSize);

      // Update the track in the database to point to the local file
      updateTrack(trackId, {
        path: finalPath,
        source: 'local',
      });

      this.activeDownloads.delete(dlId);
      this.trackToDownloadId.delete(trackId);
      onProgress?.(1.0, dlId);

      console.log(`[DownloadService] Downloaded ${track.title} to ${finalPath}`);
      return finalPath;
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      failDownload(dlId, msg);
      this.activeDownloads.delete(dlId);
      this.trackToDownloadId.delete(trackId);
      throw new Error(`Download failed: ${msg}`);
    }
  }

  /**
   * Cancel an active download.
   */
  cancelDownload(downloadId: number): boolean {
    const controller = this.activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(downloadId);
      deleteDownloadRecord(downloadId);
      return true;
    }
    return false;
  }

  /**
   * Cancel an active download by track ID.
   */
  cancelDownloadByTrackId(trackId: string): boolean {
    const downloadId = this.trackToDownloadId.get(trackId);
    if (downloadId !== undefined) {
      this.trackToDownloadId.delete(trackId);
      return this.cancelDownload(downloadId);
    }
    return false;
  }

  /**
   * Delete a downloaded track's file and records.
   */
  deleteDownloadedTrack(trackId: string): boolean {
    const filePath = getDownloadedFilePath(trackId);
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`[DownloadService] Failed to delete file: ${filePath}`, err);
      }
    }
    // Reset the track back to streaming source
    try {
      updateTrack(trackId, { path: '', source: 'youtube' });
    } catch {}
    return true;
  }

  /**
   * Check if a track has a completed download.
   */
  isDownloaded(trackId: string): boolean {
    const hasLocal = hasCompletedDownload(trackId);
    if (!hasLocal) return false;
    const filePath = getDownloadedFilePath(trackId);
    return !!filePath && fs.existsSync(filePath);
  }

  /**
   * Get the local file path for a downloaded track, or null.
   */
  getLocalPath(trackId: string): string | null {
    return getDownloadedFilePath(trackId);
  }

  /**
   * Resolve a media source — prioritises local files over streaming.
   * Returns null if no local file exists.
   */
  resolveLocal(trackId: string): { filePath: string } | null {
    const filePath = getDownloadedFilePath(trackId);
    if (!filePath || !fs.existsSync(filePath)) return null;
    return { filePath };
  }

  /**
   * Clean up — cancel all active downloads.
   */
  dispose(): void {
    for (const [id, controller] of this.activeDownloads) {
      controller.abort();
    }
    this.activeDownloads.clear();
    this.trackToDownloadId.clear();
  }
}

export const downloadService = new DownloadService();
