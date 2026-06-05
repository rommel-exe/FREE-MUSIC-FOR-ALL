import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

interface ShortcutHandlers {
  onSearchFocus?: () => void;
}

export function useKeyboardShortcuts(handlers?: ShortcutHandlers) {
  const {
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume,
    volume,
    toggleShuffle,
    cycleRepeat,
    currentTrack,
  } = usePlayerStore(
    useShallow((s) => ({
      togglePlay: s.togglePlay,
      nextTrack: s.nextTrack,
      previousTrack: s.previousTrack,
      setVolume: s.setVolume,
      volume: s.volume,
      toggleShuffle: s.toggleShuffle,
      cycleRepeat: s.cycleRepeat,
      currentTrack: s.currentTrack,
    })),
  );

  const { toggleQueue, setPage } = useUIStore(
    useShallow((s) => ({ toggleQueue: s.toggleQueue, setPage: s.setPage })),
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Cmd/Ctrl + key shortcuts (work everywhere)
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          setPage('search');
          handlers?.onSearchFocus?.();
          return;
        case 'ArrowRight':
          e.preventDefault();
          nextTrack();
          return;
        case 'ArrowLeft':
          e.preventDefault();
          previousTrack();
          return;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          return;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          return;
        case 'l':
        case 'L':
          e.preventDefault();
          if (currentTrack) {
            // Toggle favorite - dispatched via custom event
            window.dispatchEvent(new CustomEvent('toggle-favorite', { detail: currentTrack.id }));
          }
          return;
        case 'r':
        case 'R':
          e.preventDefault();
          cycleRepeat();
          return;
        case 's':
        case 'S':
          e.preventDefault();
          toggleShuffle();
          return;
        case 'q':
        case 'Q':
          e.preventDefault();
          toggleQueue();
          return;
      }
    }

    // Space bar (only when not typing in an input)
    if (e.key === ' ' && !isInput) {
      e.preventDefault();
      togglePlay();
      return;
    }
  }, [togglePlay, nextTrack, previousTrack, setVolume, volume, toggleShuffle, cycleRepeat, currentTrack, toggleQueue, setPage, handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
