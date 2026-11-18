'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '../../lib/cn'

export type FlashTone = 'success' | 'warning' | 'danger'

export type FlashItem = {
  id: string
  tone: FlashTone
  message: ReactNode
}

/** Query keys à retirer de l’URL après affichage (évite persistance au refresh). */
export const FLASH_QUERY_KEYS = [
  'created',
  'rdv',
  'accepted',
  'refused',
  'error',
  'ok',
  'saved',
  'granted',
  'ended',
  'assigned',
  'invited',
  'unlinked',
  'cancelled',
  'requested',
  'sent',
  'deleted',
  'archived',
  'forked',
  'linked',
  'revoked',
  'pushed',
  'question_saved',
  'question_deleted',
] as const

const TONE: Record<FlashTone, string> = {
  success:
    'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
  warning:
    'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
  danger:
    'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]',
}

/**
 * Soft flash one-shot : URL nettoyée tout de suite, auto-dismiss ~5s, tokens DA.
 */
export function EphemeralFlash({
  items,
  onDismissRef,
  ttlMs = 5000,
}: {
  items: FlashItem[]
  onDismissRef?: { current: (() => void) | null }
  /** Durée avant disparition (défaut 5s). */
  ttlMs?: number
}) {
  const [visible, setVisible] = useState<FlashItem[]>(() => items.filter((i) => i.message))
  const [fading, setFading] = useState(false)
  const cleaned = useRef(false)

  useEffect(() => {
    if (!onDismissRef) return
    onDismissRef.current = () => setVisible([])
    return () => {
      onDismissRef.current = null
    }
  }, [onDismissRef])

  // history.replaceState (pas router.replace) — évite d’abort le fetch RSC → « Failed to fetch »
  useEffect(() => {
    if (cleaned.current) return
    cleaned.current = true
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    let dirty = false
    for (const key of FLASH_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        dirty = true
      }
    }
    if (!dirty) return
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, '', next || url.pathname)
  }, [])

  useEffect(() => {
    if (!visible.length || ttlMs <= 0) return
    const fadeAt = Math.max(0, ttlMs - 400)
    const fadeTimer = window.setTimeout(() => setFading(true), fadeAt)
    const hideTimer = window.setTimeout(() => setVisible([]), ttlMs)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
    }
  }, [visible, ttlMs])

  function dismiss() {
    setVisible([])
  }

  if (!visible.length) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3 sm:px-4 sm:pt-4',
        fading ? 'opacity-0 transition-opacity duration-300' : 'opacity-100 transition-opacity duration-200',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-1.5">
        {visible.map((item) => (
          <div
            key={item.id}
            className={cn(
              'relative rounded-full border px-3.5 py-1.5 pr-9 text-center text-xs font-semibold shadow-da-sm backdrop-blur-sm sm:text-[13px]',
              TONE[item.tone],
            )}
          >
            {item.message}
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-[11px] font-bold opacity-60 hover:opacity-100"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
