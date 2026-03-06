import { create } from 'zustand';

// Global player state — tracks which channel is currently open in the player modal.
const usePlayerStore = create((set) => ({
  channel: null, // { id, name, channelNumber, decade, category }
  isOpen: false,
  open: (channel) => set({ channel, isOpen: true }),
  close: () => set({ isOpen: false, channel: null }),
}));

export default usePlayerStore;
