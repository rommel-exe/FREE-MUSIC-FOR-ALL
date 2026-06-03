/**
 * Backfill the `path` field in DB for tracks that have files on disk
 * but no path stored. Run with: npx electron scripts/backfill-paths.js
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

app.setName('free-music-player');

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'data/player.db');
  const downloadsPath = path.join(app.getPath('music'), 'FreeMusicPlayer', 'downloads');
  const db = new Database(dbPath);

  // Get all tracks with no path
  const tracks = db.prepare("SELECT id, title, artist, youtube_id FROM tracks WHERE path = '' OR path IS NULL").all();
  console.log(`[BackfillPaths] Checking ${tracks.length} tracks for files on disk...`);

  // Build a map of filename → file
  const filesOnDisk = new Map();
  for (const f of fs.readdirSync(downloadsPath)) {
    if (f.endsWith('.mp3')) filesOnDisk.set(f.toLowerCase(), f);
  }
  console.log(`[BackfillPaths] ${filesOnDisk.size} files on disk`);

  const update = db.prepare("UPDATE tracks SET path = ?, source = 'youtube' WHERE id = ?");
  let matched = 0;
  let ambiguous = 0;

  for (const t of tracks) {
    if (!t.title) continue;
    const sanitized = (s) => s.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
    const expected = `${sanitized(t.artist || '')} - ${sanitized(t.title)}.mp3`.toLowerCase();

    // Try exact match
    if (filesOnDisk.has(expected)) {
      const fullPath = path.join(downloadsPath, filesOnDisk.get(expected));
      update.run(fullPath, t.id);
      matched++;
      console.log(`  ✓ ${t.artist} - ${t.title} → ${filesOnDisk.get(expected)}`);
      continue;
    }

    // Try matching just by title
    const titleLower = t.title.toLowerCase();
    let candidates = [];
    for (const [fname, original] of filesOnDisk.entries()) {
      if (fname.includes(titleLower) && (t.artist ? fname.includes(t.artist.toLowerCase().split(',')[0].trim()) : true)) {
        candidates.push(original);
      }
    }
    if (candidates.length === 1) {
      const fullPath = path.join(downloadsPath, candidates[0]);
      update.run(fullPath, t.id);
      matched++;
      console.log(`  ✓ ${t.artist} - ${t.title} → ${candidates[0]} (title match)`);
    } else if (candidates.length > 1) {
      ambiguous++;
      console.log(`  ? ${t.artist} - ${t.title}: ${candidates.length} candidates: ${candidates.join(', ')}`);
    }
  }

  console.log(`\n[BackfillPaths] Done: ${matched} matched, ${ambiguous} ambiguous (need manual fix)`);
  db.close();
  app.quit();
});
