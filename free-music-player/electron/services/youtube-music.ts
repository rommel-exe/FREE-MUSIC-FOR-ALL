import YTMusic from 'ytmusic-api';
import type {
  YTMusicSearchResult,
  YTMusicSong,
  YTMusicAlbum,
  YTMusicArtist,
  YTMusicPlaylist,
} from '../utils/types';

// Singleton – call initialize() once before use.
let client: InstanceType<typeof YTMusic> | null = null;

async function getClient(): Promise<InstanceType<typeof YTMusic>> {
  if (!client) {
    client = new YTMusic();
    await client.initialize();
  }
  return client;
}

// ─── search ─────────────────────────────────────────────────────────────

export async function search(
  query: string,
  filter: 'songs' | 'videos' | 'albums' | 'artists' = 'songs',
): Promise<YTMusicSearchResult[]> {
  try {
    const yt = await getClient();

    let results: any[];
    switch (filter) {
      case 'songs':
        results = await yt.searchSongs(query);
        break;
      case 'videos':
        results = await yt.searchVideos(query);
        break;
      case 'albums':
        results = await yt.searchAlbums(query);
        break;
      case 'artists':
        results = await yt.searchArtists(query);
        break;
      default:
        results = await yt.search(query);
    }

    return (results || []).map((item: any): YTMusicSearchResult => {
      const id = item.videoId || item.playlistId || item.browseId || item.albumId || '';
      return {
        id,
        title: item.name || item.title || '',
        artist: item.artist?.name || '',
        album: item.album?.name || '',
        duration: typeof item.duration === 'number' ? item.duration : 0,
        thumbnails: (item.thumbnails || []).map((t: any) => ({
          url: t.url || '',
          width: t.width || 0,
          height: t.height || 0,
        })),
        type: item.type || 'song',
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`YouTube Music search failed: ${message}`);
  }
}

// ─── getSong ────────────────────────────────────────────────────────────

export async function getSong(id: string): Promise<YTMusicSong> {
  try {
    const yt = await getClient();
    const song = await yt.getSong(id);

    return {
      id: song.videoId || id,
      title: song.name || '',
      artist: song.artist?.name || '',
      album: '',
      duration: typeof song.duration === 'number' ? song.duration : 0,
      thumbnails: (song.thumbnails || []).map((t: any) => ({
        url: t.url || '',
        width: t.width || 0,
        height: t.height || 0,
      })),
      year: '',
      likeStatus: '',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get song ${id}: ${message}`);
  }
}

// ─── getAlbum ───────────────────────────────────────────────────────────

export async function getAlbum(id: string): Promise<YTMusicAlbum> {
  try {
    const yt = await getClient();
    const album = await yt.getAlbum(id);

    return {
      id: album.albumId || id,
      title: album.name || '',
      artist: album.artist?.name || '',
      year: String(album.year || ''),
      thumbnails: (album.thumbnails || []).map((t: any) => ({
        url: t.url || '',
        width: t.width || 0,
        height: t.height || 0,
      })),
      tracks: (album.songs || []).map((t: any): YTMusicSong => ({
        id: t.videoId || '',
        title: t.name || '',
        artist: t.artist?.name || album.artist?.name || '',
        album: album.name || '',
        duration: typeof t.duration === 'number' ? t.duration : 0,
        thumbnails: (t.thumbnails || []).map((th: any) => ({
          url: th.url || '',
          width: th.width || 0,
          height: th.height || 0,
        })),
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get album ${id}: ${message}`);
  }
}

// ─── getArtist ──────────────────────────────────────────────────────────

export async function getArtist(id: string): Promise<YTMusicArtist> {
  try {
    const yt = await getClient();
    const artist = await yt.getArtist(id);

    return {
      id: artist.artistId || id,
      name: artist.name || '',
      thumbnails: (artist.thumbnails || []).map((t: any) => ({
        url: t.url || '',
        width: t.width || 0,
        height: t.height || 0,
      })),
      description: '',
      subscribers: '',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get artist ${id}: ${message}`);
  }
}

// ─── getPlaylist ────────────────────────────────────────────────────────

export async function getPlaylist(id: string): Promise<YTMusicPlaylist> {
  try {
    const yt = await getClient();
    const playlist = await yt.getPlaylist(id);

    return {
      id: playlist.playlistId || id,
      title: playlist.name || '',
      description: '',
      thumbnails: (playlist.thumbnails || []).map((t: any) => ({
        url: t.url || '',
        width: t.width || 0,
        height: t.height || 0,
      })),
      trackCount: playlist.videoCount || 0,
      tracks: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get playlist ${id}: ${message}`);
  }
}

// ─── getHome ────────────────────────────────────────────────────────────

export async function getHome(): Promise<{ title: string; items: YTMusicSearchResult[] }[]> {
  try {
    const yt = await getClient();
    const home = await yt.getHomeSections();

    return (home || []).map((section: any) => ({
      title: section.title || '',
      items: (section.content || section.items || []).map((item: any): YTMusicSearchResult => ({
        id: item.videoId || item.playlistId || item.browseId || '',
        title: item.name || item.title || '',
        artist: item.artist?.name || '',
        duration: typeof item.duration === 'number' ? item.duration : 0,
        thumbnails: (item.thumbnails || []).map((t: any) => ({
          url: t.url || '',
          width: t.width || 0,
          height: t.height || 0,
        })),
        type: item.type || 'song',
      })),
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get home: ${message}`);
  }
}
