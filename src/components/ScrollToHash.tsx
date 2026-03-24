'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function ScrollToHash() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    let cancelled = false
    let attempt = 0
    let observer: MutationObserver | null = null

    const tryScroll = () => {
      if (cancelled) return
      const hash = window.location.hash
      if (!hash || hash.length < 2) return

      const id = decodeURIComponent(hash.slice(1))
      const el = document.getElementById(id)

      if (el) {
        requestAnimationFrame(() => {
          if (cancelled) return
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        })
        observer?.disconnect()
        observer = null
        return
      }

      attempt += 1
      if (attempt < 25) {
        setTimeout(tryScroll, 60)
      }
    }

    const onHashChange = () => {
      attempt = 0
      tryScroll()
    }

    observer = new MutationObserver(() => {
      tryScroll()
    })

    observer.observe(document.documentElement, { childList: true, subtree: true })
    tryScroll()
    window.addEventListener('hashchange', onHashChange)

    return () => {
      cancelled = true
      observer?.disconnect()
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [pathname, searchParams])

  return null
}
