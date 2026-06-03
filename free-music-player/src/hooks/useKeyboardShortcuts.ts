import { useEffect, useCallback } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';

export function useKeyboardShortcuts() {
  const { togglePlay, nextTrack, previousTrack, seek, setVolume, volume, toggleMute, toggleShuffle, cycleRepeat } = usePlayerStore();
  const { toggleQueue, isFullPlayerOpen, setFullPlayerOpen, closeModal, modalOpen } = useUIStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seek(Math.max(0, usePlayerStore.getState().progress - 5));
        break;
      case 'ArrowRight':
        e.preventDefault();
        seek(usePlayerStore.getState().progress + 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setVolume(Math.min(1, volume + 0.05));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setVolume(Math.max(0, volume - 0.05));
        break;
      case 'n':
      case 'N':
        nextTrack();
        break;
      case 'p':
      case 'P':
        previousTrack();
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 's':
      case 'S':
        if (!e.ctrlKey && !e.metaKey) toggleShuffle();
        break;
      case 'r':
      case 'R':
        if (!e.ctrlKey && !e.metaKey) cycleRepeat();
        break;
      case 'q':
      case 'Q':
        if (!e.ctrlKey && !e.metaKey) toggleQueue();
        break;
      case 'f':
      case 'F':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
        } else {
          setFullPlayerOpen(!isFullPlayerOpen);
        }
        break;
      case 'Escape':
        if (modalOpen) closeModal();
        else if (isFullPlayerOpen) setFullPlayerOpen(false);
        break;
    }
  }, [togglePlay, nextTrack, previousTrack, seek, setVolume, volume, toggleMute, toggleShuffle, cycleRepeat, toggleQueue, isFullPlayerOpen, setFullPlayerOpen, closeModal, modalOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
