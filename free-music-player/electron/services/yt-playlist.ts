/**
 * YouTube playlist import using yt-dlp (reliable, actively maintained).
 */

let ytExec: any = null;

async function getYtExec() {
  if (!ytExec) {
    const youtubedl = (await import('youtube-dl-exec')) as any;
    const YT_DLP_PATH = '/Users/jackfu/Library/Python/3.9/bin/yt-dlp';
    const createFn = youtubedl.create || youtubedl.default?.create;
    if (createFn) {
      ytExec = createFn(YT_DLP_PATH);
    } else {
      ytExec = youtubedl.default || youtubedl;
    }
  }
  return ytExec;
}

export async function importPlaylist(url: string) {
  const yt = await getYtExec();

  const result = await yt(url, {
    dumpSingleJson: true as any,
    noWarnings: true,
    quiet: true,
    noCheckCertificates: true,
    flatPlaylist: true as any,
  });

  const data = typeof result === 'string' ? JSON.parse(result) : result;

  if (!data || !data.entries) {
    throw new Error('No tracks found in this playlist');
  }

  return {
    name: data.title || 'Imported YouTube Playlist',
    description: data.description || '',
    thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || '',
    tracks: (data.entries || []).map((entry: any) => {
      let artist = entry.uploader || entry.channel || '';
      let title = entry.title || '';
      if (title.includes(' - ')) {
        const parts = title.split(' - ');
        artist = artist || parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      }
      return {
        title,
        artist,
        duration: entry.duration || 0,
        videoId: entry.id || '',
        thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || '',
      };
    }),
  };
}

export function parseYouTubeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const list = u.searchParams.get('list');
      if (list) return list;
    }
    return null;
  } catch {
    return null;
  }
}
