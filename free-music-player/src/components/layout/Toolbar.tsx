import { useUIStore } from '@/store/uiStore';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, Grid3X3 } from 'lucide-react';

export function Toolbar() {
  const { searchQuery, setSearchQuery } = useUIStore();
  
  return (
    <div className="h-toolbar bg-groove-800 flex items-center px-3 gap-3 border-b border-groove-500/20 relative z-10">
      {/* Left: Navigation */}
      <div className="flex items-center gap-1">
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-groove-300 hover:text-groove-100 hover:bg-groove-700 transition-all duration-150 active:scale-90" aria-label="Go back">
          <ChevronLeft className="w-5 h-5" strokeWidth={1.8} />
        </button>
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-groove-300 hover:text-groove-100 hover:bg-groove-700 transition-all duration-150 active:scale-90" aria-label="Go forward">
          <ChevronRight className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-groove-300 pointer-events-none" strokeWidth={1.8} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full h-9 pl-9 pr-4 rounded-radius-sm bg-groove-700 text-groove-100 placeholder-groove-400 text-mac-body outline-none border border-groove-500/30 focus:border-emerald focus:shadow-emerald-glow transition-all duration-150"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-groove-300 hover:text-groove-100 hover:bg-groove-700 transition-all duration-150 active:scale-90" aria-label="View options">
          <Grid3X3 className="w-5 h-5" strokeWidth={1.8} />
        </button>
        <button className="w-9 h-9 rounded-radius-sm flex items-center justify-center text-groove-300 hover:text-groove-100 hover:bg-groove-700 transition-all duration-150 active:scale-90" aria-label="Sort">
          <SlidersHorizontal className="w-5 h-5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
