import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export type LibraryTab = 'all' | 'liked' | 'downloaded';

interface UIState {
  currentPage: string;
  theme: 'dark' | 'light';
  sidebarCollapsed: boolean;
  modalOpen: string | null;
  modalData: any;
  toasts: Toast[];
  searchQuery: string;
  isQueueOpen: boolean;
  isLyricsOpen: boolean;
  isFullPlayerOpen: boolean;
  selectedPlaylistId: string | null;
  libraryTab: LibraryTab;
  isPlaylistDrawerOpen: boolean;

  setPage: (page: string) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  openModal: (id: string, data?: any) => void;
  closeModal: () => void;
  addToast: (message: string, type?: Toast['type'], durationMs?: number) => void;
  removeToast: (id: string) => void;
  setSearchQuery: (query: string) => void;
  toggleQueue: () => void;
  toggleLyrics: () => void;
  setFullPlayerOpen: (open: boolean) => void;
  setSelectedPlaylistId: (id: string | null) => void;
  setLibraryTab: (tab: LibraryTab) => void;
  togglePlaylistDrawer: () => void;
  setPlaylistDrawerOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  currentPage: 'home',
  theme: 'dark',
  sidebarCollapsed: false,
  modalOpen: null,
  modalData: null,
  toasts: [],
  searchQuery: '',
  isQueueOpen: false,
  isLyricsOpen: false,
  isFullPlayerOpen: false,
  selectedPlaylistId: null,
  libraryTab: 'all',
  isPlaylistDrawerOpen: false,

  setPage: (page) => set({ currentPage: page }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openModal: (id, data) => set({ modalOpen: id, modalData: data || null }),
  closeModal: () => set({ modalOpen: null, modalData: null }),
  addToast: (message, type = 'info', durationMs) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), durationMs ?? 4000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen })),
  toggleLyrics: () => set((s) => ({ isLyricsOpen: !s.isLyricsOpen })),
  setFullPlayerOpen: (open) => set({ isFullPlayerOpen: open }),
  setSelectedPlaylistId: (id) => set({ selectedPlaylistId: id }),
  setLibraryTab: (tab) => set({ libraryTab: tab }),
  togglePlaylistDrawer: () => set((s) => ({ isPlaylistDrawerOpen: !s.isPlaylistDrawerOpen })),
  setPlaylistDrawerOpen: (open) => set({ isPlaylistDrawerOpen: open }),
}));
