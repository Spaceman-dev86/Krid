'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'

import { IconSearch, daSelectClass } from '@/src/components/ui'

export function GroupsListFilters() {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = sp.get('q') ?? ''
  const type = sp.get('type') ?? ''

  function patch(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    params.delete('nouveau')
    params.delete('presta')
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/clients/groupes?${qs}` : '/clients/groupes')
    })
  }

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end ${pending ? 'opacity-70' : ''}`}
      data-builder-chrome
    >
      <label className="grid min-w-0 flex-1 gap-1 text-sm sm:min-w-[160px]">
        <span className="font-semibold text-[color:var(--muted)]">Recherche</span>
        <span className="relative">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            type="search"
            defaultValue={q}
            placeholder="Nom ou tag…"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] py-2 pl-9 pr-3 text-sm text-[color:var(--fg)] outline-none focus:ring-2 focus:ring-[var(--brand)]"
            onChange={(e) => {
              const value = e.target.value
              if (qTimer.current) clearTimeout(qTimer.current)
              qTimer.current = setTimeout(() => patch({ q: value.trim() }), 250)
            }}
          />
        </span>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-[color:var(--muted)]">Type</span>
        <select
          value={type}
          onChange={(e) => patch({ type: e.target.value })}
          className={daSelectClass}
        >
          <option value="">Tous</option>
          <option value="linked">Lié</option>
          <option value="manual">Libre</option>
        </select>
      </label>
    </div>
  )
}
