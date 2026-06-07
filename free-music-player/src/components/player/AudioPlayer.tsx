import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { mediaResolver } from '@/services/mediaResolver';
import { prefetchEngine } from '@/engine/prefetchEngine';
import { playbackController } from '@/engine/playbackController';

/**
 * AudioPlayer — HTML5 Audio driven by the mediaResolver service.
 *
 * Uses the `mediaResolver` service (which talks to the electron MediaResolver
 * through IPC) to get a same-origin proxy URL for the current track.
 *
 * Playback rules:
 *  - One source of truth: only the `canplay` listener (or the loadAndPlay
 *    fast-path) calls `audio.play()`. The `isPlaying` effect only handles
 *    pause, so a stale audio src can never be played by accident.
 *  - A `loadedVideoIdRef` tracks the youtubeId that the audio element is
 *    *actually* loaded with. Any play call is gated on this matching the
 *    current track — this prevents the race where the user changes tracks
 *    mid-load and we end up playing the old audio.
 *  - Prefetch cache is consulted before any IPC call so that the next
 *    track in the queue plays without the 6-second yt-dlp delay.
 *  - Progress is reported via the native `timeupdate` event (fires 4-66
 *    times/sec while playing) rather than a `setInterval` poll.
 *  - On resolve failure or audio error, the player advances to the next
 *    track instead of getting stuck silently.
 */
export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentVideoIdRef = useRef<string | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const pendingPlayRef = useRef(false);

  const errorCountRef = useRef(0);
  const errorWindowRef = useRef<number>(0);
  const playStartTimeRef = useRef<number>(0);
  const skipCircuitBreakerRef = useRef(false);
  const CIRCUIT_BREAKER_THRESHOLD = 3;
  const CIRCUIT_BREAKER_WINDOW_MS = 10_000;

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      // Guard: only auto-advance if the track actually played for > 2 seconds.
      // Premature "ended" from a broken stream is ~0s, not the actual end of a song.
      const playedMs = Date.now() - playStartTimeRef.current;
      if (playedMs > 2000) {
        usePlayerStore.getState().nextTrack();
      } else {
        console.warn('[AudioPlayer] Premature ended event (played', playedMs, 'ms) — ignoring to prevent skip chain');
      }
    });

    audio.addEventListener('error', (e) => {
      const err = e as ErrorEvent;
      console.error('[AudioPlayer] Audio error:', err.message, err.type);
      usePlayerStore.getState().setLoading(false);

      // Circuit breaker: if we've had too many consecutive errors,
      // stop trying to auto-advance and let the user intervene.
      const now = Date.now();
      if (now - errorWindowRef.current > CIRCUIT_BREAKER_WINDOW_MS) {
        errorCountRef.current = 0;
      }
      errorWindowRef.current = now;
      errorCountRef.current++;

      if (errorCountRef.current > CIRCUIT_BREAKER_THRESHOLD) {
        if (!skipCircuitBreakerRef.current) {
          skipCircuitBreakerRef.current = true;
          console.error('[AudioPlayer] Circuit breaker tripped — too many consecutive errors, stopping auto-advance');
          usePlayerStore.getState().setLoading(false);
        }
        return;
      }

      // Advance to the next track so the user isn't stuck on a broken track.
      // The 500ms delay lets React commit the loading state first.
      setTimeout(() => {
        if (usePlayerStore.getState().currentTrack?.youtubeId === currentVideoIdRef.current) {
          usePlayerStore.getState().nextTrack();
        }
      }, 500);
    });

    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      if (dur > 0 && Number.isFinite(dur)) {
        usePlayerStore.getState().setDuration(dur);
        // Keep the playbackController's duration in sync with the audio
        // element so syncFromEngine() reads the real value (not the
        // stale value frozen at the last play() call).
        playbackController.setDuration(dur);
      }
      usePlayerStore.getState().setLoading(false);
      playbackController.setLoading(false);
    });

    // Primary play trigger. Fires when the audio element has buffered enough
    // data to begin playback. We gate on the loaded videoId matching the
    // current track — otherwise a late `canplay` from a previous track
    // (e.g. user changed tracks mid-load) could start playing the wrong song.
    audio.addEventListener('canplay', () => {
      usePlayerStore.getState().setLoading(false);
      // Reset circuit breaker when a track is ready to play
      errorCountRef.current = 0;
      skipCircuitBreakerRef.current = false;
      if (
        pendingPlayRef.current &&
        loadedVideoIdRef.current === currentVideoIdRef.current &&
        usePlayerStore.getState().isPlaying
      ) {
        pendingPlayRef.current = false;
        audio.play().catch((err) => {
          console.error('[AudioPlayer] Deferred play failed:', err);
        });
      }
    });

    audio.addEventListener('playing', () => {
      usePlayerStore.getState().setLoading(false);
      playbackController.setLoading(false);
      // Track when playback actually starts for the ended-event guard
      playStartTimeRef.current = Date.now();
      // Reset circuit breaker on successful playback
      // (reset after 5 seconds to confirm the track is really playing)
      setTimeout(() => {
        errorCountRef.current = 0;
        skipCircuitBreakerRef.current = false;
      }, 5000);
    });

    audio.addEventListener('waiting', () => {
      usePlayerStore.getState().setLoading(true);
      playbackController.setLoading(true);
    });

    // Native `timeupdate` event — fires 4-66 times per second while audio
    // is playing. Automatically stops firing when the audio is paused, so
    // it doubles as a "is playing" check. No polling needed.
    audio.addEventListener('timeupdate', () => {
      if (loadedVideoIdRef.current !== currentVideoIdRef.current) return;
      const time = audio.currentTime;
      // Mirror into the playbackController so syncFromEngine() — called by
      // shuffle, repeat, volume, mute, etc. — reads the real position
      // instead of the stale value frozen at the last play()/seek().
      // Without this, the store's progress would be reset to 0 on every
      // sync, causing the seek effect to rewind the track to 0.
      playbackController.setProgress(time);
      usePlayerStore.getState().setProgress(time);
    });

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Load & play when track changes
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack?.youtubeId) {
      currentVideoIdRef.current = null;
      loadedVideoIdRef.current = null;
      audio.pause();
      audio.src = '';
      return;
    }

    const videoId = currentTrack.youtubeId;
    if (currentVideoIdRef.current === videoId) return;
    currentVideoIdRef.current = videoId;

    // ── Critical: stop the old audio NOW, synchronously. ──
    // If we wait until after `mediaResolver.resolve` (which can take up
    // to 6s on a cache miss), the user hears the previous track playing
    // while the UI already shows the new one. That's the "everything
    // desyncs" bug. Pause + clear the loaded ref so the timeupdate
    // handler stops reporting progress for the old track.
    audio.pause();
    loadedVideoIdRef.current = null;

    let cancelled = false;

    const loadAndPlay = async () => {
      usePlayerStore.getState().setLoading(true);
      pendingPlayRef.current = true;

      // 1) Prefetch cache first — this is the fast path. If the next track
      //    was prefetched while the previous one was playing, we skip the
      //    6-second yt-dlp resolve entirely.
      let source = prefetchEngine.getSource(videoId);

      // 2) Fall back to the IPC resolve (which itself is cache-aware on
      //    the main process — so even without a renderer-side prefetch,
      //    a second resolve for the same videoId is instant).
      //    Pass track metadata for auto-recovery when the video is unavailable.
      if (!source) {
        source = await mediaResolver.resolve(videoId, {
          artist: currentTrack.artist,
          title: currentTrack.title,
        });
      }

      if (cancelled) return;

      if (!source) {
        console.error('[AudioPlayer] Failed to resolve media for:', videoId);
        usePlayerStore.getState().setLoading(false);
        pendingPlayRef.current = false;

        // Circuit breaker: track consecutive resolve failures
        const now = Date.now();
        if (now - errorWindowRef.current > CIRCUIT_BREAKER_WINDOW_MS) {
          errorCountRef.current = 0;
        }
        errorWindowRef.current = now;
        errorCountRef.current++;

        if (errorCountRef.current > CIRCUIT_BREAKER_THRESHOLD) {
          if (!skipCircuitBreakerRef.current) {
            skipCircuitBreakerRef.current = true;
            console.error('[AudioPlayer] Circuit breaker tripped — too many resolve failures, stopping auto-advance');
          }
          return;
        }

        // Auto-advance on resolve failure so the user isn't stuck.
        setTimeout(() => {
          if (usePlayerStore.getState().currentTrack?.youtubeId === videoId) {
            usePlayerStore.getState().nextTrack();
          }
        }, 500);
        return;
      }

      // If the user wanted to play, kick it off. The `canplay` listener
      // (or the fast-path below if the data is already buffered) will
      // call audio.play().
      audio.pause();
      audio.src = source.audioUrl;
      loadedVideoIdRef.current = videoId;
      audio.load();

      // Fast path: if the audio is already buffered enough to play,
      // start it immediately. Otherwise wait for `canplay`.
      if (audio.readyState >= 3 && usePlayerStore.getState().isPlaying) {
        pendingPlayRef.current = false;
        audio.play().catch((err) => {
          console.error('[AudioPlayer] Play failed:', err);
        });
      }
    };

    loadAndPlay();

    return () => {
      cancelled = true;
      // Clear pending play so a late `canplay` for the old src can't fire.
      pendingPlayRef.current = false;
    };
  }, [currentTrack?.youtubeId]);

  // Play/Pause sync — only handles pause. Playback initiation is owned by
  // `loadAndPlay` (via the `canplay` listener / fast path). This avoids the
  // race where the isPlaying effect would call `audio.play()` on a stale
  // src while a new track is still being resolved.
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      // The audio is already loaded and the user wants to play (e.g. they
      // pressed play after a pause on the same track).
      if (
        audio.src &&
        loadedVideoIdRef.current === currentVideoIdRef.current &&
        audio.readyState >= 3
      ) {
        audio.play().catch(() => {});
      } else {
        // Audio isn't ready yet — defer play to the `canplay` listener.
        pendingPlayRef.current = true;
      }
    } else {
      audio.pause();
      pendingPlayRef.current = false;
    }
  }, [isPlaying]);

  // Volume sync
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Seek sync — only react to user-driven seeks, not the progress interval.
  // The progress interval now writes via `timeupdate` (which doesn't change
  // the store in a way that would re-trigger this effect more than once per
  // ~100ms). We use a 2s debounce window to be safe.
  const progress = usePlayerStore((s) => s.progress);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentVideoIdRef.current) return;

    // Skip if we're mid-track-change. During a skip, the store's progress
    // jumps to 0 and the audio's currentTime is still the old track's
    // position — seeking here would rewind the OLD audio, which is exactly
    // the desync symptom. The new track's load will set loadedVideoIdRef
    // and the seek logic kicks in normally afterwards.
    if (loadedVideoIdRef.current !== currentVideoIdRef.current) return;

    // Only seek if the user explicitly changed progress (e.g. clicked the
    // progress bar) — the timeupdate event also calls setProgress, but
    // those updates are within ~0.5s of the audio's current time, so this
    // diff-check already filters them out.
    if (Math.abs(audio.currentTime - progress) > 2) {
      audio.currentTime = progress;
    }
  }, [progress]);

  return null;
}
