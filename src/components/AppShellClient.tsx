'use client'

import type { ReactNode } from 'react'

import { ThemeAccountSync } from './design/ThemeAccountSync'

/**
 * Product app shell gate.
 * Marketing chrome lives on `apps/site` — the product surface never mounts PublicHeader.
 */
export default function AppShellClient({ children }: { children: ReactNode }) {
  return (
    <>
      <ThemeAccountSync />
      {children}
    </>
  )
}
