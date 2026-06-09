import { useUIStore } from '@/store/uiStore';
import { usePlayerStore } from '@/store/playerStore';

export function TitleBar() {
  const { app } = (window as any).electronAPI || {};

  return (
    <div className="h-mac-titlebar drag-region flex items-center justify-center px-3 select-none">
      <div className="text-xs text-white/40 font-medium tracking-wider">
        FREE MUSIC PLAYER
      </div>
    </div>
  );
}
