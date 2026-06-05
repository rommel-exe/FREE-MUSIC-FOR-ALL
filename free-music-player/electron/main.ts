import { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut } from 'electron';
import * as path from 'node:path';

// Bypass autoplay restrictions for audio streaming
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests');
import { initDatabase } from './utils/database';
import { registerPlayerHandlers } from './ipc/player';
import { registerLibraryHandlers } from './ipc/library';
import { registerPlaylistHandlers } from './ipc/playlist';
import { registerQueueHandlers } from './ipc/queue';
import { registerSearchHandlers } from './ipc/search';
import { registerSettingsHandlers } from './ipc/settings';
import { registerStreamHandlers } from './ipc/stream';
import { registerImportHandlers } from './ipc/import';
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
  if (isDev()) {
    return 'http://localhost:5173';
  }
  return `file://${path.join(__dirname, '../dist/index.html')}`;
}

// ─── Window creation ────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: '#0a0a0a',
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 8 },
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
  registerWindowControls();

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
