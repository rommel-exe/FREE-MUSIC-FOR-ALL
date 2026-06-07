import { ipcMain } from 'electron';
import * as db from '../utils/database';
import { validate, SettingsPartialSchema, SessionSchema } from '../utils/validate';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getSettings', () => {
    try {
      return db.getSettings();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to get settings: ${message}`);
    }
  });

  ipcMain.handle(
    'settings:updateSettings',
    (_event, partial: Record<string, string | number | boolean>) => {
      try {
        const validated = validate(SettingsPartialSchema, partial, 'settings partial');
        db.updateSettings(validated as Record<string, string | number | boolean>);
        return db.getSettings();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to update settings: ${message}`);
      }
    },
  );

  ipcMain.handle('settings:getSetting', (_event, key: string) => {
    try {
      return db.getSetting(key) ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to get setting: ${message}`);
    }
  });

  ipcMain.handle('settings:getSession', () => {
    try {
      return db.getSession();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to get session: ${message}`);
    }
  });

  ipcMain.handle('settings:saveSession', (_event, session: Record<string, unknown>) => {
    try {
      const validated = validate(SessionSchema, session, 'session');
      db.saveSession(validated);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to save session: ${message}`);
    }
  });
}
