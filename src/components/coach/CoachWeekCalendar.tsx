'use client'

import { useMemo, useState } from 'react'

import {
  durationMinutes,
  formatRdvDuration,
  formatRdvWhen,
  RDV_MODALITY_LABELS,
  RDV_STATUS_LABELS,
  rdvDateIso,
  type CalendarEventRow,
} from '../../lib/calendar/rdv'
import {
  addDays,
  buildWeekDays,
  parseIsoDate,
  startOfWeekMonday,
  toIsoDate,
  weekRangeLabel,
} from '../../lib/client-portal/weekCalendar'
import { cancelCoachRdvAction, respondCoachRdvAction } from '../../app/calendar/actions'

export type CoachCalendarEvent = CalendarEventRow & { clientName: string }

function statusDot(status: CalendarEventRow['status']): string {
  switch (status) {
    case 'accepted':
      return 'bg-emerald-500'
    case 'requested':
      return 'bg-amber-500'
    case 'pending':
      return 'bg-sky-500'
    case 'refused':
      return 'bg-red-500'
    default:
      return 'bg-black/25'
  }
}

export function CoachWeekCalendar({
  events,
  initialWeekStartIso,
}: {
  events: CoachCalendarEvent[]
  initialWeekStartIso?: string
}) {
  const todayIso = toIsoDate(new Date())
  const [weekStart, setWeekStart] = useState(() =>
    initialWeekStartIso
      ? parseIsoDate(initialWeekStartIso)
      : startOfWeekMonday(new Date())
  )
  const [selectedIso, setSelectedIso] = useState(todayIso)

  const days = useMemo(() => buildWeekDays(weekStart, todayIso), [weekStart, todayIso])
  const weekIso = toIsoDate(weekStart)

  const dated = useMemo(
    () =>
      events.filter(
        (e) =>
          e.starts_at &&
          e.status !== 'cancelled' &&
          (e.status === 'accepted' ||
            e.status === 'requested' ||
            e.status === 'pending' ||
            e.status === 'refused')
      ),
    [events]
  )

  const byDay = useMemo(() => {
    const map: Record<string, CoachCalendarEvent[]> = {}
    for (const ev of dated) {
      const iso = rdvDateIso(ev.starts_at)
      if (!iso) continue
      if (!map[iso]) map[iso] = []
      map[iso].push(ev)
    }
    return map
  }, [dated])

  const selected = byDay[selectedIso] ?? []

  function shiftWeek(delta: number) {
    const next = addDays(weekStart, delta * 7)
    setWeekStart(next)
    const nextDays = buildWeekDays(next, todayIso)
    if (!nextDays.some((d) => d.iso === selectedIso)) {
      setSelectedIso(nextDays.find((d) => d.isToday)?.iso ?? nextDays[0].iso)
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
            Semaine
          </h2>
          <p className="mt-0.5 text-sm font-semibold text-[color:var(--fg)]">{weekRangeLabel(weekStart)}</p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="px-2.5 py-1.5 text-sm font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => {
              setWeekStart(startOfWeekMonday(new Date()))
              setSelectedIso(todayIso)
            }}
            className="border-x border-[var(--border)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)] hover:bg-[var(--accent)]"
          >
            Aujourd’hui
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="px-2.5 py-1.5 text-sm font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = byDay[day.iso] ?? []
          const selectedDay = day.iso === selectedIso
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => setSelectedIso(day.iso)}
              className={`flex flex-col items-center rounded-xl px-1 py-2 text-center transition ${
                selectedDay ? 'ring-2 ring-[color:var(--brand)]' : 'hover:bg-[var(--accent)]'
              } ${day.isToday ? 'bg-[var(--accent)]' : ''}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                {day.label}
              </span>
              <span
                className={`mt-0.5 text-sm font-extrabold ${
                  day.isToday ? 'text-[color:var(--brand)]' : 'text-[color:var(--fg)]'
                }`}
              >
                {day.dayNum}
              </span>
              <span className="mt-1 flex min-h-[6px] items-center justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className={`h-1.5 w-1.5 rounded-full ${statusDot(ev.status)}`}
                    title={ev.title}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 border-t border-[var(--border)] bg-[var(--surface)] pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
          {parseIsoDate(selectedIso).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
        {!selected.length ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">Aucun RDV ce jour-là.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {selected.map((ev) => (
              <DayEventCard key={ev.id} ev={ev} weekIso={weekIso} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function DayEventCard({ ev, weekIso }: { ev: CoachCalendarEvent; weekIso: string }) {
  const mins = durationMinutes(ev.starts_at, ev.ends_at)
  const refused = ev.status === 'refused'

  return (
    <li
      className={`rounded-xl border p-3 ${
        refused ? 'border-red-400 bg-red-50/50 ring-1 ring-red-200' : 'border-[var(--border)] bg-[var(--surface)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-[color:var(--brand)]">{ev.title}</p>
          <p className="text-xs text-[color:var(--muted)]">{ev.clientName}</p>
          <p className="mt-1 text-xs font-semibold text-[color:var(--fg)]">
            {[
              formatRdvWhen(ev.starts_at),
              formatRdvDuration(mins),
              ev.modality ? RDV_MODALITY_LABELS[ev.modality] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {ev.client_message ? (
            <p className="mt-1 text-xs text-[color:var(--muted)]">{ev.client_message}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)] ring-1 ring-[var(--border)]">
          {RDV_STATUS_LABELS[ev.status]}
        </span>
      </div>

      {ev.status === 'requested' ? (
        <div className="mt-2 flex gap-2">
          <form action={respondCoachRdvAction} className="flex-1">
            <input type="hidden" name="event_id" value={ev.id} />
            <input type="hidden" name="decision" value="accepted" />
            <input type="hidden" name="week" value={weekIso} />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-700 px-2 py-2 text-xs font-bold text-white"
            >
              Accepter
            </button>
          </form>
          <form action={respondCoachRdvAction} className="flex-1">
            <input type="hidden" name="event_id" value={ev.id} />
            <input type="hidden" name="decision" value="refused" />
            <input type="hidden" name="week" value={weekIso} />
            <button
              type="submit"
              className="w-full rounded-lg border border-red-300 bg-[var(--surface)] px-2 py-2 text-xs font-bold text-red-800"
            >
              Refuser
            </button>
          </form>
        </div>
      ) : null}

      {ev.status === 'accepted' || ev.status === 'pending' ? (
        <form action={cancelCoachRdvAction} className="mt-2">
          <input type="hidden" name="event_id" value={ev.id} />
          <input type="hidden" name="week" value={weekIso} />
          <button type="submit" className="text-[11px] font-semibold text-red-700 hover:underline">
            Annuler
          </button>
        </form>
      ) : null}
    </li>
  )
}
