'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { validateMealAction } from '../../app/c/[slug]/actions'
import {
  RUN_STYLE_LABELS,
  type SessionRunStyle,
} from '../../lib/client-portal/sessionRuns'
import {
  addDays,
  buildWeekDays,
  parseIsoDate,
  startOfWeekMonday,
  styleChipClass,
  styleDotClass,
  toIsoDate,
  weekRangeLabel,
  type CalendarSessionDot,
} from '../../lib/client-portal/weekCalendar'

type Filter = 'seances' | 'repas' | 'rdv' | 'tout'

type Props = {
  slug: string
  primaryColor: string
  dots: CalendarSessionDot[]
  pendingSessions: { id: string; title: string; href: string }[]
  initialWeekStartIso?: string
  /** Prochain repas non validé (card sous calendrier). */
  nextMeal?: { title: string; dateIso: string } | null
}

function isRdvDot(d: CalendarSessionDot) {
  return d.kind === 'rdv' || d.style === 'rdv' || d.style === 'rdv_pending'
}

function isMealDot(d: CalendarSessionDot) {
  return d.kind === 'meal' || d.style === 'meal' || d.style === 'meal_done'
}

function isSessionDot(d: CalendarSessionDot) {
  return !isRdvDot(d) && !isMealDot(d)
}

function matchesFilter(dot: CalendarSessionDot, filter: Filter): boolean {
  if (filter === 'tout') return true
  if (filter === 'seances') return isSessionDot(dot) || isRdvDot(dot)
  if (filter === 'repas') return isMealDot(dot)
  if (filter === 'rdv') return isRdvDot(dot)
  return true
}

function styleLabel(style: CalendarSessionDot['style']): string {
  if (style === 'todo') return 'À faire'
  if (style === 'rdv') return 'RDV'
  if (style === 'rdv_pending') return 'RDV en attente'
  if (style === 'meal') return 'Repas'
  if (style === 'meal_done') return 'Validé'
  return RUN_STYLE_LABELS[style as SessionRunStyle] ?? style
}

export function ClientHomeWeekCalendar({
  slug,
  primaryColor,
  dots,
  pendingSessions,
  initialWeekStartIso,
  nextMeal,
}: Props) {
  const todayIso = toIsoDate(new Date())

  const firstFocusIso = useMemo(() => {
    const dates = dots
      .filter((d) => isRdvDot(d) || isMealDot(d))
      .map((d) => d.dateIso)
      .filter(Boolean)
      .sort()
    return dates.find((iso) => iso >= todayIso) ?? dates[0] ?? null
  }, [dots, todayIso])

  const [weekStart, setWeekStart] = useState(() => {
    if (firstFocusIso) return startOfWeekMonday(parseIsoDate(firstFocusIso))
    if (initialWeekStartIso) return parseIsoDate(initialWeekStartIso)
    return startOfWeekMonday(new Date())
  })
  const [selectedIso, setSelectedIso] = useState(() => firstFocusIso ?? todayIso)
  const [filter, setFilter] = useState<Filter>(() => (firstFocusIso ? 'tout' : 'seances'))

  const days = useMemo(() => buildWeekDays(weekStart, todayIso), [weekStart, todayIso])
  const weekIsos = useMemo(() => new Set(days.map((d) => d.iso)), [days])

  const filteredDots = useMemo(
    () => dots.filter((d) => matchesFilter(d, filter)),
    [dots, filter]
  )

  const dotsByDay = useMemo(() => {
    const map: Record<string, CalendarSessionDot[]> = {}
    for (const dot of filteredDots) {
      if (!map[dot.dateIso]) map[dot.dateIso] = []
      map[dot.dateIso].push(dot)
    }
    return map
  }, [filteredDots])

  const selectedDots = dotsByDay[selectedIso] ?? []

  const weekRdvs = useMemo(
    () => dots.filter((d) => isRdvDot(d) && weekIsos.has(d.dateIso)),
    [dots, weekIsos]
  )

  function shiftWeek(delta: number) {
    const next = addDays(weekStart, delta * 7)
    setWeekStart(next)
    const nextDays = buildWeekDays(next, todayIso)
    if (!nextDays.some((d) => d.iso === selectedIso)) {
      setSelectedIso(nextDays.find((d) => d.isToday)?.iso ?? nextDays[0].iso)
    }
  }

  return (
    <div className="grid gap-3">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/45">
              Semaine
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-[#1a1220]">
              {weekRangeLabel(weekStart)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="cal-filter">
              Filtre
            </label>
            <select
              id="cal-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="h-8 rounded-lg border border-black/10 bg-[#fafafa] px-2 text-xs font-semibold text-black/65"
            >
              <option value="seances">Séances</option>
              <option value="repas">Repas</option>
              <option value="rdv">RDV</option>
              <option value="tout">Tout</option>
            </select>
            <div className="flex overflow-hidden rounded-lg border border-black/10">
              <button
                type="button"
                onClick={() => shiftWeek(-1)}
                className="px-2.5 py-1.5 text-sm font-bold text-black/55 hover:bg-black/[0.03]"
                aria-label="Semaine précédente"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => {
                  const monday = startOfWeekMonday(new Date())
                  setWeekStart(monday)
                  setSelectedIso(todayIso)
                }}
                className="border-x border-black/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-black/45 hover:bg-black/[0.03]"
              >
                Aujourd’hui
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(1)}
                className="px-2.5 py-1.5 text-sm font-bold text-black/55 hover:bg-black/[0.03]"
                aria-label="Semaine suivante"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {filter !== 'rdv' && filter !== 'repas' && pendingSessions.length > 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-[#fafafa] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">
              Séances à faire
            </p>
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {pendingSessions.map((s) => (
                <li key={s.id} className="shrink-0">
                  <Link
                    href={s.href}
                    className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayDots = dotsByDay[day.iso] ?? []
            const selected = day.iso === selectedIso
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedIso(day.iso)}
                className={`flex flex-col items-center rounded-xl px-1 py-2 text-center transition ${
                  selected ? 'ring-2' : 'hover:bg-black/[0.03]'
                } ${day.isToday ? 'bg-black/[0.03]' : ''}`}
                style={selected ? { boxShadow: `inset 0 0 0 2px ${primaryColor}` } : undefined}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-black/40">
                  {day.label}
                </span>
                <span
                  className={`mt-0.5 text-sm font-extrabold ${
                    day.isToday ? '' : 'text-[#1a1220]'
                  }`}
                  style={day.isToday ? { color: primaryColor } : undefined}
                >
                  {day.dayNum}
                </span>
                <span className="mt-1 flex min-h-[6px] items-center justify-center gap-0.5">
                  {dayDots.slice(0, 3).map((dot) => (
                    <span
                      key={dot.id}
                      className={`h-1.5 w-1.5 rounded-full ${styleDotClass(dot.style)}`}
                      title={dot.title}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 border-t border-black/5 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">
            {parseIsoDate(selectedIso).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          {!selectedDots.length ? (
            <p className="mt-2 text-sm text-black/45">Rien ce jour-là.</p>
          ) : (
            <ul className="mt-2 divide-y divide-black/5">
              {selectedDots.map((dot) => {
                if (dot.kind === 'meal' && dot.mealMeta) {
                  const validated = dot.mealMeta.validated
                  return (
                    <li key={dot.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="font-semibold text-[#1a1220]">{dot.title}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${styleChipClass(dot.style)}`}
                        >
                          {styleLabel(dot.style)}
                        </span>
                        <form action={validateMealAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="plan_id" value={dot.mealMeta.planId} />
                          <input type="hidden" name="meal_id" value={dot.mealMeta.mealId} />
                          <input type="hidden" name="day_date" value={dot.mealMeta.dayDate} />
                          {validated ? <input type="hidden" name="undo" value="1" /> : null}
                          <button
                            type="submit"
                            className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: validated ? '#6b7280' : primaryColor,
                            }}
                          >
                            {validated ? 'Annuler' : 'Valider'}
                          </button>
                        </form>
                      </div>
                    </li>
                  )
                }

                return (
                  <li key={dot.id}>
                    <Link
                      href={dot.href}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm transition hover:opacity-80"
                    >
                      <span className="font-semibold text-[#1a1220]">{dot.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${styleChipClass(dot.style)}`}
                      >
                        {styleLabel(dot.style)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {nextMeal ? (
        <section className="rounded-2xl border border-lime-200 bg-lime-50/50 p-4 shadow-sm">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-lime-900">
            Prochain repas
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#1a1220]">{nextMeal.title}</p>
          <p className="text-xs text-lime-900/70">{nextMeal.dateIso}</p>
        </section>
      ) : null}

      {weekRdvs.length ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-rose-800">
              RDV cette semaine
            </h2>
            <Link
              href={`/c/${slug}/calendrier`}
              className="text-xs font-bold text-rose-800 underline"
            >
              File RDV →
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-rose-100">
            {weekRdvs.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="font-semibold text-[#1a1220]">{r.title}</span>
                  <span className="text-xs text-rose-800">{styleLabel(r.style)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
