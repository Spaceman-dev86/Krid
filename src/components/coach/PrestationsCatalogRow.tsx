'use client'

import { useRouter } from 'next/navigation'
import type { KeyboardEvent, ReactNode } from 'react'

type Props = {
  href: string
  label: string
  children: ReactNode
}

/** Ligne catalogue presta : toute la row ouvre la fiche. */
export function PrestationsCatalogRow({ href, label, children }: Props) {
  const router = useRouter()

  function go() {
    router.push(href)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      go()
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={label}
      onClick={go}
      onKeyDown={onKeyDown}
      className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]"
    >
      {children}
    </tr>
  )
}
