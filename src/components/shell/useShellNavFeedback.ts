'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

/** Feedback + prefetch nav shell (admin / coach) — sans remount destructeur. */
export function useShellNavFeedback() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [routePending, setRoutePending] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    setRoutePending(false)
    setPendingHref(null)
  }, [pathname])

  useEffect(() => {
    if (!routePending) return
    // Cap court : si la route rame, ne pas laisser l’UI « fantôme » 8 s.
    const t = window.setTimeout(() => {
      setRoutePending(false)
      setPendingHref(null)
    }, 2500)
    return () => window.clearTimeout(t)
  }, [routePending])

  const beginNav = useCallback(
    (href: string) => {
      const target = href.split('?')[0] || href
      if (target === pathname) return
      setPendingHref(target)
      setRoutePending(true)
    },
    [pathname],
  )

  const prefetchNav = useCallback(
    (href: string) => {
      try {
        router.prefetch(href)
      } catch {
        /* ignore */
      }
    },
    [router],
  )

  const warmNav = useCallback(
    (hrefs: readonly string[]) => {
      for (const href of hrefs) prefetchNav(href)
    },
    [prefetchNav],
  )

  return { pathname, routePending, pendingHref, beginNav, prefetchNav, warmNav }
}
