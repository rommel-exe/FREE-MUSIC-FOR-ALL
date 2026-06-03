import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { ipc } from '@/utils/ipc';

// ─── YouTube IFrame Player API types ────────────────────────────────────
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let apiReady = false;
let apiReadyPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiReady) return Promise.resolve();
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve) => {
    const existing = document.getElementById('youtube-iframe-api');
    if (existing) {
      // Already loading
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        apiReady = true;
        resolve();
      };
      return;
    }

    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    // YouTube IFrame Player API is only available at youtube.com/iframe_api
    // (not youtube-nocookie.com — that path returns 404)
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      resolve();
    };
  });

  return apiReadyPromise;
}

/**
 * YouTubePlayer component — uses the YouTube IFrame Player API for instant
 * audio streaming. No yt-dlp, no file downloads, no 6-second YouTube sleep.
 * Streams directly from YouTube's CDN via an invisible iframe.
 */
export function YouTubePlayer() {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const readyCheckIntervalRef = useRef<any>(null);

  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    seekRequest,
    setProgress,
    setDuration,
    nextTrack,
  } = usePlayerStore();

  // Refs for latest values in callbacks
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  isPlayingRef.current = isPlaying;
  volumeRef.current = volume;
  isMutedRef.current = isMuted;

  // ─── Initialize YouTube player ───────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    loadYouTubeAPI().then(() => {
      if (!mounted || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
          // CRITICAL: Set the origin to match the parent window. Without this,
          // YouTube's iframe postMessage fails with origin mismatch errors,
          // which break play/pause/seek commands and event delivery.
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            console.log('[YT Player] Ready, origin:', window.location.origin);
            // Try to play immediately if a track was queued before ready
            if (currentVideoIdRef.current) {
              try { event.target.loadVideoById(currentVideoIdRef.current); } catch {}
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            console.log('[YT Player] State change:', event.data);
            if (event.data === 0) {
              console.log('[YT Player] Track ended, playing next');
              nextTrack();
            } else if (event.data === 1) {
              // Playing — update duration
              const dur = playerRef.current.getDuration();
              if (dur > 0) setDuration(dur);
            } else if (event.data === 3) {
              // Buffering
              console.log('[YT Player] Buffering...');
            } else if (event.data === -1) {
              // Unstarted — sometimes happens if autoplay is blocked
              console.log('[YT Player] Unstarted, attempting playVideo()');
              try { playerRef.current.playVideo(); } catch {}
            }
          },
          onError: (event: any) => {
            console.error('[YT Player] Error code:', event.data, '-',
              event.data === 2 ? 'INVALID_ID' :
              event.data === 5 ? 'NOT_PLAYABLE_IN_HTML5' :
              event.data === 100 ? 'NOT_FOUND' :
              event.data === 101 ? 'NOT_ALLOWED_EMBED' :
              event.data === 150 ? 'NOT_ALLOWED_EMBED' : 'UNKNOWN');
          },
        },
      });
    });

    // Poll for progress updates (YouTube API doesn't push time updates)
    const progressInterval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        try {
          const time = playerRef.current.getCurrentTime();
          if (typeof time === 'number' && time > 0) {
            setProgress(time);
          }
        } catch {
          // Player not ready yet
        }
      }
    }, 500);

    return () => {
      mounted = false;
      clearInterval(progressInterval);
      if (readyCheckIntervalRef.current) {
        clearInterval(readyCheckIntervalRef.current);
      }
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
      }
    };
  }, []);

  // ─── Load video when track changes ───────────────────────────────────
  useEffect(() => {
    if (!currentTrack) {
      currentVideoIdRef.current = null;
      if (playerRef.current && playerRef.current.stopVideo) {
        try { playerRef.current.stopVideo(); } catch {}
      }
      return;
    }

    const loadTrack = async (videoId: string) => {
      if (!playerRef.current || !playerRef.current.loadVideoById) {
        // Player not ready yet, wait
        setTimeout(() => loadTrack(videoId), 100);
        return;
      }
      if (currentVideoIdRef.current === videoId) return;
      currentVideoIdRef.current = videoId;

      console.log(`[YT Player] Loading video: ${videoId}`);
      playerRef.current.loadVideoById(videoId);
    };

    const resolveAndLoad = async () => {
      let videoId = currentTrack.youtubeId;

      // If no youtubeId, search YouTube
      if (!videoId && currentTrack.title && currentTrack.artist) {
        console.log(`[YT Player] Searching YouTube for: ${currentTrack.title} - ${currentTrack.artist}`);
        const results = await ipc.search.searchYouTube(`${currentTrack.title} ${currentTrack.artist}`, 1);
        if (results && results.length > 0) {
          videoId = results[0].id;
        }
      }

      if (videoId) {
        loadTrack(videoId);
      } else {
        console.error('[YT Player] No videoId found for track');
      }
    };

    resolveAndLoad();
  }, [currentTrack]);

  // ─── React to play/pause ──────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current) {
      console.log('[YT Player] play/pause effect: player not ready yet, isPlaying=', isPlaying);
      return;
    }
    if (isPlaying) {
      console.log('[YT Player] Calling playVideo()');
      try {
        playerRef.current.playVideo();
        // Verify the player is actually playing within 2 seconds
        setTimeout(() => {
          try {
            const state = playerRef.current.getPlayerState();
            console.log('[YT Player] State after playVideo:', state, '(1=playing, 2=paused, 3=buffering)');
            if (state === 2) {
              // Player refused to play (likely autoplay policy or embed block)
              console.warn('[YT Player] Player paused after playVideo() call — possible autoplay block');
            }
          } catch (e) { console.warn('[YT Player] getPlayerState failed:', e); }
        }, 2000);
      } catch (e) { console.error('[YT Player] playVideo failed:', e); }
    } else {
      try { playerRef.current.pauseVideo(); } catch (e) { console.error('[YT Player] pauseVideo failed:', e); }
    }
  }, [isPlaying]);

  // ─── React to volume/mute ─────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setVolume(isMuted ? 0 : Math.round(volume * 100));
    } catch {}
  }, [volume, isMuted]);

  // ─── React to seek requests ───────────────────────────────────────────
  useEffect(() => {
    if (!seekRequest || !playerRef.current) return;
    try {
      playerRef.current.seekTo(seekRequest.time, true);
    } catch (e) { console.error('[YT Player] seekTo failed:', e); }
  }, [seekRequest]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: '-9999px',
        left: '-9999px',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
