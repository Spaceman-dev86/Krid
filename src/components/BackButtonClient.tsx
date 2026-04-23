'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  href: string
  preferHref?: boolean
  className?: string
  ariaLabel?: string
  children: React.ReactNode
}

export default function BackButtonClient({ href, preferHref, className, ariaLabel, children }: Props) {
  const router = useRouter()

  useEffect(() => {
    router.prefetch(href)
  }, [href, router])

  return (
    <button
      type="button"
      onClick={() => {
        if (preferHref) {
          router.replace(href)
          router.refresh()
          return
        }
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back()
          return
        }
        router.push(href)
      }}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}
