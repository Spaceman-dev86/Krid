'use client'

import Link from 'next/link'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

import {
  flushProgramEditorPersistence,
  hasPendingProgramEditorPersistence,
} from '../persistence/startProgramEditorPersistence'

const NAVIGATION_TIMEOUT_MS = 45_000

type ProgramEditorNavigationContextValue = {
  startNavigation: (href: string) => void | Promise<void>
  markEditorReady: () => void
  isNavigating: boolean
}

const ProgramEditorNavigationContext = createContext<ProgramEditorNavigationContextValue | null>(null)

export function isProgramEditorHref(href: string) {
  const path = href.split('?')[0] ?? ''
  return /^\/(dashboard|admin)\/programs\/[^/]+$/.test(path)
}

function ProgramEditorLoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Ouverture de l’éditeur"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#341c44]/40 px-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/10">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-[#341c44]/15 border-t-[#341c44]" />
        <p className="mt-4 text-center text-base font-extrabold text-[#341c44]">Ouverture de l’éditeur…</p>
        <p className="mt-1 text-center text-sm font-semibold text-black/50">Chargement du programme en cours</p>
      </div>
    </div>
  )
}

export function ProgramEditorNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const markEditorReady = useCallback(() => {
    setIsNavigating(false)
  }, [])

  const startNavigation = useCallback(
    async (href: string) => {
      if (hasPendingProgramEditorPersistence()) {
        await flushProgramEditorPersistence()
      }
      setIsNavigating(true)
      router.push(href)
    },
    [router]
  )

  useEffect(() => {
    if (!isNavigating) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timeout = window.setTimeout(() => setIsNavigating(false), NAVIGATION_TIMEOUT_MS)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(timeout)
    }
  }, [isNavigating])

  return (
    <ProgramEditorNavigationContext.Provider value={{ startNavigation, markEditorReady, isNavigating }}>
      {children}
      {mounted && isNavigating ? createPortal(<ProgramEditorLoadingOverlay />, document.body) : null}
    </ProgramEditorNavigationContext.Provider>
  )
}

function useProgramEditorNavigation() {
  return useContext(ProgramEditorNavigationContext)
}

type ProgramEditorLinkProps = {
  href: string
  className?: string
  children: ReactNode
  ariaLabel?: string
}

export function ProgramEditorLink({ href, className, children, ariaLabel }: ProgramEditorLinkProps) {
  const navigation = useProgramEditorNavigation()

  if (!isProgramEditorHref(href) || !navigation) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      disabled={navigation.isNavigating}
      onClick={() => void navigation.startNavigation(href)}
    >
      {children}
    </button>
  )
}

/** À appeler depuis l’éditeur une fois le contenu principal monté (après paint). */
export function useMarkProgramEditorReady() {
  const navigation = useProgramEditorNavigation()
  const markEditorReady = navigation?.markEditorReady

  useLayoutEffect(() => {
    if (!markEditorReady || !navigation?.isNavigating) return

    let innerFrame = 0
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        markEditorReady()
      })
    })

    return () => {
      cancelAnimationFrame(outerFrame)
      if (innerFrame) cancelAnimationFrame(innerFrame)
    }
  }, [markEditorReady, navigation?.isNavigating])
}

export default function ProgramEditorNavigationEndClient() {
  useMarkProgramEditorReady()
  return null
}
