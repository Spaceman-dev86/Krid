'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'

/** ≥768px — poignées visibles, drag souris. */
export const EDITOR_DESKTOP_DND_MIN_PX = 768

export function useEditorDesktopDnD() {
  const [isDesktopDnD, setIsDesktopDnD] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia(`(min-width: ${EDITOR_DESKTOP_DND_MIN_PX}px)`).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${EDITOR_DESKTOP_DND_MIN_PX}px)`)
    const update = () => setIsDesktopDnD(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isDesktopDnD
}

/** Alias sémantique : afficher les icônes grip. */
export function useEditorShowGrip() {
  return useEditorDesktopDnD()
}

export const MOBILE_DRAG_HOLD_MS = 120
export const MOBILE_DRAG_PRESS_MS = 300
export const MOBILE_DRAG_TOLERANCE = 10
export const MOBILE_DRAG_LABEL = 'Maintenir pour déplacer'

export const MOBILE_DRAG_HOLD_CLASS =
  'scale-[1.01] shadow-md ring-2 ring-[var(--brand)]/30 bg-[var(--brand)]/[0.06]'

export const MOBILE_DRAG_ACTIVE_CLASS =
  'scale-[1.02] shadow-lg ring-2 ring-[var(--brand)]/45 bg-[var(--brand)]/[0.08]'

type HoldOptions = {
  enabled: boolean
  isDragging: boolean
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners | undefined
}

function chainListener<E>(
  original: ((event: E) => void) | undefined,
  before?: (event: E) => void,
  after?: (event: E) => void
) {
  if (!original && !before && !after) return undefined
  return (event: E) => {
    before?.(event)
    original?.(event)
    after?.(event)
  }
}

/** Effet visuel pendant l’appui long (mobile) + listeners enrichis. */
export function useMobileDragHold({ enabled, isDragging, attributes, listeners }: HoldOptions) {
  const [holding, setHolding] = useState(false)
  const holdTimerRef = useRef<number | null>(null)

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const startHoldTimer = () => {
    clearHoldTimer()
    holdTimerRef.current = window.setTimeout(() => setHolding(true), MOBILE_DRAG_HOLD_MS)
  }

  useEffect(() => {
    if (isDragging) setHolding(false)
  }, [isDragging])

  useEffect(() => clearHoldTimer, [])

  const mobileListeners = useMemo(() => {
    if (!enabled || !listeners) return undefined

    const endHold = () => {
      clearHoldTimer()
      setHolding(false)
    }

    return {
      ...listeners,
      onPointerDown: chainListener<ReactPointerEvent<Element>>(
        listeners.onPointerDown,
        startHoldTimer
      ),
      onPointerUp: chainListener<ReactPointerEvent<Element>>(listeners.onPointerUp, undefined, endHold),
      onPointerCancel: chainListener<ReactPointerEvent<Element>>(
        listeners.onPointerCancel,
        undefined,
        endHold
      ),
      onTouchStart: chainListener<React.TouchEvent<Element>>(listeners.onTouchStart, startHoldTimer),
      onTouchEnd: chainListener<React.TouchEvent<Element>>(listeners.onTouchEnd, undefined, endHold),
      onTouchCancel: chainListener<React.TouchEvent<Element>>(listeners.onTouchCancel, undefined, endHold),
    } satisfies DraggableSyntheticListeners
  }, [enabled, listeners])

  const mobileDragClass = enabled
    ? isDragging
      ? MOBILE_DRAG_ACTIVE_CLASS
      : holding
        ? MOBILE_DRAG_HOLD_CLASS
        : ''
    : ''

  return {
    holding,
    mobileListeners,
    mobileDragClass,
    mobileAttributes: enabled ? attributes : undefined,
  }
}
