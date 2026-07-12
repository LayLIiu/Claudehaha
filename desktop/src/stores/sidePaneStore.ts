/**
 * SidePaneStore — 右侧多功能面板状态
 *
 * 参考 ZCode 的 sidePaneState：workspace / git / terminal / code-viewer / browser / preview。
 * 轻量路由，每个 view 的具体数据由各自 store 管理（workspacePanelStore、terminalPanelStore 等）
 */
import { create } from 'zustand'

export type SidePaneView = 'workspace' | 'git' | 'terminal' | 'code-viewer' | 'browser' | 'preview' | null

type SidePaneState = {
  /** null = collapsed */
  view: SidePaneView
  open: (view: SidePaneView) => void
  close: () => void
  toggle: (view: SidePaneView) => void
  isOpen: (view: SidePaneView) => boolean
}

export const useSidePaneStore = create<SidePaneState>((set, get) => ({
  view: null,
  open: (view) => set({ view }),
  close: () => set({ view: null }),
  toggle: (view) => set((s) => ({ view: s.view === view ? null : view })),
  isOpen: (view) => get().view === view,
}))
