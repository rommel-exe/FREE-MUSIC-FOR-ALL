import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useEQStore } from '@/store/eqStore';
import { ipc } from '@/utils/ipc';

/**
 * AudioPlayer — HTML5 audio backed by the custom `stream://` protocol,
 * routed through a Web Audio API EQ chain (5-band biquad filters).
 *
 * Flow:
 *   1. Renderer asks main for the stream URL via `ipc.search.getLocalStreamPath(videoId)`
 *   2. Main runs yt-dlp to download audio to /tmp/freemusic-<id>.m4a (≈6 sec)
 *   3. Main returns the `stream://<videoId>` URL
 *   4. Renderer plays it in an HTML5 <audio> element
 *   5. The audio element is tapped via createMediaElementSource and routed through
 *      a chain of 5 biquad filters (Bass → Low-Mid → Mid → High-Mid → Treble) +
 *      a preamp gain, then to the destination (speakers)
 *
 * EQ changes from the eqStore are applied live without reloading the audio.
 * The 6-second YouTube sleep is unavoidable but a "Loading..." state is shown.
 */
export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamUrlRef = useRef<string | null>(null);
  const loadingVideoIdRef = useRef<string | null>(null);
  // Analytics: id of the play_history row for the currently-playing track
  const currentHistoryIdRef = useRef<number | null>(null);
  const playStartedAtRef = useRef<number>(0);

  // Web Audio API graph refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const preampGainRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const lowMidFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const highMidFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const eqBypassGainRef = useRef<GainNode | null>(null);

  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    progress,
    seekRequest,
    setProgress,
    setDuration,
    setLoading,
    nextTrack,
  } = usePlayerStore();

  const { enabled: eqEnabled, bands: eqBands } = useEQStore();

  // Refs for latest values
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const eqEnabledRef = useRef(eqEnabled);
  const eqBandsRef = useRef(eqBands);
  isPlayingRef.current = isPlaying;
  volumeRef.current = volume;
  isMutedRef.current = isMuted;
  eqEnabledRef.current = eqEnabled;
  eqBandsRef.current = eqBands;

  // ─── Build the Web Audio API graph (once, guarded against StrictMode) ──
  const graphBuiltRef = useRef(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Guard against React 18 StrictMode double-mount: createMediaElementSource
    // can only be called ONCE per HTMLAudioElement, otherwise it throws.
    if (graphBuiltRef.current || sourceNodeRef.current) {
      console.log('[AudioPlayer] Graph already built, skipping');
      return;
    }
    graphBuiltRef.current = true;

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      audioContextRef.current = ctx;

      // Create source from the <audio> element
      const source = ctx.createMediaElementSource(audio);
      sourceNodeRef.current = source;

      // Preamp gain (master volume trim for EQ)
      const preamp = ctx.createGain();
      preamp.gain.value = 1;
      preampGainRef.current = preamp;

      // 5 biquad filters at standard frequency bands
      // - Bass (60 Hz): lowshelf
      // - Low-Mid (250 Hz): peaking
      // - Mid (1 kHz): peaking
      // - High-Mid (4 kHz): peaking
      // - Treble (12 kHz): highshelf
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 60;
      bass.gain.value = 0;
      bassFilterRef.current = bass;

      const lowMid = ctx.createBiquadFilter();
      lowMid.type = 'peaking';
      lowMid.frequency.value = 250;
      lowMid.Q.value = 1.0;
      lowMid.gain.value = 0;
      lowMidFilterRef.current = lowMid;

      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1000;
      mid.Q.value = 1.0;
      mid.gain.value = 0;
      midFilterRef.current = mid;

      const highMid = ctx.createBiquadFilter();
      highMid.type = 'peaking';
      highMid.frequency.value = 4000;
      highMid.Q.value = 1.0;
      highMid.gain.value = 0;
      highMidFilterRef.current = highMid;

      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 12000;
      treble.gain.value = 0;
      trebleFilterRef.current = treble;

      // Bypass path: a single gain node at gain=1 that, when EQ is disabled,
      // carries the audio around the filter chain
      const bypass = ctx.createGain();
      bypass.gain.value = 0; // start with EQ in the signal path
      eqBypassGainRef.current = bypass;

      // EQ path
      const eqThrough = ctx.createGain();
      eqThrough.gain.value = 1; // start with EQ active

      // Wire the graph:
      //   source → preamp → [bass → lowMid → mid → highMid → treble] (eq path)
      //                       ↘ bypass path
      //   both paths → destination
      source.connect(preamp);

      // EQ path
      preamp.connect(bass);
      bass.connect(lowMid);
      lowMid.connect(mid);
      mid.connect(highMid);
      highMid.connect(treble);
      treble.connect(eqThrough);
      eqThrough.connect(ctx.destination);

      // Bypass path (just passes through at gain 0 by default)
      preamp.connect(bypass);
      bypass.connect(ctx.destination);

      console.log('[AudioPlayer] Web Audio API graph initialized');
    } catch (err) {
      console.error('[AudioPlayer] Failed to build Web Audio graph:', err);
    }

    return () => {
      // Don't tear down the graph in cleanup — React 18 StrictMode re-runs
      // effects in dev, and createMediaElementSource can only be called once
      // per <audio> element. The graph lives for the component's lifetime
      // and the browser cleans up when the page unloads.
    };
  }, []);

  // ─── Apply EQ changes live ────────────────────────────────────────────
  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Map preamp dB (-12 to +12) to a linear gain (0.25 to 4)
    // 10^(dB/20) — but we also want to keep a sensible range
    const preampLinear = Math.pow(10, eqBands.preamp / 20);
    if (preampGainRef.current) {
      preampGainRef.current.gain.setTargetAtTime(preampLinear, ctx.currentTime, 0.02);
    }
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(eqBands.bass, ctx.currentTime, 0.02);
    }
    if (lowMidFilterRef.current) {
      lowMidFilterRef.current.gain.setTargetAtTime(eqBands.lowMid, ctx.currentTime, 0.02);
    }
    if (midFilterRef.current) {
      midFilterRef.current.gain.setTargetAtTime(eqBands.mid, ctx.currentTime, 0.02);
    }
    if (highMidFilterRef.current) {
      highMidFilterRef.current.gain.setTargetAtTime(eqBands.highMid, ctx.currentTime, 0.02);
    }
    if (trebleFilterRef.current) {
      trebleFilterRef.current.gain.setTargetAtTime(eqBands.treble, ctx.currentTime, 0.02);
    }

    // Toggle bypass vs EQ path
    if (eqBypassGainRef.current) {
      eqBypassGainRef.current.gain.setTargetAtTime(eqEnabled ? 0 : 1, ctx.currentTime, 0.02);
    }

    console.log(`[AudioPlayer] EQ ${eqEnabled ? 'ON' : 'OFF'} — bands:`, JSON.stringify(eqBands));
  }, [eqEnabled, eqBands]);

  // ─── Resolve stream URL when track changes ───────────────────────────
  useEffect(() => {
    if (!currentTrack) {
      streamUrlRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
      // End any pending analytics play session
      endCurrentPlayIfAny(0, false);
      return;
    }

    const videoId = currentTrack.youtubeId;

    if (!videoId) {
      console.warn('[AudioPlayer] Track has no youtubeId, cannot play');
      return;
    }

    // Skip if same as already loaded
    if (streamUrlRef.current && streamUrlRef.current.includes(videoId)) {
      console.log('[AudioPlayer] Same video, just play/pause');
      return;
    }

    loadingVideoIdRef.current = videoId;
    setLoading(true);
    console.log(`[AudioPlayer] Resolving stream URL for: ${videoId}`);

    (async () => {
      try {
        const url = await ipc.search.getLocalStreamPath(videoId);
        if (loadingVideoIdRef.current !== videoId) {
          console.log('[AudioPlayer] Track changed during load, discarding');
          return;
        }
        console.log(`[AudioPlayer] Got stream URL: ${url}`);
        streamUrlRef.current = url;
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
          // Resume the audio context if it was suspended (Chromium auto-suspends)
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }
          if (isPlayingRef.current) {
            // Record analytics: this is when the user actually starts listening
            const trackId = currentTrack.id || videoId;
            const trackDuration = currentTrack.duration || 0;
            try {
              const historyId = await ipc.analytics.startPlay(trackId, trackDuration);
              currentHistoryIdRef.current = historyId;
              playStartedAtRef.current = Date.now();
              console.log(`[AudioPlayer] Analytics: started play #${historyId} for ${trackId}`);
            } catch (e) {
              console.warn('[AudioPlayer] analytics:startPlay failed:', e);
            }
            try {
              await audioRef.current.play();
              console.log('[AudioPlayer] Playback started');
            } catch (e) {
              console.error('[AudioPlayer] play() failed:', e);
            }
          }
        }
      } catch (err: any) {
        console.error(`[AudioPlayer] Failed to resolve stream URL for ${videoId}:`, err);
        setTimeout(() => nextTrack(), 1000);
      } finally {
        if (loadingVideoIdRef.current === videoId) {
          setLoading(false);
        }
      }
    })();
  }, [currentTrack?.id, currentTrack?.youtubeId]);

  /**
   * Mark the current play session as ended. Safe to call multiple times.
   * The `secondsPlayed` is the actual elapsed listening time, not the song length.
   */
  function endCurrentPlayIfAny(secondsPlayed: number, completed: boolean) {
    const id = currentHistoryIdRef.current;
    if (id == null) return;
    currentHistoryIdRef.current = null;
    ipc.analytics.endPlay(id, Math.max(0, Math.floor(secondsPlayed)), completed).catch((e) => {
      console.warn('[AudioPlayer] analytics:endPlay failed:', e);
    });
  }

  // ─── React to play/pause ──────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      // Resume the audio context (browser auto-suspends on user gesture requirements)
      audioContextRef.current?.resume().catch(() => {});
      if (audio.src) {
        audio.play().catch((e) => console.error('[AudioPlayer] play() failed:', e));
      }
    } else {
      audio.pause();
      // Analytics: end the play session on pause. The user stopped listening.
      const played = audio.currentTime || 0;
      const dur = audio.duration || 0;
      const completed = dur > 0 && played >= dur * 0.95;
      endCurrentPlayIfAny(played, completed);
    }
  }, [isPlaying]);

  // ─── React to volume/mute ─────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // ─── React to seek requests ───────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!seekRequest || !audio) return;
    try {
      audio.currentTime = seekRequest.time;
    } catch (e) {
      console.error('[AudioPlayer] seek failed:', e);
    }
  }, [seekRequest]);

  // ─── Audio event handlers ─────────────────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) setProgress(audio.currentTime);
  }, [setProgress]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      console.log(`[AudioPlayer] Loaded metadata, duration: ${audio.duration}s`);
      setDuration(audio.duration || 0);
    }
  }, [setDuration]);

  const handleEnded = useCallback(() => {
    console.log('[AudioPlayer] Track ended, playing next');
    // Analytics: ended naturally → completed
    const audio = audioRef.current;
    if (audio) endCurrentPlayIfAny(audio.duration || 0, true);
    nextTrack();
  }, [nextTrack]);

  const handleError = useCallback((_e: any) => {
    console.error('[AudioPlayer] Audio error');
    // Analytics: errored out → not completed
    endCurrentPlayIfAny(0, false);
    setTimeout(() => nextTrack(), 500);
  }, [nextTrack]);

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      onError={handleError}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
