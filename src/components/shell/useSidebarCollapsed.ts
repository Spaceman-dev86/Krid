'use client'

import { useCallback, useEffect, useState } from 'react'

/** Persiste le repli sidebar (admin / coach) en localStorage. */
export function useSidebarCollapsed(storageKey: string) {
  const [collapsed, setCollapsed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(storageKey) === '1')
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [storageKey])

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [storageKey])

  return { collapsed: ready ? collapsed : false, toggle }
}
