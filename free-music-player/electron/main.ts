import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { initAutoUpdater, checkForUpdates, downloadUpdate, installUpdate, getUpdateState, getAppVersion } from './services/auto-updater';
import { registerUpdateHandlers } from './ipc/update';
import { registerAnalyticsHandlers } from './ipc/analytics';
import * as path from 'path';
import { initDatabase } from './utils/database';
import { registerPlayerHandlers } from './ipc/player';
import { registerLibraryHandlers } from './ipc/library';
import { registerPlaylistHandlers } from './ipc/playlist';
import { registerQueueHandlers } from './ipc/queue';
import { registerSearchHandlers } from './ipc/search';
import { registerDownloadHandlers } from './ipc/download';
import { registerImportHandlers } from './ipc/import';
import { registerLyricsHandlers } from './ipc/lyrics';
import { registerSettingsHandlers } from './ipc/settings';

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
    backgroundColor: '#1C1C1E',
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 8 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    show: false,
    icon: path.join(__dirname, '../resources/icons/icon.png'),
  });

  // Gracefully show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the renderer
  mainWindow.loadURL(getRendererUrl());

  // Open DevTools in development
  if (isDev()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  }

  // Forward renderer console messages to main process log
  mainWindow.webContents.on('console-message', (_event, _level, message, _line, _source) => {
    const prefix = '[Renderer]';
    if (_level >= 2) console.error(prefix, message);
    else console.log(prefix, message);
  });

  // Cleanup reference
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ─── Register window control IPC ────────────────────────────────────────

function registerWindowControls(): void {
  ipcMain.on('app:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('app:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('app:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.on('window:setMiniPlayer', (_event, mini: boolean) => {
    if (!mainWindow) return;

    if (mini) {
      mainWindow.setMinimumSize(320, 90);
      mainWindow.setSize(320, 90);
      mainWindow.setAlwaysOnTop(true, 'floating');
    } else {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
      mainWindow.setSize(WINDOW_WIDTH, WINDOW_HEIGHT);
      mainWindow.center();
    }
  });

  ipcMain.on('window:setAlwaysOnTop', (_event, onTop: boolean) => {
    mainWindow?.setAlwaysOnTop(onTop, 'floating');
  });
}

// ─── App lifecycle ──────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Set app user model ID for Windows notifications
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.freemusicplayer.app');
  }

  // Set dark theme
  nativeTheme.themeSource = 'dark';

  // Initialise database
  initDatabase();

  // Register all IPC handlers
  // Open downloads folder in OS file explorer
  ipcMain.handle('shell:openDownloadsFolder', () => {
    const { shell } = require('electron');
    const path = require('path');
    const fs = require('fs');
    const downloadsPath = path.join(app.getPath('music'), 'FreeMusicPlayer', 'downloads');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    return shell.openPath(downloadsPath);
  });

  // Reveal a specific file in OS file explorer
  ipcMain.handle('shell:revealInFolder', (_event, filePath: string) => {
    const { shell } = require('electron');
    if (filePath && require('fs').existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    } else {
      const path = require('path');
      const downloadsPath = path.join(app.getPath('music'), 'FreeMusicPlayer', 'downloads');
      shell.openPath(downloadsPath);
    }
  });

  registerPlayerHandlers();
  registerLibraryHandlers();
  registerPlaylistHandlers();
  registerQueueHandlers();
  registerSearchHandlers();
  registerDownloadHandlers();
  registerImportHandlers();
  registerLyricsHandlers();
  registerSettingsHandlers();
  registerUpdateHandlers();
  registerAnalyticsHandlers();
  registerWindowControls();

  // Create the main window
  createMainWindow();

  // Wire up auto-updater (only does anything in packaged builds)
  initAutoUpdater(mainWindow!);

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// ── Quit when all windows are closed (except on macOS) ──────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ── Second instance lock ────────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── Register custom protocol for streaming local audio files ───────────
import { protocol, net } from 'electron';
import { pathToFileURL } from 'url';
import * as fs from 'fs';
import * as pathModule from 'path';

protocol.registerSchemesAsPrivileged([
  { scheme: 'stream', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
]);

app.whenReady().then(() => {
  protocol.handle('stream', async (request) => {
    try {
      const url = new URL(request.url);
      // stream://videoId  →  /tmp/freemusic-videoId.m4a
      const videoId = url.hostname || url.pathname.replace(/^\/+/, '');
      const filePath = pathModule.join(require('os').tmpdir(), `freemusic-${videoId}.m4a`);

      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const range = request.headers.get('range');

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(filePath, { start, end });
        // Handle abort gracefully
        request.signal.addEventListener('abort', () => { try { stream.destroy(); } catch {} });
        return new Response(stream as any, {
          status: 206,
          headers: {
            'Content-Type': 'audio/mp4',
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
          },
        });
      }

      const stream = fs.createReadStream(filePath);
      request.signal.addEventListener('abort', () => { try { stream.destroy(); } catch {} });
      return new Response(stream as any, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mp4',
          'Content-Length': String(stat.size),
          'Accept-Ranges': 'bytes',
        },
      });
    } catch (err: any) {
      console.error('[stream protocol] Error:', err.message);
      return new Response('Internal error', { status: 500 });
    }
  });
});

// ── Prevent new window creation ─────────────────────────────────────────
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
