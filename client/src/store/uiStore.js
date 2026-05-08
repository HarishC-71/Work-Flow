import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  activePanel: 'variables', // 'variables' | 'stack' | 'memory' | 'trace'
  showStdin: false,
  
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActivePanel: (panel) => set({ activePanel: panel }),
  toggleStdin: () => set((s) => ({ showStdin: !s.showStdin })),
}));

export default useUIStore;
