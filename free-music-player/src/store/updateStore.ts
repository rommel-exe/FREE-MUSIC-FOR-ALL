/**
 * updateStore — Tracks auto-update state from the main process.
 *
 * Subscribes to IPC events on boot so the update banner/reactivity
 * works without polling.
 */
import { create } from 'zustand';
import { ipc } from '@/utils/ipc';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateInfo {
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  message?: string;
}

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  currentVersion: string;
  progress: UpdateProgress | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  errorMessage: string | null;
  dismissed: boolean;

  /** Trigger a check from the main process. */
  checkForUpdates: () => Promise<void>;
  /** Tell main process to quit and install. */
  quitAndInstall: () => void;
  /** Dismiss the update banner. */
  dismiss: () => void;
  /** Subscribe to IPC events (call once on boot). */
  init: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  version: null,
  currentVersion: '1.0.0',
  progress: null,
  releaseDate: null,
  releaseNotes: null,
  errorMessage: null,
  dismissed: false,

  init: async () => {
    // Get current version
    try {
      const ver = await ipc.app.getVersion();
      set({ currentVersion: ver || '1.0.0' });
    } catch {
      // ignore
    }

    // Subscribe to status events
    try {
      ipc.update.onUpdateStatus((data) => {
        const status = data.status;
        set({
          status,
          version: data.version ?? get().version,
          releaseDate: data.releaseDate ?? null,
          releaseNotes: data.releaseNotes ?? null,
          errorMessage: data.message ?? null,
          progress: status === 'downloaded' ? null : get().progress,
          dismissed: status === 'not-available' ? false : get().dismissed,
        });
      });

      ipc.update.onUpdateProgress((data) => {
        const { status } = get();
        // Auto-set to downloading when progress arrives
        if (status === 'available' || status === 'checking') {
          set({ status: 'downloading' });
        }
        set({ progress: data });
      });
    } catch {
      // No update API (dev mode etc.)
    }
  },

  checkForUpdates: async () => {
    set({ status: 'checking', dismissed: false });
    try {
      const result = await ipc.update.checkForUpdates();
      if (!result.ok && result.reason === 'dev-mode') {
        set({ status: 'not-available', errorMessage: null });
      }
    } catch (err: any) {
      set({
        status: 'error',
        errorMessage: err?.message ?? 'Update check failed',
      });
    }
  },

  quitAndInstall: () => {
    ipc.update.quitAndInstall();
  },

  dismiss: () => {
    set({ dismissed: true });
  },
}));
