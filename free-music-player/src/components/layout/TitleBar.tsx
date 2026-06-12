import { Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function TitleBar() {
  const { theme, toggleTheme } = useUIStore();
  const { app } = (window as any).electronAPI || {};

  return (
    <div className="h-titlebar drag-region flex items-center select-none relative z-30 bg-groove-900">
      {/* ── Traffic lights (left) ── */}
      <div className="no-drag flex items-center gap-[6px] pl-2">
        <button
          className="w-3 h-3 rounded-full bg-[#FF5F57] border-[0.5px] border-black/10 active:opacity-80"
          onClick={() => app?.quit?.()}
          title="Close"
        />
        <button
          className="w-3 h-3 rounded-full bg-[#FEBC2E] border-[0.5px] border-black/10 active:opacity-80"
          onClick={() => app?.minimize?.()}
          title="Minimize"
        />
        <button
          className="w-3 h-3 rounded-full bg-[#28C840] border-[0.5px] border-black/10 active:opacity-80"
          onClick={() => app?.maximize?.()}
          title="Maximize"
        />
      </div>

      {/* ── Center title ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-mac-caption text-groove-300 font-medium tracking-wider select-none">
          FREE MUSIC PLAYER
        </span>
      </div>

      {/* ── Theme toggle (right) ── */}
      <div className="no-drag ml-auto pr-2">
        <button
          onClick={toggleTheme}
          className="w-[18px] h-[18px] flex items-center justify-center rounded-md text-groove-300 hover:text-emerald hover:bg-white/[0.06] transition-colors duration-150"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Moon className="w-[15px] h-[15px]" strokeWidth={1.8} />
          ) : (
            <Sun className="w-[15px] h-[15px]" strokeWidth={1.8} />
          )}
        </button>
      </div>
    </div>
  );
}
