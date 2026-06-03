import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple logger that writes to stdout AND to a file in the user data dir.
 * electron-updater has a typed logger interface that this satisfies.
 */
const logFile = path.join(app.getPath('userData'), 'logs', 'app.log');

function ensureLogDir() {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
  } catch {
    // ignore
  }
}

function writeLine(level: string, message: string) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  // stdout
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
  // file
  try {
    ensureLogDir();
    fs.appendFileSync(logFile, line + '\n');
  } catch {
    // ignore
  }
}

export const log = {
  info: (msg: string, ...args: any[]) => writeLine('info', args.length ? `${msg} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}` : msg),
  warn: (msg: string, ...args: any[]) => writeLine('warn', args.length ? `${msg} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}` : msg),
  error: (msg: string, ...args: any[]) => writeLine('error', args.length ? `${msg} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}` : msg),
  debug: (msg: string, ...args: any[]) => writeLine('debug', args.length ? `${msg} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}` : msg),
};
