# Graph Report - .  (2026-06-03)

## Corpus Check
- Corpus is ~45,811 words - fits in a single context window. You may not need a graph.

## Summary
- 656 nodes · 1040 edges · 54 communities (40 shown, 14 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend UI Core|Frontend UI Core]]
- [[_COMMUNITY_Data & Analytics Layer|Data & Analytics Layer]]
- [[_COMMUNITY_Database Layer (Compiled)|Database Layer (Compiled)]]
- [[_COMMUNITY_Dependencies & Build Config|Dependencies & Build Config]]
- [[_COMMUNITY_IPC & Services (Source)|IPC & Services (Source)]]
- [[_COMMUNITY_Database Layer (Source)|Database Layer (Source)]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Electron Main (Compiled)|Electron Main (Compiled)]]
- [[_COMMUNITY_Search & YouTube DL|Search & YouTube DL]]
- [[_COMMUNITY_CICD & Packaging|CI/CD & Packaging]]
- [[_COMMUNITY_Auto Update & Logging|Auto Update & Logging]]
- [[_COMMUNITY_Electron TS Config|Electron TS Config]]
- [[_COMMUNITY_Download IPC (Compiled)|Download IPC (Compiled)]]
- [[_COMMUNITY_Auto Updater (Compiled)|Auto Updater (Compiled)]]
- [[_COMMUNITY_Spotify Import|Spotify Import]]
- [[_COMMUNITY_Search IPC (Compiled)|Search IPC (Compiled)]]
- [[_COMMUNITY_Spotify Import (Compiled)|Spotify Import (Compiled)]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_Import IPC (Compiled)|Import IPC (Compiled)]]
- [[_COMMUNITY_YouTube Music (Compiled)|YouTube Music (Compiled)]]
- [[_COMMUNITY_File Utilities (Compiled)|File Utilities (Compiled)]]
- [[_COMMUNITY_Backfill Script (Main)|Backfill Script (Main)]]
- [[_COMMUNITY_YouTube DL (Compiled)|YouTube DL (Compiled)]]
- [[_COMMUNITY_Electron Main (Source)|Electron Main (Source)]]
- [[_COMMUNITY_Logger (Compiled)|Logger (Compiled)]]
- [[_COMMUNITY_Player IPC (Compiled)|Player IPC (Compiled)]]
- [[_COMMUNITY_File Utilities (Source)|File Utilities (Source)]]
- [[_COMMUNITY_Preload Script (Compiled)|Preload Script (Compiled)]]
- [[_COMMUNITY_Library IPC (Compiled)|Library IPC (Compiled)]]
- [[_COMMUNITY_Playlist IPC (Compiled)|Playlist IPC (Compiled)]]
- [[_COMMUNITY_Backfill Script (Paths)|Backfill Script (Paths)]]
- [[_COMMUNITY_Tabs Component|Tabs Component]]
- [[_COMMUNITY_Analytics IPC (Compiled)|Analytics IPC (Compiled)]]
- [[_COMMUNITY_Lyrics IPC (Compiled)|Lyrics IPC (Compiled)]]
- [[_COMMUNITY_Queue IPC (Compiled)|Queue IPC (Compiled)]]
- [[_COMMUNITY_Settings IPC (Compiled)|Settings IPC (Compiled)]]
- [[_COMMUNITY_Update IPC (Compiled)|Update IPC (Compiled)]]
- [[_COMMUNITY_Lyrics Service (Compiled)|Lyrics Service (Compiled)]]
- [[_COMMUNITY_YT Playlist (Compiled)|YT Playlist (Compiled)]]
- [[_COMMUNITY_YT Playlist (Source)|YT Playlist (Source)]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_Release Script|Release Script]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 42 edges
2. `getDb()` - 42 edges
3. `usePlayerStore` - 31 edges
4. `useUIStore` - 26 edges
5. `compilerOptions` - 21 edges
6. `Track` - 15 edges
7. `ipc` - 14 edges
8. `compilerOptions` - 13 edges
9. `useLibraryStore` - 13 edges
10. `scripts` - 8 edges

## Surprising Connections (you probably didn't know these)
- `React Entry Point` --bundled_by--> `Electron Builder`  [INFERRED]
  index.html → electron-builder.yml
- `YouTubePlayer()` --calls--> `usePlayerStore`  [EXTRACTED]
  free-music-player/src/components/player/YouTubePlayer.tsx → free-music-player/src/store/playerStore.ts
- `Release Workflow` --uses--> `Electron Builder`  [EXTRACTED]
  .github/workflows/release.yml → electron-builder.yml
- `Release Workflow` --publishes_to--> `GitHub Releases`  [EXTRACTED]
  .github/workflows/release.yml → electron-builder.yml
- `TrackGridProps` --references--> `Track`  [EXTRACTED]
  free-music-player/src/components/common/TrackGrid.tsx → free-music-player/src/types/index.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CI/CD Build Pipeline** — release_workflow, electron_builder_config, github_actions_platform, npm_ci_command, github_releases [INFERRED 0.85]
- **Distribution Package Formats** — dmg_format, zip_format, nsis_installer, appimage_format, deb_format [EXTRACTED 1.00]

## Communities (54 total, 14 thin omitted)

### Community 0 - "Frontend UI Core"
Cohesion: 0.08
Nodes (45): Button(), ButtonProps, EmptyState(), EmptyStateProps, Input(), InputProps, Modal(), ModalProps (+37 more)

### Community 1 - "Data & Analytics Layer"
Cohesion: 0.07
Nodes (35): UpdateBanner(), AnalyticsPage(), formatMinutes(), AudioPlayer(), Window, YouTubePlayer(), BatchProgress, DownloadState (+27 more)

### Community 2 - "Database Layer (Compiled)"
Cohesion: 0.09
Nodes (47): addFavorite(), addOrUpdateTrack(), addRecentlyPlayed(), addToQueue(), addTrack(), addTrackToPlaylist(), clearQueue(), createPlaylist() (+39 more)

### Community 3 - "Dependencies & Build Config"
Cohesion: 0.04
Nodes (46): dependencies, better-sqlite3, electron-store, electron-updater, fluent-ffmpeg, framer-motion, isomorphic-unfetch, lucide-react (+38 more)

### Community 4 - "IPC & Services (Source)"
Cohesion: 0.06
Nodes (30): downloads, fetchLrclib(), getLyrics(), parseLrc(), getAlbum(), getArtist(), getClient(), getHome() (+22 more)

### Community 5 - "Database Layer (Source)"
Cohesion: 0.09
Nodes (44): addFavorite(), addOrUpdateTrack(), addRecentlyPlayed(), addToQueue(), addTrack(), addTrackToPlaylist(), clearQueue(), createPlaylist() (+36 more)

### Community 6 - "TypeScript Config"
Cohesion: 0.08
Nodes (25): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+17 more)

### Community 7 - "Electron Main (Compiled)"
Cohesion: 0.09
Nodes (23): analytics_1, auto_updater_1, createMainWindow(), database_1, download_1, electron_1, electron_2, fs (+15 more)

### Community 8 - "Search & YouTube DL"
Cohesion: 0.14
Nodes (6): rankSearchResults(), searchCache, searchMusic(), searchYouTubeFallback(), PlaylistTrackResult, SearchResult

### Community 9 - "CI/CD & Packaging"
Cohesion: 0.15
Nodes (16): AppImage, Debian Package, DMG Package, Electron Builder Config, Electron Builder, Linux Build Target, macOS Build Target, Windows Build Target (+8 more)

### Community 10 - "Auto Update & Logging"
Cohesion: 0.16
Nodes (10): checkForUpdates(), currentState, downloadUpdate(), emit(), ensureLogDir(), logFile, writeLine(), UpdateState (+2 more)

### Community 11 - "Electron TS Config"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir, resolveJsonModule (+6 more)

### Community 12 - "Download IPC (Compiled)"
Cohesion: 0.17
Nodes (7): downloads, db, electron_1, file_utils_1, fs, path, ytdl_1

### Community 13 - "Auto Updater (Compiled)"
Cohesion: 0.20
Nodes (7): checkForUpdates(), currentState, downloadUpdate(), emit(), electron_1, electron_updater_1, logger_1

### Community 14 - "Spotify Import"
Cohesion: 0.29
Nodes (9): extractId(), fetchAllTracksViaBrowser(), fetchEmbedPage(), findPlaylistEntity(), getCoverUrl(), importPlaylist(), normalizeTracks(), SpotifyPlaylist (+1 more)

### Community 15 - "Search IPC (Compiled)"
Cohesion: 0.24
Nodes (6): rankSearchResults(), searchCache, searchMusic(), searchYouTubeFallback(), electron_1, ytdl_1

### Community 16 - "Spotify Import (Compiled)"
Cohesion: 0.33
Nodes (8): extractId(), fetchAllTracksViaBrowser(), fetchEmbedPage(), findPlaylistEntity(), getCoverUrl(), importPlaylist(), normalizeTracks(), electron_1

### Community 17 - "Node TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, allowImportingTsExtensions, composite, module, moduleResolution, noEmit, skipLibCheck, target (+1 more)

### Community 18 - "Import IPC (Compiled)"
Cohesion: 0.22
Nodes (5): db, electron_1, spotify_import_1, yt_playlist_1, ytdl_1

### Community 19 - "YouTube Music (Compiled)"
Cohesion: 0.39
Nodes (8): getAlbum(), getArtist(), getClient(), getHome(), getPlaylist(), getSong(), search(), ytmusic_api_1

### Community 20 - "File Utilities (Compiled)"
Cohesion: 0.28
Nodes (6): ensureDirectoryExists(), getCachePath(), getDownloadsPath(), electron_1, fs, path

### Community 21 - "Backfill Script (Main)"
Cohesion: 0.25
Nodes (8): { app }, Database, { exec }, execp, fs, path, { promisify }, searchYouTube()

### Community 23 - "Electron Main (Source)"
Cohesion: 0.48
Nodes (5): createMainWindow(), getPreloadPath(), getRendererUrl(), gotTheLock, isDev()

### Community 24 - "Logger (Compiled)"
Cohesion: 0.33
Nodes (6): ensureLogDir(), logFile, writeLine(), electron_1, fs, path

### Community 26 - "File Utilities (Source)"
Cohesion: 0.47
Nodes (3): ensureDirectoryExists(), getCachePath(), getDownloadsPath()

### Community 30 - "Backfill Script (Paths)"
Cohesion: 0.40
Nodes (4): { app }, Database, fs, path

### Community 31 - "Tabs Component"
Cohesion: 0.50
Nodes (3): Tab, Tabs(), TabsProps

### Community 38 - "Lyrics Service (Compiled)"
Cohesion: 0.83
Nodes (3): fetchLrclib(), getLyrics(), parseLrc()

## Knowledge Gaps
- **202 isolated node(s):** `electron_1`, `database_1`, `electron_1`, `fs`, `path` (+197 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SearchResult` connect `Search & YouTube DL` to `IPC & Services (Source)`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `Track` connect `IPC & Services (Source)` to `Database Layer (Source)`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `usePlayerStore` connect `Frontend UI Core` to `Data & Analytics Layer`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `electron_1`, `database_1`, `electron_1` to the rest of the system?**
  _202 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Core` be split into smaller, more focused modules?**
  _Cohesion score 0.07689873417721518 - nodes in this community are weakly interconnected._
- **Should `Data & Analytics Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.06531986531986532 - nodes in this community are weakly interconnected._
- **Should `Database Layer (Compiled)` be split into smaller, more focused modules?**
  _Cohesion score 0.08599290780141844 - nodes in this community are weakly interconnected._