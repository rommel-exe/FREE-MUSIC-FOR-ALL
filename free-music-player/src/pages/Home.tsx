import { useLibraryStore } from '@/store/libraryStore';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

export function HomePage() {
  const tracks = useLibraryStore((s) => s.tracks);
  const playTracks = usePlayerStore((s) => s.playTracks);
  const setPage = useUIStore((s) => s.setPage);

  const recentlyPlayed = tracks.slice(0, 6);
  const topTracks = [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 10);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Good evening</h1>
        <p className="text-white/50">Your music, your way</p>
      </div>

      {/* Quick picks */}
      {recentlyPlayed.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Recently Played</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {recentlyPlayed.map((track, i) => (
              <button
                key={track.id}
                onClick={() => playTracks(recentlyPlayed, i)}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-md overflow-hidden transition-colors group"
              >
                <div className="w-12 h-12 flex-shrink-0 bg-white/10">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left px-3">
                  <div className="text-sm font-medium text-white truncate">{track.title}</div>
                  <div className="text-xs text-white/50 truncate">{track.artist}</div>
                </div>
                <div className="pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Top tracks */}
      {topTracks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Your Top Songs</h2>
          <div className="space-y-1">
            {topTracks.map((track, i) => (
              <button
                key={track.id}
                onClick={() => playTracks(topTracks, i)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors group"
              >
                <span className="w-6 text-sm text-white/30 text-right tabular-nums">{i + 1}</span>
                <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 overflow-hidden">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-white truncate">{track.title}</div>
                  <div className="text-xs text-white/50 truncate">{track.artist}</div>
                </div>
                <span className="text-xs text-white/30 tabular-nums">{track.playCount} plays</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tracks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Start listening</h2>
          <p className="text-white/50 mb-4">Search for songs to build your library</p>
          <button
            onClick={() => setPage('search')}
            className="px-6 py-2.5 bg-white text-black font-semibold rounded-full hover:scale-105 transition-transform"
          >
            Search Music
          </button>
        </div>
      )}
    </div>
  );
}
