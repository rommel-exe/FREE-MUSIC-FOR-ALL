import { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut } from 'electron';
import * as path from 'node:path';

// Bypass autoplay restrictions for audio streaming
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests');
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}
import { initDatabase } from './utils/database';
import { registerPlayerHandlers } from './ipc/player';
import { registerLibraryHandlers } from './ipc/library';
import { registerPlaylistHandlers } from './ipc/playlist';
import { registerQueueHandlers } from './ipc/queue';
import { registerSearchHandlers } from './ipc/search';
import { registerSettingsHandlers } from './ipc/settings';
import { registerStreamHandlers } from './ipc/stream';
import { registerImportHandlers } from './ipc/import';
import { registerAlignmentHandlers } from './ipc/alignment';
import { registerDownloadHandlers } from './ipc/download';
import { mediaResolver } from './services/mediaResolver';

// ─── Prevent multiple instances ─────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ─── Window reference ───────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

const WINDOW_WIDTH = 1200;
const WINDOW_HEIGHT = 800;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

// ─── Helpers ────────────────────────────────────────────────────────────

function isDev(): boolean {
  return !app.isPackaged;
}

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function getRendererUrl(): string {
  // In production or when dist folder exists, use file:// protocol
  const distPath = path.join(__dirname, '../dist/index.html');
  if (!isDev() || require('fs').existsSync(distPath)) {
    return `file://${distPath}`;
  }
  return 'http://localhost:5173';
}

// ─── Auto-updater ──────────────────────────────────────────────────────

let _checkInProgress = false;

/**
 * Lazily import electron-updater. It crashes in dev mode (unpackaged)
 * because autoUpdater expects a packaged app with update manifests.
 */
async function getAutoUpdater() {
  if (!app.isPackaged) return null;
  try {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.autoDownload = false; // Download on user confirmation
    autoUpdater.allowPrerelease = false;
    return autoUpdater;
  } catch {
    return null;
  }
}

function sendToRenderer(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args);
}

function registerUpdateHandlers(): void {
  // ── Renderer requests a check ──────────────────────────────────
  ipcMain.handle('update:check', async () => {
    if (_checkInProgress) return { ok: false, reason: 'already-checking' };
    const updater = await getAutoUpdater();
    if (!updater) {
      sendToRenderer('update:status', { status: 'not-available', reason: 'dev-mode' });
      return { ok: false, reason: 'dev-mode' };
    }

    _checkInProgress = true;
    sendToRenderer('update:status', { status: 'checking' });

    try {
      const result = await updater.checkForUpdates();
      if (result && result.updateInfo && result.updateInfo.version !== app.getVersion()) {
        // Update is available — download it
        sendToRenderer('update:status', {
          status: 'available',
          version: result.updateInfo.version,
          releaseDate: result.updateInfo.releaseDate,
          releaseNotes: result.updateInfo.releaseNotes,
        });

        // Start downloading
        updater.downloadUpdate(result.cancellationToken);
      } else {
        sendToRenderer('update:status', { status: 'not-available' });
      }
    } catch (err: any) {
      sendToRenderer('update:status', {
        status: 'error',
        message: err?.message ?? 'Update check failed',
      });
    } finally {
      _checkInProgress = false;
    }
    return { ok: true };
  });

  // ── Renderer requests to quit & install ────────────────────────
  ipcMain.on('update:quitAndInstall', async () => {
    const updater = await getAutoUpdater();
    if (updater) {
      setImmediate(() => updater.quitAndInstall());
    }
  });
}

/**
 * Start listening to autoUpdater events after we know the updater exists.
 */
async function setupAutoUpdaterEvents(): Promise<void> {
  const updater = await getAutoUpdater();
  if (!updater) return;

  updater.on('checking-for-update', () => {
    sendToRenderer('update:status', { status: 'checking' });
  });

  updater.on('update-available', (info) => {
    sendToRenderer('update:status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  updater.on('update-not-available', () => {
    sendToRenderer('update:status', { status: 'not-available' });
  });

  updater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', {
      percent: progress.percent ?? 0,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  updater.on('update-downloaded', (info) => {
    sendToRenderer('update:status', {
      status: 'downloaded',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  updater.on('error', (err) => {
    sendToRenderer('update:status', {
      status: 'error',
      message: err?.message ?? 'Unknown update error',
    });
  });
}

/**
 * Silently check for updates on boot (only in production).
 */
async function checkForUpdatesOnBoot(): Promise<void> {
  const updater = await getAutoUpdater();
  if (!updater) return;

  // Wait a few seconds so the app can settle before network calls
  setTimeout(async () => {
    try {
      const result = await updater.checkForUpdates();
      if (result?.updateInfo?.version && result.updateInfo.version !== app.getVersion()) {
        // Auto-download in background
        updater.downloadUpdate(result.cancellationToken);
      }
    } catch {
      // Silent — don't bother the user on boot
    }
  }, 5000);
}

// ─── Window creation ────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: '#00000000',
    frame: false,
    vibrancy: 'fullscreen-ui',
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.loadURL(getRendererUrl());

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[MainWindow] Failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MainWindow] Finished loading');
  });

  // DevTools can be opened manually with Cmd+Shift+I

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ─── Register window control IPC ────────────────────────────────────────

function registerWindowControls(): void {
  ipcMain.on('app:minimize', () => mainWindow?.minimize());

  ipcMain.on('app:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('app:close', () => mainWindow?.close());

  ipcMain.handle('app:getVersion', () => app.getVersion());
}

// ─── App lifecycle ──────────────────────────────────────────────────────

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';

  initDatabase();

  await mediaResolver.start();

  registerPlayerHandlers();
  registerLibraryHandlers();
  registerPlaylistHandlers();
  registerQueueHandlers();
  registerSearchHandlers();
  registerSettingsHandlers();
  registerStreamHandlers();
  registerImportHandlers();
  registerAlignmentHandlers();
  registerDownloadHandlers();
  registerWindowControls();
  registerUpdateHandlers();

  // Global media key shortcuts
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow?.webContents.send('global:playPause');
  });
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow?.webContents.send('global:nextTrack');
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow?.webContents.send('global:previousTrack');
  });
  globalShortcut.register('MediaStop', () => {
    mainWindow?.webContents.send('global:pause');
  });

  createMainWindow();

  // Wire auto-updater events BEFORE checking (so we don't miss them)
  await setupAutoUpdaterEvents();

  // Silent background check on boot
  await checkForUpdatesOnBoot();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
