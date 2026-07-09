'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Card } from './marketing'

type Item = {
  id: string
  name: string
  muscle_group: string | null
  difficulty: string | null
  thumb_url?: string | null
}

type Props = {
  items: Item[]
  returnTo: string
  /** Base path for exercise detail links (default: dashboard). */
  exerciseBasePath?: string
}

export default function DashboardExerciseLibraryClient({
  items,
  returnTo,
  exerciseBasePath = '/dashboard/exercises',
}: Props) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')

  const muscles = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) {
      const mg = (it.muscle_group ?? '').trim()
      if (mg) set.add(mg)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (muscle && (it.muscle_group ?? '') !== muscle) return false
      if (!q) return true
      const hay = `${it.name} ${(it.muscle_group ?? '')} ${(it.difficulty ?? '')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, muscle, query])

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="exercice"
          className="h-11 min-w-0 flex-1 rounded-2xl bg-white px-4 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 outline-none placeholder:text-black/40"
        />

        <div className="relative w-[170px] shrink-0 sm:w-[220px]">
          <select
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
            className="h-11 w-full appearance-none rounded-2xl bg-white pl-4 pr-10 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 outline-none"
          >
            <option value="">muscle</option>
            {muscles.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#341c44]">
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              aria-hidden
              style={{ display: 'block' }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {filtered.length > 0 ? (
          filtered.map((e) => {
            const href = `${exerciseBasePath}/${e.id}?returnTo=${encodeURIComponent(returnTo)}`
            return (
              <Link key={e.id} href={href} className="block">
                <Card className="p-2 shadow-none ring-1 ring-black/10 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
                      {e.thumb_url ? (
                        <img src={e.thumb_url} alt={e.name} className="h-12 w-12 object-cover" loading="lazy" />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold text-[#341c44]">{e.name}</div>
                      {(e.muscle_group || e.difficulty) ? (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-black/50">
                          {e.muscle_group ? <span>{e.muscle_group}</span> : null}
                          {e.difficulty ? <span>{e.difficulty}</span> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#341c44] text-xs font-black text-white">
                      →
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })
        ) : (
          <Card>
            <div className="text-sm text-black/60">Aucun résultat.</div>
          </Card>
        )}
      </div>
    </>
  )
}
