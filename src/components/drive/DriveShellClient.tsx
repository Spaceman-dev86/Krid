'use client'

import type { ReactNode } from 'react'

import { DriveFeedbackProvider } from '@/src/components/drive/DriveFeedbackContext'

/** Provider feedback Drive (soft-flash + board busy) pour toute la route /drive. */
export function DriveShellClient({ children }: { children: ReactNode }) {
  return <DriveFeedbackProvider>{children}</DriveFeedbackProvider>
}
