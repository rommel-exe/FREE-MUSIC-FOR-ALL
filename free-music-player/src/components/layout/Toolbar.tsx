import { useUIStore } from '@/store/uiStore';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, ListMusic, Grid3X3 } from 'lucide-react';

export function Toolbar() {
  const { searchQuery, setSearchQuery } = useUIStore();
  
  return (
    <div className="h-toolbar glass-content flex items-center px-3 gap-3 border-b border-white/[0.06] relative z-10">
      {/* Left: Navigation */}
      <div className="flex items-center gap-1">
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-label-dark-secondary hover:text-label-dark-primary hover:bg-white/[0.06] transition-all duration-150 active:scale-90" aria-label="Go back">
          <ChevronLeft className="w-5 h-5" strokeWidth={1.8} />
        </button>
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-label-dark-secondary hover:text-label-dark-primary hover:bg-white/[0.06] transition-all duration-150 active:scale-90" aria-label="Go forward">
          <ChevronRight className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label-dark-secondary pointer-events-none" strokeWidth={1.8} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full h-9 pl-9 pr-4 rounded-radius-sm bg-dark-quinary text-label-dark-primary placeholder-label-dark-tertiary text-mac-body outline-none border border-white/[0.06] focus:border-accent/50 focus:shadow-focus-ring transition-all duration-150"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-label-dark-secondary hover:text-label-dark-primary hover:bg-white/[0.06] transition-all duration-150 active:scale-90" aria-label="View options">
          <Grid3X3 className="w-5 h-5" strokeWidth={1.8} />
        </button>
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-label-dark-secondary hover:text-label-dark-primary hover:bg-white/[0.06] transition-all duration-150 active:scale-90" aria-label="Sort">
          <SlidersHorizontal className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
