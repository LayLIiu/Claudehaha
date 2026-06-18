import { create } from 'zustand'

const PINNED_SESSION_STORAGE_KEY = 'cc-haha-pinned-sessions'

function readPinnedSessions(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(PINNED_SESSION_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : []
  } catch {
    return []
  }
}

function writePinnedSessions(ids: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PINNED_SESSION_STORAGE_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    // UI preference only; ignore storage failures.
  }
}

type PinnedSessionStore = {
  pinnedSessionIds: string[]
  isPinned: (sessionId: string) => boolean
  togglePinned: (sessionId: string) => boolean
  removePinned: (sessionId: string) => void
}

export const usePinnedSessionStore = create<PinnedSessionStore>((set, get) => ({
  pinnedSessionIds: readPinnedSessions(),
  isPinned: (sessionId) => get().pinnedSessionIds.includes(sessionId),
  togglePinned: (sessionId) => {
    const current = get().pinnedSessionIds
    const pinned = current.includes(sessionId)
    const next = pinned
      ? current.filter((id) => id !== sessionId)
      : [sessionId, ...current]
    writePinnedSessions(next)
    set({ pinnedSessionIds: next })
    return !pinned
  },
  removePinned: (sessionId) => {
    const next = get().pinnedSessionIds.filter((id) => id !== sessionId)
    writePinnedSessions(next)
    set({ pinnedSessionIds: next })
  },
}))
