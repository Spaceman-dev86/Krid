'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SIDEBAR_EVENT = 'trainly:sidebar-collapsed'

type SidebarEventDetail = { key: string; collapsed: boolean }

function persistAndBroadcast(storageKey: string, collapsed: boolean) {
  try {
    window.localStorage.setItem(storageKey, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent<SidebarEventDetail>(SIDEBAR_EVENT, {
      detail: { key: storageKey, collapsed },
    }),
  )
}

/** Persiste le repli sidebar (admin / coach) en localStorage. */
export function useSidebarCollapsed(storageKey: string) {
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)
  const collapsedRef = useRef(false)

  useEffect(() => {
    try {
      const initial = window.localStorage.getItem(storageKey) === '1'
      setCollapsed(initial)
      collapsedRef.current = initial
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [storageKey])

  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent<SidebarEventDetail>).detail
      if (!detail || detail.key !== storageKey) return
      collapsedRef.current = Boolean(detail.collapsed)
      setCollapsed(collapsedRef.current)
    }
    window.addEventListener(SIDEBAR_EVENT, onEvent)
    return () => window.removeEventListener(SIDEBAR_EVENT, onEvent)
  }, [storageKey])

  const toggle = useCallback(() => {
    const next = !collapsedRef.current
    collapsedRef.current = next
    setCollapsed(next)
    persistAndBroadcast(storageKey, next)
  }, [storageKey])

  /** Replie si ouverte (no-op si déjà repliée). */
  const collapse = useCallback(() => {
    if (collapsedRef.current) return
    collapsedRef.current = true
    setCollapsed(true)
    persistAndBroadcast(storageKey, true)
  }, [storageKey])

  return { collapsed: ready ? collapsed : false, toggle, collapse }
}
