import { useUIStore } from '@/store/uiStore';
import { usePlayerStore } from '@/store/playerStore';

export function TitleBar() {
  const { app } = (window as any).electronAPI || {};

  return (
    <div className="h-10 bg-[#0a0a0a] flex items-center justify-between px-3 select-none"
         style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
      </div>

      <div className="text-xs text-white/40 font-medium tracking-wider">
        FREE MUSIC PLAYER
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={() => app?.minimize()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>
        </button>
        <button
          onClick={() => app?.maximize()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
        </button>
        <button
          onClick={() => app?.close()}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/80 text-white/50 hover:text-white transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><line x1="0" y1="0" x2="10" y2="10"/><line x1="10" y1="0" x2="0" y2="10"/></svg>
        </button>
      </div>
    </div>
  );
}
