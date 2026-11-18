'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { useShellNavFeedback } from '@/src/components/shell/useShellNavFeedback'

type ShellNavApi = ReturnType<typeof useShellNavFeedback>

const ShellNavContext = createContext<ShellNavApi | null>(null)

/** Expose beginNav / prefetch au contenu (ex. Drive hops dossier). */
export function ShellNavProvider({
  value,
  children,
}: {
  value: ShellNavApi
  children: ReactNode
}) {
  return <ShellNavContext.Provider value={value}>{children}</ShellNavContext.Provider>
}

export function useShellNav(): ShellNavApi {
  const ctx = useContext(ShellNavContext)
  if (!ctx) {
    throw new Error('useShellNav must be used within ShellNavProvider')
  }
  return ctx
}

/** Safe hors shell : no-op. */
export function useOptionalShellNav(): ShellNavApi | null {
  return useContext(ShellNavContext)
}
