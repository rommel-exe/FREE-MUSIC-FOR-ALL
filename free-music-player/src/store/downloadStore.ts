/**
 * downloadStore — Centralised download state management.
 *
 * Tracks active, completed, and failed downloads. Wires progress events
 * from the main process so the UI can show real-time progress.
 */
import { create } from 'zustand';
import { ipc } from '@/utils/ipc';
import type { Track } from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DownloadEntry {
  trackId: string;
  downloadId: number | null;
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  status: 'downloading' | 'completed' | 'failed';
  progress: number; // 0.0 – 1.0
  error?: string;
  filePath?: string;
  fileSize?: number;
  createdAt?: string;
  completedAt?: string | null;
}

type DownloadMap = Map<string, DownloadEntry>;

interface DownloadState {
  /** Map of trackId → download entry for O(1) lookup. */
  entries: DownloadMap;
  /** Ordered list (newest first) for rendering the Downloads page. */
  list: DownloadEntry[];

  /** Hydrate from the database on app boot. */
  hydrate: () => Promise<void>;
  /** Start downloading a track. */
  downloadTrack: (track: Track) => Promise<void>;
  /** Cancel an active download. */
  cancelDownload: (trackId: string) => Promise<void>;
  /** Delete a completed/failed download (file + records). */
  deleteDownload: (trackId: string) => Promise<void>;
  /** Retry a failed download. */
  retryDownload: (track: Track) => Promise<void>;
  /** Check if a track is downloading. */
  isDownloading: (trackId: string) => boolean;
  /** Check if a track is downloaded. */
  isDownloaded: (trackId: string) => boolean;
  /** Get progress for a track (0–1). */
  getProgress: (trackId: string) => number;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const useDownloadStore = create<DownloadState>((set, get) => ({
  entries: new Map(),
  list: [],

  /* ── Hydrate ──────────────────────────────────────────────────── */
  hydrate: async () => {
    // Load existing completed downloads from DB
    try {
      const { downloads } = await ipc.download.getAll();
      const entries: DownloadEntry[] = downloads
        .filter((d: any) => d.status === 'completed')
        .map((d: any) => ({
          trackId: d.trackId ?? d.track_id ?? '',
          downloadId: d.id,
          videoId: d.videoId ?? d.video_id ?? '',
          title: d.title ?? '',
          artist: d.artist ?? '',
          thumbnail: d.thumbnail ?? '',
          duration: d.duration ?? 0,
          status: 'completed' as const,
          progress: 1,
          filePath: d.filePath ?? d.file_path ?? '',
          fileSize: Number(d.fileSize ?? d.file_size ?? 0),
          createdAt: d.createdAt ?? d.created_at ?? '',
          completedAt: d.completedAt ?? d.completed_at ?? null,
        }));

      const map = new Map<string, DownloadEntry>();
      for (const e of entries) map.set(e.trackId, e);
      const list = [...entries].sort((a, b) => {
        const aDate = a.completedAt ?? a.createdAt ?? '';
        const bDate = b.completedAt ?? b.createdAt ?? '';
        return bDate.localeCompare(aDate);
      });
      set({ entries: map, list });
    } catch {
      // DB not ready yet – silently retry later
    }

    // Subscribe to live progress events
    try {
      ipc.download.onDownloadProgress((data) => {
        set((s) => {
          const entry = s.entries.get(data.trackId);
          if (!entry) return s;
          const map = new Map(s.entries);
          map.set(data.trackId, {
            ...entry,
            downloadId: data.downloadId ?? entry.downloadId,
            progress: data.progress,
          });
          const list = s.list.map((e) =>
            e.trackId === data.trackId
              ? { ...e, downloadId: data.downloadId ?? entry.downloadId, progress: data.progress }
              : e,
          );
          return { entries: map, list };
        });
      });
    } catch {
      // No API available
    }
  },

  /* ── Download ─────────────────────────────────────────────────── */
  downloadTrack: async (track: Track) => {
    const trackId = track.id;

    // Already downloading?
    if (get().entries.get(trackId)?.status === 'downloading') return;

    // Add optimistic entry
    set((s) => {
      const map = new Map(s.entries);
      map.set(trackId, {
        trackId,
        downloadId: null,
        videoId: track.youtubeId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration: track.duration,
        status: 'downloading',
        progress: 0,
      });
      const list = [map.get(trackId)!, ...s.list];
      return { entries: map, list };
    });

    try {
      const result = await ipc.download.track({
        id: track.id,
        youtubeId: track.youtubeId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        thumbnail: track.thumbnail,
      });

      set((s) => {
        const map = new Map(s.entries);
        const existing = map.get(trackId);
        if (!existing) return s;
        if (result.ok) {
          map.set(trackId, {
            ...existing,
            status: 'completed',
            progress: 1,
            filePath: result.filePath ?? existing.filePath,
          });
        } else {
          map.set(trackId, {
            ...existing,
            status: 'failed',
            progress: 0,
            error: result.error ?? 'Download failed',
          });
        }
        const list = Array.from(map.values()).sort((a, b) => {
          const aDate = a.completedAt ?? a.createdAt ?? '';
          const bDate = b.completedAt ?? b.createdAt ?? '';
          return bDate.localeCompare(aDate);
        });
        return { entries: map, list };
      });
    } catch (err: any) {
      set((s) => {
        const map = new Map(s.entries);
        const existing = map.get(trackId);
        if (!existing) return s;
        map.set(trackId, {
          ...existing,
          status: 'failed',
          progress: 0,
          error: err?.message ?? 'Download failed',
        });
        const list = [...s.list];
        return { entries: map, list };
      });
    }
  },

  /* ── Cancel ───────────────────────────────────────────────────── */
  cancelDownload: async (trackId: string) => {
    try {
      await ipc.download.cancelByTrackId(trackId);
    } catch {
      // Best effort
    }
    set((s) => {
      const map = new Map(s.entries);
      map.delete(trackId);
      const list = s.list.filter((e) => e.trackId !== trackId);
      return { entries: map, list };
    });
  },

  /* ── Delete ───────────────────────────────────────────────────── */
  deleteDownload: async (trackId: string) => {
    try {
      await ipc.download.delete(trackId);
    } catch {
      // Best effort
    }
    set((s) => {
      const map = new Map(s.entries);
      map.delete(trackId);
      const list = s.list.filter((e) => e.trackId !== trackId);
      return { entries: map, list };
    });
  },

  /* ── Retry ────────────────────────────────────────────────────── */
  retryDownload: async (track: Track) => {
    await get().deleteDownload(track.id);
    await get().downloadTrack(track);
  },

  /* ── Queries ──────────────────────────────────────────────────── */
  isDownloading: (trackId: string) =>
    get().entries.get(trackId)?.status === 'downloading',

  isDownloaded: (trackId: string) => {
    const entry = get().entries.get(trackId);
    return entry?.status === 'completed' || false;
  },

  getProgress: (trackId: string) =>
    get().entries.get(trackId)?.progress ?? 0,
}));
