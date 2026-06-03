import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater, type Logger } from 'electron-updater';
import { log } from './logger';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  version?: string;
  releaseNotes?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  error?: string;
}

let currentState: UpdateState = { status: 'idle' };
let mainWindow: BrowserWindow | null = null;

// Configure logging so dev tools can see update activity
autoUpdater.logger = log as unknown as Logger;
autoUpdater.autoDownload = false; // user must opt in via UI
autoUpdater.autoInstallOnAppQuit = true;

function emit(state: UpdateState) {
  currentState = state;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', state);
  }
  log.info('[autoUpdater]', JSON.stringify(state));
}

autoUpdater.on('checking-for-update', () => {
  emit({ status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  emit({
    status: 'available',
    version: info.version,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
  });
});

autoUpdater.on('update-not-available', (info) => {
  emit({ status: 'not-available', version: info.version });
});

autoUpdater.on('download-progress', (progress) => {
  emit({
    status: 'downloading',
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  emit({
    status: 'downloaded',
    version: info.version,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
  });
  // Notify the user with a native dialog (in case the UI is hidden)
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update ready',
      message: `Version ${info.version} has been downloaded`,
      detail: 'Restart the app to apply the update.',
      buttons: ['Restart now', 'On next launch'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

autoUpdater.on('error', (err) => {
  emit({ status: 'error', error: err.message || String(err) });
});

/**
 * Wire the auto-updater to a window. Call this once when the main window is created.
 * Only does anything when the app is packaged (production builds).
 */
export function initAutoUpdater(win: BrowserWindow) {
  mainWindow = win;
  // Do NOT auto-check on dev - only on packaged builds
  if (app.isPackaged) {
    // Stagger the check by 5 seconds so the app finishes loading first
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e) => {
        log.warn('[autoUpdater] check failed:', e.message);
      });
    }, 5000);
  }
}

/**
 * Manually trigger an update check (called from the UI).
 * No-op in dev.
 */
export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) {
    return {
      status: 'idle',
      error: 'Updates are only available in production builds',
    };
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (e: any) {
    emit({ status: 'error', error: e.message || String(e) });
  }
  return currentState;
}

/**
 * Start downloading an available update.
 */
export async function downloadUpdate(): Promise<UpdateState> {
  if (!app.isPackaged) return currentState;
  try {
    await autoUpdater.downloadUpdate();
  } catch (e: any) {
    emit({ status: 'error', error: e.message || String(e) });
  }
  return currentState;
}

/**
 * Quit and install the downloaded update.
 */
export function installUpdate() {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall();
}

/**
 * Get current state (called by IPC).
 */
export function getUpdateState(): UpdateState {
  return currentState;
}

/**
 * Get current app version.
 */
export function getAppVersion(): string {
  return app.getVersion();
}
