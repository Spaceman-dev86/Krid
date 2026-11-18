'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition, type ReactNode } from 'react'

import { IconSearch } from '@/src/components/ui'

type Props = {
  actions?: ReactNode
}

export function CodesListFilters({ actions }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = sp.get('q') ?? ''

  function patch(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k)
      else params.set(k, v)
    }
    // Ne pas garder les flashs dans l’URL de recherche
    params.delete('created')
    params.delete('revoked')
    params.delete('error')
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/profile/codes?${qs}` : '/profile/codes')
    })
  }

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end ${pending ? 'opacity-70' : ''}`}
      data-builder-chrome
    >
      <label className="grid min-w-0 flex-1 gap-1 text-sm sm:min-w-[180px]">
        <span className="font-semibold text-[color:var(--muted)]">Recherche</span>
        <span className="relative">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            type="search"
            defaultValue={q}
            placeholder="Code, presta, type…"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] py-2 pl-9 pr-3 text-sm text-[color:var(--fg)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
            onChange={(e) => {
              const value = e.target.value
              if (qTimer.current) clearTimeout(qTimer.current)
              qTimer.current = setTimeout(() => patch({ q: value.trim() }), 250)
            }}
          />
        </span>
      </label>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pb-0.5">{actions}</div>
      ) : null}
    </div>
  )
}
