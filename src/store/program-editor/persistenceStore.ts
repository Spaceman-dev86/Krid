'use client'

import { create } from 'zustand'

export type PersistenceUiStatus = 'saved' | 'saving' | 'error'

type PersistenceStoreState = {
  status: PersistenceUiStatus
  pendingCount: number
  lastError: { code: string; message: string } | null
  isOnline: boolean
  setFromQueue: (state: {
    working: boolean
    pendingCount: number
    lastError?: { code: string; message: string }
  }) => void
  setOnline: (online: boolean) => void
  clearError: () => void
}

export const useProgramEditorPersistenceStore = create<PersistenceStoreState>((set, get) => ({
  status: 'saved',
  pendingCount: 0,
  lastError: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  setFromQueue: ({ working, pendingCount, lastError }) => {
    let status: PersistenceUiStatus = 'saved'
    if (lastError) status = 'error'
    else if (working || pendingCount > 0) status = 'saving'

    set({
      pendingCount,
      lastError: lastError ?? null,
      status,
    })
  },

  setOnline: (online) => {
    set({ isOnline: online })
    if (!online) {
      set({ status: get().lastError ? 'error' : 'saving' })
    }
  },

  clearError: () => set({ lastError: null, status: get().pendingCount > 0 ? 'saving' : 'saved' }),
}))
