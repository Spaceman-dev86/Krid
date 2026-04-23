'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function getSearch(): string {
  if (typeof window === 'undefined') return ''
  return window.location.search || ''
}

function emit() {
  for (const l of Array.from(listeners)) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSearchParams(next: URLSearchParams, opts?: { preserveScroll?: boolean }) {
  if (typeof window === 'undefined') return

  const y = opts?.preserveScroll ? window.scrollY : null
  const path = window.location.pathname
  const qs = next.toString()
  const nextUrl = qs ? `${path}?${qs}` : path
  window.history.replaceState(null, '', nextUrl)
  emit()

  if (y != null) {
    window.setTimeout(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
    }, 0)
  }
}

export function useProgramEditorUrlState(serverFallback?: { openSession?: string; openBlock?: string }) {
  const search = useSyncExternalStore<string>(subscribe, getSearch, () => '')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => emit()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const sp = useMemo(() => new URLSearchParams(search), [search])

  const openSessionId = useMemo(() => {
    const fromUrl = sp.get('openSession')
    if (typeof window !== 'undefined') return fromUrl || null
    return fromUrl || serverFallback?.openSession || null
  }, [sp, serverFallback?.openSession])

  const openBlockId = useMemo(() => {
    const fromUrl = sp.get('openBlock')
    if (typeof window !== 'undefined') return fromUrl || null
    return fromUrl || serverFallback?.openBlock || null
  }, [sp, serverFallback?.openBlock])

  const setOpenSessionId = useCallback(
    (nextSessionId: string | null, opts?: { preserveScroll?: boolean }) => {
      const next = new URLSearchParams(getSearch())
      if (nextSessionId) next.set('openSession', nextSessionId)
      else next.delete('openSession')
      setSearchParams(next, { preserveScroll: opts?.preserveScroll })
    },
    []
  )

  const setOpenBlockId = useCallback(
    (nextBlockId: string | null, opts?: { preserveScroll?: boolean; sessionId?: string | null }) => {
      const next = new URLSearchParams(getSearch())
      if (opts?.sessionId) next.set('openSession', opts.sessionId)
      if (nextBlockId) next.set('openBlock', nextBlockId)
      else next.delete('openBlock')
      setSearchParams(next, { preserveScroll: opts?.preserveScroll })
    },
    []
  )

  const closeBlock = useCallback((opts?: { preserveScroll?: boolean }) => {
    setOpenBlockId(null, { preserveScroll: opts?.preserveScroll })
  }, [setOpenBlockId])

  return {
    search,
    openSessionId,
    openBlockId,
    setOpenSessionId,
    setOpenBlockId,
    closeBlock,
  }
}
