/**
 * One-time backfill. Run with:  npx electron scripts/backfill-main.js
 * Resolves YouTube IDs for all tracks that have an empty youtube_id.
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const Database = require('better-sqlite3');

app.setName('free-music-player');

const YTDLP = '/Users/jackfu/Library/Python/3.9/bin/yt-dlp';
const execp = promisify(exec);

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath('userData'), 'data/player.db');
  if (!fs.existsSync(dbPath)) {
    console.error('DB not found at', dbPath);
    app.quit();
    return;
  }
  const db = new Database(dbPath);
  const rows = db.prepare("SELECT id, title, artist FROM tracks WHERE youtube_id = '' OR youtube_id IS NULL").all();
  console.log(`[Backfill] ${rows.length} tracks need YouTube ID resolution.`);

  const update = db.prepare("UPDATE tracks SET youtube_id = ?, source = 'youtube' WHERE id = ?");

  async function searchYouTube(query) {
    try {
      const { stdout } = await execp(
        `${YTDLP} "ytsearch1:${query.replace(/"/g, '')}" --dump-single-json --no-warnings --quiet --no-check-certificates --extractor-args "youtube:player_client=android"`,
        { maxBuffer: 50 * 1024 * 1024, timeout: 30000 }
      );
      const data = JSON.parse(stdout);
      return data.entries?.[0]?.id || null;
    } catch {
      return null;
    }
  }

  let done = 0, failed = 0;
  const CONCURRENCY = 6;
  const start = Date.now();

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (row) => {
      const q = `${row.title} ${row.artist || ''}`.trim();
      const videoId = q ? await searchYouTube(q) : null;
      return { row, videoId };
    }));
    for (const { row, videoId } of results) {
      if (videoId) {
        update.run(videoId, row.id);
        done++;
        console.log(`  [${done + failed}/${rows.length}] ✓ ${row.title} → ${videoId}`);
      } else {
        failed++;
        console.log(`  [${done + failed}/${rows.length}] ✗ ${row.title} (no result)`);
      }
    }
  }
  console.log(`\n[Backfill] Done: ${done} resolved, ${failed} failed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  db.close();
  app.quit();
});
