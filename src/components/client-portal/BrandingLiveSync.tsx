'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const POLL_MS = 12_000

/**
 * Sync live du branding coach → portail client.
 * Si `updated_at` change (coach a enregistré mon-app), refresh RSC.
 */
export function BrandingLiveSync({
  slug,
  initialUpdatedAt,
}: {
  slug: string
  initialUpdatedAt: string | null
}) {
  const router = useRouter()
  const lastRef = useRef(initialUpdatedAt)

  useEffect(() => {
    lastRef.current = initialUpdatedAt
  }, [initialUpdatedAt])

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch(`/api/c/${encodeURIComponent(slug)}/branding`, {
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { updated_at?: string | null }
        const next = data.updated_at?.trim() || null
        if (!next) return
        if (lastRef.current && next !== lastRef.current) {
          lastRef.current = next
          router.refresh()
          return
        }
        if (!lastRef.current) {
          lastRef.current = next
        }
      } catch {
        // ignore réseau
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void check()
    }

    void check()
    const id = window.setInterval(() => void check(), POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [slug, router])

  return null
}
