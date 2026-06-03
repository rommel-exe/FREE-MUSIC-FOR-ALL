import { ipcMain } from 'electron';
import { checkForUpdates, downloadUpdate, installUpdate, getUpdateState, getAppVersion } from '../services/auto-updater';

export function registerUpdateHandlers(): void {
  // Manual check (user clicks "Check for updates")
  ipcMain.handle('update:check', async () => {
    return checkForUpdates();
  });

  // Start downloading an available update
  ipcMain.handle('update:download', async () => {
    return downloadUpdate();
  });

  // Quit and install the downloaded update
  ipcMain.handle('update:install', () => {
    installUpdate();
    return true;
  });

  // Get current state (called on app load)
  ipcMain.handle('update:getState', () => {
    return getUpdateState();
  });

  // Get app version
  ipcMain.handle('update:getVersion', () => {
    return getAppVersion();
  });
}
