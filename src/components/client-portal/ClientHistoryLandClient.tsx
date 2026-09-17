'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { toggleFavoriteAction } from '../../app/c/[slug]/historique-actions'
import type { DayHistoryItems, HistoryLandRow } from '../../lib/client-portal/historyLand'

type Props = {
  slug: string
  primaryColor: string
  rows: HistoryLandRow[]
  calendarDays: DayHistoryItems[]
  favorisHref: string
  emptyLabel?: string
  title?: string
  subtitle?: string
  returnToPath?: string
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19.5l1-5.8L3.6 9.6l5.8-.8L12 3.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
    </svg>
  )
}

export function ClientHistoryLandClient({
  slug,
  primaryColor,
  rows,
  calendarDays,
  favorisHref,
  emptyLabel = 'Aucun exercice ou bloc réalisé pour l’instant.',
  title = 'Historique',
  subtitle = 'Exos & blocs · dernière activité',
  returnToPath,
}: Props) {
  const [calOpen, setCalOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const returnTo = returnToPath ?? `/c/${slug}/historique`

  const dayMap = useMemo(() => {
    const m = new Map<string, DayHistoryItems>()
    for (const d of calendarDays) m.set(d.day, d)
    return m
  }, [calendarDays])

  const selected = selectedDay ? dayMap.get(selectedDay) : null

  const weeks = useMemo(() => {
    const keys = calendarDays.map((d) => d.day).sort()
    if (!keys.length) return [] as string[][]
    const min = new Date(`${keys[0]}T12:00:00`)
    const max = new Date(`${keys[keys.length - 1]}T12:00:00`)
    // Show last 4 weeks from max
    const end = new Date(max)
    const start = new Date(end)
    start.setDate(start.getDate() - 27)
    // Align to Monday
    const day = start.getDay() || 7
    start.setDate(start.getDate() - (day - 1))
    const out: string[][] = []
    const cursor = new Date(start)
    for (let w = 0; w < 5; w++) {
      const week: string[] = []
      for (let i = 0; i < 7; i++) {
        week.push(cursor.toISOString().slice(0, 10))
        cursor.setDate(cursor.getDate() + 1)
      }
      out.push(week)
      if (cursor > end && w >= 3) break
    }
    return out
  }, [calendarDays])

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: primaryColor }}>
            {title}
          </h1>
          <p className="mt-1 text-sm text-black/55">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setCalOpen(true)
              setSelectedDay(null)
            }}
            className="rounded-full p-2 text-black/55 transition hover:bg-black/5 hover:text-black/80"
            aria-label="Calendrier"
          >
            <CalendarIcon />
          </button>
          <Link
            href={favorisHref}
            className="rounded-full p-2 text-black/55 transition hover:bg-black/5 hover:text-black/80"
            aria-label="Favoris"
            style={{ color: primaryColor }}
          >
            <StarIcon filled />
          </Link>
        </div>
      </div>

      {!rows.length ? (
        <section className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/50 shadow-sm">
          {emptyLabel}
        </section>
      ) : (
        <ul className="divide-y divide-black/5 rounded-2xl border border-black/10 bg-white shadow-sm">
          {rows.map((row) => {
            const href = `/c/${slug}/historique/${row.itemId}`
            return (
              <li key={row.itemId} className="flex items-stretch">
                <Link
                  href={href}
                  className="min-w-0 flex-1 px-4 py-3 transition hover:bg-black/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-[#1a1220]">{row.name}</span>
                    <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black/45">
                      {row.kind === 'block' ? 'Bloc' : 'Exo'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-black/45">
                    {row.metricPreview}
                    {row.occurrenceCount > 1 ? ` · ${row.occurrenceCount}×` : ''}
                    {' · '}
                    {new Date(row.lastActivityAt).toLocaleDateString('fr-FR')}
                  </p>
                </Link>
                <form action={toggleFavoriteAction} className="flex items-center pr-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="target_type" value={row.kind} />
                  <input type="hidden" name="target_id" value={row.targetId} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    className="rounded-full p-2 transition hover:bg-black/5"
                    style={{ color: row.isFavorite ? primaryColor : 'rgba(0,0,0,0.35)' }}
                    aria-label={row.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <StarIcon filled={row.isFavorite} />
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      )}

      {calOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal
            aria-label="Calendrier historique"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1a1220]">Calendrier</h2>
              <button
                type="button"
                className="text-sm font-semibold text-black/45 hover:text-black/70"
                onClick={() => setCalOpen(false)}
              >
                Fermer
              </button>
            </div>

            {!selected ? (
              <div className="grid gap-3">
                {weeks.length === 0 ? (
                  <p className="text-sm text-black/45">Aucune séance datée.</p>
                ) : (
                  weeks.map((week) => (
                    <div key={week[0]} className="grid grid-cols-7 gap-1">
                      {week.map((day) => {
                        const has = dayMap.has(day)
                        const d = new Date(`${day}T12:00:00`)
                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={!has}
                            onClick={() => setSelectedDay(day)}
                            className="relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-semibold disabled:opacity-30"
                            style={
                              has
                                ? { backgroundColor: `${primaryColor}18`, color: primaryColor }
                                : { color: 'rgba(0,0,0,0.45)' }
                            }
                          >
                            {d.getDate()}
                            {has ? (
                              <span
                                className="absolute bottom-1 h-1 w-1 rounded-full"
                                style={{ backgroundColor: primaryColor }}
                              />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button"
                  className="text-left text-xs font-bold text-black/45"
                  onClick={() => setSelectedDay(null)}
                >
                  ← Semaines
                </button>
                <p className="text-sm font-semibold text-[#1a1220]">
                  {new Date(`${selected.day}T12:00:00`).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <ul className="divide-y divide-black/5 rounded-xl border border-black/10">
                  {selected.items.map((it) => (
                    <li key={it.itemId}>
                      <Link
                        href={`/c/${slug}/historique/${it.itemId}`}
                        className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-black/[0.02]"
                        onClick={() => setCalOpen(false)}
                      >
                        <span className="font-medium">{it.name}</span>
                        <span className="text-[10px] font-bold uppercase text-black/40">
                          {it.kind === 'block' ? 'Bloc' : 'Exo'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
