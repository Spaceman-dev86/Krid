'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

export type DriveQuietResult = { ok: true; navigateTo?: string | null } | { ok: false; error: string }

type DriveFeedbackApi = {
  softFlash: string | null
  softError: string | null
  runQuiet: (fn: () => Promise<DriveQuietResult>, successMsg?: string) => Promise<DriveQuietResult>
  clearFlash: () => void
}

const DriveFeedbackContext = createContext<DriveFeedbackApi | null>(null)

export function DriveFeedbackProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [softFlash, setSoftFlash] = useState<string | null>(null)
  const [softError, setSoftError] = useState<string | null>(null)

  useEffect(() => {
    if (!softFlash) return
    const t = window.setTimeout(() => setSoftFlash(null), 1600)
    return () => window.clearTimeout(t)
  }, [softFlash])

  const runQuiet = useCallback(
    async (fn: () => Promise<DriveQuietResult>, successMsg?: string) => {
      setSoftError(null)
      const res = await fn()
      if (!res.ok) {
        setSoftError(res.error)
        return res
      }
      if (successMsg) setSoftFlash(successMsg)
      if (res.navigateTo != null) {
        router.push(res.navigateTo || '/drive')
      } else {
        router.refresh()
      }
      return res
    },
    [router],
  )

  const clearFlash = useCallback(() => {
    setSoftFlash(null)
    setSoftError(null)
  }, [])

  return (
    <DriveFeedbackContext.Provider value={{ softFlash, softError, runQuiet, clearFlash }}>
      {children}
    </DriveFeedbackContext.Provider>
  )
}

export function useDriveFeedback(): DriveFeedbackApi {
  const ctx = useContext(DriveFeedbackContext)
  if (!ctx) throw new Error('useDriveFeedback must be used within DriveFeedbackProvider')
  return ctx
}

export function useOptionalDriveFeedback(): DriveFeedbackApi | null {
  return useContext(DriveFeedbackContext)
}
