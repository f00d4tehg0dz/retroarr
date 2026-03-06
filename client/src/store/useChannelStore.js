import { create } from 'zustand';

// Zustand store for UI-only state (filters, selections).
// Server state (actual channel data) lives in TanStack Query hooks.
const useChannelStore = create((set) => ({
  selectedDecade: null,
  selectedCategory: null,
  setDecadeFilter: (decade) => set({ selectedDecade: decade }),
  setCategoryFilter: (category) => set({ selectedCategory: category }),
  clearFilters: () => set({ selectedDecade: null, selectedCategory: null }),
}));

export default useChannelStore;
