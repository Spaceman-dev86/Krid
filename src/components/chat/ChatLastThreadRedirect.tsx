'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { LAST_THREAD_KEY } from './ChatThreadWithTools'

/** Sur /chat vide (desktop) : rouvre la dernière conversation. Mobile = inbox. */
export function ChatLastThreadRedirect({
  knownThreadIds,
  disabled = false,
}: {
  knownThreadIds: string[]
  disabled?: boolean
}) {
  const router = useRouter()

  useEffect(() => {
    try {
      if (disabled) {
        localStorage.removeItem(LAST_THREAD_KEY)
        return
      }
      if (!window.matchMedia('(min-width: 768px)').matches) return
      const last = localStorage.getItem(LAST_THREAD_KEY)
      if (!last) return
      if (knownThreadIds.length && !knownThreadIds.includes(last)) return
      router.replace(`/chat/${last}`)
    } catch {
      // ignore
    }
  }, [disabled, knownThreadIds, router])

  return null
}
