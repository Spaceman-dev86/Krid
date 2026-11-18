'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'

import { IconSearch, daSelectClass } from '@/src/components/ui'

type PrestaOption = { id: string; name: string }

type Props = {
  prestations: PrestaOption[]
}

export function ClientsListFilters({ prestations }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = sp.get('q') ?? ''
  const status = sp.get('status') ?? ''
  const presta = sp.get('presta') ?? ''

  function patch(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(next)) {
      if (!v) params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/clients?${qs}` : '/clients')
    })
  }

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end ${pending ? 'opacity-70' : ''}`}
      data-builder-chrome
    >
      <label className="grid min-w-[180px] flex-1 gap-1 text-sm">
        <span className="font-semibold text-[color:var(--muted)]">Recherche</span>
        <span className="relative">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
          />
          <input
            type="search"
            defaultValue={q}
            placeholder="Nom ou email…"
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
        <span className="font-semibold text-[color:var(--muted)]">Statut</span>
        <select
          value={status}
          onChange={(e) => patch({ status: e.target.value })}
          className={daSelectClass}
        >
          <option value="">Tous</option>
          <option value="active">Actif</option>
          <option value="invited">Invité</option>
          <option value="archived">Archivé</option>
        </select>
      </label>
      <label className="grid min-w-[160px] gap-1 text-sm">
        <span className="font-semibold text-[color:var(--muted)]">Prestation</span>
        <select
          value={presta}
          onChange={(e) => patch({ presta: e.target.value })}
          className={daSelectClass}
        >
          <option value="">Toutes</option>
          {prestations.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
