import { ipcMain } from 'electron';
import * as db from '../utils/database';
import type { Track } from '../utils/types';

let currentTrack: Track | null = null;
let isPlaying = false;
let currentTime = 0;
let volume = 0.8;

export function getPlayerState() {
  return { currentTrack, isPlaying, currentTime, volume };
}

function notifyRenderer(channel: string, ...args: unknown[]) {
  const { BrowserWindow } = require('electron');
  BrowserWindow.getAllWindows().forEach((win: any) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  });
}

export function registerPlayerHandlers(): void {
  ipcMain.handle('player:getCurrentTrack', () => currentTrack);

  ipcMain.handle('player:getProgress', () => ({ progress: currentTime, duration: currentTrack?.duration || 0 }));

  ipcMain.on('player:play', (_event, trackId?: string) => {
    if (trackId) {
      const track = db.getTrackById(trackId);
      if (track) {
        currentTrack = track;
        try { db.addRecentlyPlayed(track.id); } catch {}
      }
    }
    isPlaying = true;
    notifyRenderer('player:trackChange', currentTrack);
  });

  ipcMain.on('player:pause', () => { isPlaying = false; });

  ipcMain.on('player:resume', () => { isPlaying = true; });

  ipcMain.on('player:seek', (_event, time: number) => { currentTime = time; });

  ipcMain.on('player:setVolume', (_event, vol: number) => {
    volume = Math.max(0, Math.min(1, vol));
  });
}
