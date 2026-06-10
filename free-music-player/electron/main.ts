import { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut } from 'electron';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as https from 'node:https';
import { finished } from 'node:stream/promises';

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

// ─── Auto-updater (no Squirrel.Mac — direct GitHub + ditto) ─────────

const GITHUB_OWNER = 'rommel-exe';
const GITHUB_REPO = 'FREE-MUSIC-FOR-ALL';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

let _checkInProgress = false;
let _downloadInProgress = false;
let _downloadedUpdatePath: string | null = null;

/* ── helpers ───────────────────────────────────────────────────── */

function sendToRenderer(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args);
}

function getPlatformAssetName(version: string): string {
  // Squirrel / electron-builder publishes these assets on each release
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `Free-Music-Player-${version}-${arch}-mac.zip`;
}

function cleanVersion(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

/** True if `latest` is a higher semver than `current`. */
function isNewerVersion(current: string, latest: string): boolean {
  const cur = current.split('.').map(Number);
  const lat = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
    const a = cur[i] ?? 0;
    const b = lat[i] ?? 0;
    if (b > a) return true;
    if (b < a) return false;
  }
  return false;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  body: string | null;
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
}

/**
 * Fetch a JSON payload from the GitHub API.
 * Uses raw `https` to avoid depending on global `fetch` availability.
 */
function githubGet<T>(path: string): Promise<T | null> {
  return new Promise((resolve) => {
    const url = new URL(`${GITHUB_API}${path}`);
    https.get(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'FreeMusicPlayer/1.0',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      },
    ).on('error', () => resolve(null));
  });
}

/* ── check + download logic ────────────────────────────────────── */

/**
 * Check GitHub for a newer release. Returns update info or `null`.
 */
async function checkForUpdate(): Promise<{
  version: string;
  downloadUrl: string;
  size: number;
  releaseDate: string;
  releaseNotes: string;
} | null> {
  const release = await githubGet<GitHubRelease>('/releases/latest');
  if (!release) return null;

  const version = cleanVersion(release.tag_name);
  if (!isNewerVersion(app.getVersion(), version)) return null;

  const assetName = getPlatformAssetName(version);
  const asset = release.assets.find((a) => a.name === assetName);
  if (!asset) return null;

  return {
    version,
    downloadUrl: asset.browser_download_url,
    size: asset.size,
    releaseDate: release.published_at,
    releaseNotes: release.body ?? '',
  };
}

/**
 * Download a file from a URL to a local path, streaming progress back to the
 * renderer. Follows HTTP 3xx redirects (GitHub → S3 CDN).
 *
 * Uses `finished()` from `stream/promises` so that connection drops / premature
 * close are reliably caught and reject the promise.
 */
function downloadUpdate(url: string, destPath: string): Promise<void> {
  const followRedirect = (downloadUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const req = https.get(downloadUrl, async (response) => {
        // Follow redirect
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.destroy();
          try {
            resolve(await followRedirect(response.headers.location));
          } catch (e) {
            reject(e);
          }
          return;
        }

        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalBytes = Number.parseInt(response.headers['content-length'] ?? '0', 10);
        let transferred = 0;
        let startTime = Date.now();
        let lastProgressSend = 0;
        const writeStream = fs.createWriteStream(destPath);

        // Track progress — throttled to once per 250ms to avoid flooding the
        // renderer with thousands of IPC calls per second.
        response.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          if (totalBytes > 0) {
            const now = Date.now();
            if (now - lastProgressSend >= 250) {
              lastProgressSend = now;
              const elapsed = (now - startTime) / 1000;
              const bytesPerSecond = elapsed > 0 ? transferred / elapsed : 0;
              sendToRenderer('update:progress', {
                percent: Math.min((transferred / totalBytes) * 100, 100),
                bytesPerSecond,
                transferred,
                total: totalBytes,
              });
            }
          }
        });

        // Send one final 100% update when done
        response.on('end', () => {
          if (totalBytes > 0) {
            sendToRenderer('update:progress', {
              percent: 100,
              bytesPerSecond: 0,
              transferred: totalBytes,
              total: totalBytes,
            });
          }
        });

        // Pipe handles backpressure; finished() resolves when done or rejects on error
        response.pipe(writeStream);

        try {
          await finished(writeStream);
        } catch (err: any) {
          fs.rmSync(destPath, { force: true });
          reject(err);
          return;
        }

        // Validate we got the full file
        if (totalBytes > 0 && transferred < totalBytes) {
          fs.rmSync(destPath, { force: true });
          reject(new Error(`Download incomplete: ${transferred}/${totalBytes} bytes`));
          return;
        }

        resolve();
      });

      req.setTimeout(120_000, () => {
        req.destroy();
        reject(new Error('Download timed out after 120s'));
      });

      req.on('error', (err) => {
        if (fs.existsSync(destPath)) fs.rmSync(destPath, { force: true });
        reject(err);
      });
    });
  };

  return followRedirect(url);
}

/* ── IPC handlers ──────────────────────────────────────────────── */

function registerUpdateHandlers(): void {
  // ── Manual check (triggered by user or on boot) ────────────────
  ipcMain.handle('update:check', async () => {
    if (_checkInProgress) return { ok: false, reason: 'already-checking' };
    if (!app.isPackaged) {
      sendToRenderer('update:status', { status: 'not-available', reason: 'dev-mode' });
      return { ok: false, reason: 'dev-mode' };
    }

    _checkInProgress = true;
    sendToRenderer('update:status', { status: 'checking' });

    try {
      const info = await checkForUpdate();
      if (!info) {
        sendToRenderer('update:status', { status: 'not-available' });
        _checkInProgress = false;
        return { ok: true };
      }

      // Notify renderer that a new version is available
      sendToRenderer('update:status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });

      // Start background download
      _downloadInProgress = true;
      const destPath = path.join(app.getPath('temp'), `fm-update-${info.version}.zip`);

      try {
        await downloadUpdate(info.downloadUrl, destPath);
        _downloadedUpdatePath = destPath;
        sendToRenderer('update:status', {
          status: 'downloaded',
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes,
          downloadPath: destPath,
        });
      } catch (err: any) {
        sendToRenderer('update:status', {
          status: 'error',
          message: `Download failed: ${err?.message ?? 'Unknown error'}`,
        });
      } finally {
        _downloadInProgress = false;
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

  // ── Install downloaded update ──────────────────────────────────
  ipcMain.on('update:quitAndInstall', () => {
    manualInstallUpdate();
  });

  // ── Install with explicit path (fallback) ──────────────────────
  ipcMain.on('update:install', (_event, downloadPath: string) => {
    _downloadedUpdatePath = downloadPath;
    manualInstallUpdate();
  });
}

/* ── manual ditto-based install (bypasses Squirrel entirely) ───── */

function findAppBundle(dir: string): string | null {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry.endsWith('.app')) return full;
    if (fs.statSync(full).isDirectory()) {
      const found = findAppBundle(full);
      if (found) return found;
    }
  }
  return null;
}

function getAppBundlePath(): string {
  const exePath = app.getPath('exe');
  const idx = exePath.indexOf('.app');
  return idx !== -1 ? exePath.slice(0, idx + 4) : path.dirname(exePath);
}

/**
 * Extract the downloaded zip and hot-swap the .app bundle via `ditto`,
 * then relaunch. This avoids Squirrel.Mac's code-signature validation
 * which requires an Apple Developer account.
 */
function manualInstallUpdate(): void {
  if (!_downloadedUpdatePath || !fs.existsSync(_downloadedUpdatePath)) {
    sendToRenderer('update:status', {
      status: 'error',
      message: 'Update file not found',
    });
    return;
  }

  const updateFile = _downloadedUpdatePath;
  const appBundle = getAppBundlePath();
  const tmpDir = path.join(app.getPath('temp'), `fm-update-${Date.now()}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`ditto -x -k "${updateFile}" "${tmpDir}"`, { stdio: 'pipe' });

    const newApp = findAppBundle(tmpDir);
    if (!newApp) {
      throw new Error('No .app bundle found in downloaded update');
    }

      if (fs.existsSync(appBundle)) {
      execSync(`rm -rf "${appBundle}"`, { stdio: 'pipe' });
    }
    execSync(`ditto "${newApp}" "${appBundle}"`, { stdio: 'pipe' });

    execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' });

    app.relaunch();
    app.exit(0);
  } catch (err: any) {
    if (fs.existsSync(tmpDir)) {
      try { execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' }); } catch {}
    }
    sendToRenderer('update:status', {
      status: 'error',
      message: err?.message ?? 'Update install failed',
    });
  }
}

/**
 * Silent background update check on boot (production only).
 */
function scheduleBackgroundCheck(): void {
  if (!app.isPackaged) return;

  setTimeout(async () => {
    try {
      const info = await checkForUpdate();
      if (!info) return;

      // Background auto-download
      _downloadInProgress = true;
      const destPath = path.join(app.getPath('temp'), `fm-update-${info.version}.zip`);

      try {
        await downloadUpdate(info.downloadUrl, destPath);
        _downloadedUpdatePath = destPath;
        sendToRenderer('update:status', {
          status: 'downloaded',
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes,
          downloadPath: destPath,
        });
      } catch {
        // Silent — background download failure shouldn't annoy the user
      } finally {
        _downloadInProgress = false;
      }
    } catch {
      // Silent
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

  // Silent background check on boot (no Squirrel — uses GitHub API + ditto install)
  scheduleBackgroundCheck();

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
