import { create } from 'zustand'

type CommandPaletteState = {
  open: boolean
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
  togglePalette: () => set((s) => ({ open: !s.open })),
}))
