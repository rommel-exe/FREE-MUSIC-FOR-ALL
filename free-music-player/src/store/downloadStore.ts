import { create } from 'zustand';
import { Download } from '@/types';
import { ipc } from '@/utils/ipc';

interface BatchProgress {
  current: number;
  total: number;
  track: string;
}

interface DownloadState {
  downloads: Download[];
  loading: boolean;
  batchActive: boolean;
  batchProgress: BatchProgress | null;

  loadDownloads: () => Promise<void>;
  startDownload: (videoId: string, title: string, artist: string, thumbnail: string) => Promise<void>;
  downloadPlaylist: (tracks: any[]) => Promise<{ success: number; failed: number; skipped: number; results?: any[] }>;
  cancelDownload: (id: string) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: [],
  loading: false,
  batchActive: false,
  batchProgress: null,

  loadDownloads: async () => {
    set({ loading: true });
    try {
      const downloads = await ipc.download.getDownloads();
      set({ downloads, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  startDownload: async (videoId, title, artist, thumbnail) => {
    try {
      await ipc.download.startDownload(videoId, title, artist, thumbnail);
      await get().loadDownloads();
    } catch (e: any) {
      console.error('Download failed:', e);
    }
  },

  downloadPlaylist: async (tracks: any[]) => {
    if (get().batchActive) {
      console.warn('[Downloads] Batch already in progress');
      return { success: 0, failed: 0, skipped: 0, results: [] };
    }
    set({ batchActive: true, batchProgress: { current: 0, total: tracks.length, track: '' } });

    // Listen for progress updates
    const progressHandler = (data: BatchProgress) => {
      set({ batchProgress: data });
    };
    if (ipc.download.onBatchProgress) {
      ipc.download.onBatchProgress(progressHandler);
    }

    try {
      console.log(`[Downloads] Starting batch: ${tracks.length} tracks`);
      const results: any[] = await ipc.download.downloadPlaylist(tracks);
      const success = results.filter((r) => r.success && !r.skipped).length;
      const skipped = results.filter((r) => r.skipped).length;
      const failed = results.filter((r) => !r.success).length;
      console.log(`[Downloads] Batch complete: ${success} downloaded, ${skipped} skipped, ${failed} failed`);
      if (failed > 0) {
        console.warn('[Downloads] Failed tracks (first 5):');
        results.filter((r) => !r.success).slice(0, 5).forEach((r) => {
          console.warn(`  - ${r.artist} - ${r.title}: ${r.error}`);
        });
      }
      await get().loadDownloads();
      return { success, failed, skipped, results };
    } catch (e: any) {
      console.error('[Downloads] Batch failed:', e);
      return { success: 0, failed: tracks.length, skipped: 0, results: [] };
    } finally {
      set({ batchActive: false, batchProgress: null });
    }
  },

  cancelDownload: async (id) => {
    await ipc.download.cancelDownload(id);
    await get().loadDownloads();
  },

  removeDownload: async (id) => {
    await ipc.download.removeDownload(id);
    await get().loadDownloads();
  },
}));
