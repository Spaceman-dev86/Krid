'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type ClientRow = {
  id: string
  full_name: string
}

type CalendarEventRow = {
  id: string
  owner_coach_id: string | null
  client_id: string | null
  title: string
  start_at: string
  end_at: string | null
  notes: string | null
}

type Props = {
  clients: ClientRow[]
  initialEvents: CalendarEventRow[]
  createSessionAction: (formData: FormData) => Promise<void>
  deleteSessionAction: (formData: FormData) => Promise<void>
  currentUserId: string
  initialMonthIso: string
  initialOpen: boolean
  initialClientId: string | null
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatMonthTitle(d: Date) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d)
}

function parseLocalDateTime(dateStr: string, timeStr: string) {
  const [y, m, day] = dateStr.split('-').map((x) => Number(x))
  const [hh, mm] = timeStr.split(':').map((x) => Number(x))
  return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0, 0)
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60 * 1000)
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

function startOfCalendarGrid(month: Date) {
  const first = startOfMonth(month)
  const day = first.getDay()
  const mondayBased = (day + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayBased)
  start.setHours(0, 0, 0, 0)
  return start
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

export default function CalendarClient({
  clients,
  initialEvents,
  createSessionAction,
  deleteSessionAction,
  currentUserId,
  initialMonthIso,
  initialOpen,
  initialClientId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [events, setEvents] = useState<CalendarEventRow[]>(initialEvents)
  const [month, setMonth] = useState(() => {
    const d = new Date(initialMonthIso)
    if (Number.isNaN(d.getTime())) return startOfMonth(new Date())
    return startOfMonth(d)
  })

  const [isOpen, setIsOpen] = useState(initialOpen)
  const [clientId, setClientId] = useState<string>(initialClientId ?? clients[0]?.id ?? '')
  const [date, setDate] = useState(() => isoDateOnly(new Date()))
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')

  const [detailDay, setDetailDay] = useState<string | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      const url = new URL(window.location.href)
      url.searchParams.delete('open')
      url.searchParams.delete('clientId')
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }, [isOpen, router])

  const monthDays = useMemo(() => {
    const start = startOfCalendarGrid(month)
    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }, [month])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>()
    for (const ev of events) {
      const d = new Date(ev.start_at)
      if (Number.isNaN(d.getTime())) continue
      const key = isoDateOnly(d)
      const arr = map.get(key) ?? []
      arr.push(ev)
      map.set(key, arr)
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      map.set(k, arr)
    }
    return map
  }, [events])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clients) m.set(c.id, c.full_name)
    return m
  }, [clients])

  const detailDayDate = useMemo(() => {
    if (!detailDay) return null
    const d = new Date(`${detailDay}T00:00:00`)
    if (Number.isNaN(d.getTime())) return null
    return d
  }, [detailDay])

  const detailDayEvents = useMemo(() => {
    if (!detailDay) return []
    return eventsByDay.get(detailDay) ?? []
  }, [detailDay, eventsByDay])

  const detailEvent = useMemo(() => {
    if (!detailEventId) return null
    return events.find((e) => e.id === detailEventId) ?? null
  }, [detailEventId, events])

  function closeDetails() {
    setDetailEventId(null)
    setDetailDay(null)
  }

  function openCreateForDay(dayIso: string) {
    setDate(dayIso)
    setIsOpen(true)
  }

  function changeDuration(delta: number) {
    setDuration((prev) => {
      const next = Math.round((prev + delta) / 15) * 15
      return Math.max(15, next)
    })
  }

  const monthSwipeRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })

  return (
    <div>
      <div className="sticky top-16 z-40 -mx-4 bg-white/95 px-4 py-3 md:backdrop-blur sm:-mx-6 sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">Calendrier</h1>
            <p className="mt-1 text-sm text-black/60">Séances, bilans et rendez-vous.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Ajouter une séance"
              title="Ajouter une séance"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#341c44] text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44]/30"
            >
              +
            </button>
            <a
              href="/dashboard"
              aria-label="Retour dashboard"
              title="Retour dashboard"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
            >
              ←
            </a>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
          >
            ←
          </button>

          <div className="min-w-0 truncate text-sm font-extrabold capitalize text-[#341c44]">{formatMonthTitle(month)}</div>

          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="overflow-hidden rounded-2xl bg-black/10 ring-1 ring-black/10">
          <div className="grid grid-cols-7 gap-px text-[11px] font-extrabold text-black/40">
            <div className="bg-white py-1 text-center">L</div>
            <div className="bg-white py-1 text-center">M</div>
            <div className="bg-white py-1 text-center">M</div>
            <div className="bg-white py-1 text-center">J</div>
            <div className="bg-white py-1 text-center">V</div>
            <div className="bg-white py-1 text-center">S</div>
            <div className="bg-white py-1 text-center">D</div>
          </div>
        </div>

        <div
          className="mt-2 overflow-hidden rounded-2xl bg-black/10 ring-1 ring-black/10"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={(e) => {
            monthSwipeRef.current.active = true
            monthSwipeRef.current.x = e.clientX
            monthSwipeRef.current.y = e.clientY
          }}
          onPointerUp={(e) => {
            if (!monthSwipeRef.current.active) return
            monthSwipeRef.current.active = false

            const dx = e.clientX - monthSwipeRef.current.x
            const dy = Math.abs(e.clientY - monthSwipeRef.current.y)
            if (dy > 24) return

            if (dx > 60) {
              setMonth((m) => addMonths(m, -1))
              return
            }
            if (dx < -60) {
              setMonth((m) => addMonths(m, 1))
            }
          }}
          onPointerCancel={() => {
            monthSwipeRef.current.active = false
          }}
        >
          <div className="grid grid-cols-7 gap-px">
                {monthDays.map((d) => {
            const inMonth = d.getMonth() === month.getMonth()
            const key = isoDateOnly(d)
            const dayEvents = eventsByDay.get(key) ?? []
            const isToday = sameDay(d, today)

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setDetailDay(key)
                  setDetailEventId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setDetailDay(key)
                    setDetailEventId(null)
                  }
                }}
                className={`min-h-[72px] p-1 sm:min-h-[86px] sm:p-1.5 ${inMonth ? 'bg-white' : 'bg-[#fafafa]'} cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44]/30`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-xl px-2 text-xs font-extrabold ${
                      isToday ? 'bg-[#341c44] text-white' : inMonth ? 'text-[#341c44]' : 'text-black/35'
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>

                <div className="mt-1 grid gap-1">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailDay(key)
                        setDetailEventId(null)
                      }}
                      className="truncate rounded-xl bg-[#341c44]/5 px-2 py-1 text-[10px] font-semibold text-[#341c44] ring-1 ring-[#341c44]/15"
                      title={ev.title}
                    >
                      {formatTime(ev.start_at)} {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 ? (
                    <div className="text-[10px] font-semibold text-black/40">+{dayEvents.length - 3}</div>
                  ) : null}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (isPending) return
              setIsOpen(false)
            }}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-extrabold text-[#341c44]">Nouvelle séance</div>
                <div className="mt-1 text-xs font-semibold text-black/50">Elle sera ajoutée au calendrier et envoyée au client.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isPending) return
                  setIsOpen(false)
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <div className="text-xs font-extrabold text-black/60">Client</div>
                <div className="relative">
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="h-11 w-full appearance-none rounded-2xl bg-white px-3 pr-10 text-sm font-semibold text-[#341c44] ring-1 ring-black/10"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <div className="text-xs font-extrabold text-black/60">Date</div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10"
                  />
                </label>

                <label className="grid gap-1">
                  <div className="text-xs font-extrabold text-black/60">Heure</div>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10"
                  />
                </label>
              </div>

              <div className="grid gap-1">
                <div className="text-xs font-extrabold text-black/60">Durée</div>
                <div className="flex h-11 items-stretch overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
                  <div className="flex flex-1 items-center px-3 text-sm font-semibold text-[#341c44]">{duration} min</div>
                  <div className="grid grid-rows-2">
                    <button
                      type="button"
                      onClick={() => changeDuration(15)}
                      className="inline-flex w-10 items-center justify-center border-l border-black/10 text-[#341c44] hover:bg-[#f5f5f5]"
                      aria-label="Augmenter la durée"
                      title="+15 min"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => changeDuration(-15)}
                      className="inline-flex w-10 items-center justify-center border-l border-t border-black/10 text-[#341c44] hover:bg-[#f5f5f5]"
                      aria-label="Diminuer la durée"
                      title="-15 min"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <label className="grid gap-1">
                <div className="text-xs font-extrabold text-black/60">Note</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[#341c44] ring-1 ring-black/10"
                />
              </label>

              <button
                type="button"
                disabled={isPending || !clientId || !date || !time || !duration}
                onClick={() => {
                  const start = parseLocalDateTime(date, time)
                  const end = addMinutes(start, duration)

                  const optimisticId = `optimistic-${start.getTime()}`
                  const client = clients.find((c) => c.id === clientId)
                  const optimisticTitle = `Séance présentiel — ${client?.full_name ?? 'Client'}`

                  setEvents((prev) => [
                    ...prev,
                    {
                      id: optimisticId,
                      owner_coach_id: currentUserId,
                      client_id: clientId,
                      title: optimisticTitle,
                      start_at: start.toISOString(),
                      end_at: end.toISOString(),
                      notes: notes.length > 0 ? notes : null,
                    },
                  ])

                  const fd = new FormData()
                  fd.set('client_id', clientId)
                  fd.set('date', date)
                  fd.set('time', time)
                  fd.set('duration_min', String(duration))
                  fd.set('notes', notes)

                  startTransition(async () => {
                    await createSessionAction(fd)
                    router.refresh()
                    setIsOpen(false)
                  })
                }}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#341c44] px-4 text-sm font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                Envoyer la demande de séance
              </button>
            </div>
          </div>
        </div>
      ) : detailDay ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (isPending) return
              closeDetails()
            }}
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-base font-extrabold text-[#341c44]">
                  {detailDayDate
                    ? new Intl.DateTimeFormat('fr-FR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      }).format(detailDayDate)
                    : detailDay}
                </div>
                <div className="mt-1 text-xs font-semibold text-black/50">
                  {detailEvent ? 'Détail de la séance' : `${detailDayEvents.length} séance(s)`}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!detailEvent ? (
                  <button
                    type="button"
                    onClick={() => {
                      openCreateForDay(detailDay)
                    }}
                    aria-label="Ajouter une séance"
                    title="Ajouter une séance"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#341c44] text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44]/30"
                  >
                    +
                  </button>
                ) : null}
                {detailEvent ? (
                  <button
                    type="button"
                    onClick={() => setDetailEventId(null)}
                    className="inline-flex h-9 items-center justify-center rounded-2xl bg-white px-3 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                    aria-label="Retour"
                    title="Retour"
                  >
                    ←
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (isPending) return
                    closeDetails()
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="max-h-[calc(78vh-76px)] overflow-auto px-4 pb-4 pt-2">
              {detailEvent ? (
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-[#341c44]/5 p-3">
                    <div className="text-sm font-extrabold text-[#341c44]">{detailEvent.title}</div>
                    <div className="mt-1 text-xs font-semibold text-black/60">
                      {clientNameById.get(detailEvent.client_id ?? '') ?? 'Client'}
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/10">
                    <div className="text-xs font-extrabold text-black/60">Horaire</div>
                    <div className="text-sm font-semibold text-[#341c44]">
                      {formatTime(detailEvent.start_at)}
                      {detailEvent.end_at ? ` – ${formatTime(detailEvent.end_at)}` : ''}
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/10">
                    <div className="text-xs font-extrabold text-black/60">Note</div>
                    <div className="text-sm font-semibold text-black/70">{detailEvent.notes?.trim() ? detailEvent.notes : '—'}</div>
                  </div>

                  <button
                    type="button"
                    disabled={isPending || detailEvent.id.startsWith('optimistic-')}
                    onClick={() => {
                      const fd = new FormData()
                      fd.set('id', detailEvent.id)

                      startTransition(async () => {
                        await deleteSessionAction(fd)
                        setEvents((prev) => prev.filter((e) => e.id !== detailEvent.id))
                        router.refresh()
                        setDetailEventId(null)
                      })
                    }}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-4 text-sm font-extrabold text-red-600 ring-1 ring-black/10 hover:bg-[#f5f5f5] disabled:opacity-50"
                  >
                    Supprimer la séance
                  </button>
                </div>
              ) : detailDayEvents.length > 0 ? (
                <div className="grid gap-2">
                  {detailDayEvents.map((ev, idx) => (
                    <div
                      key={ev.id}
                      className={(idx === 0 ? 'mt-1 ' : '') + 'grid gap-1 rounded-2xl bg-white p-3 text-left ring-1 ring-black/10'}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailEventId(ev.id)}
                        className="flex items-start justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-[#341c44]">{ev.title}</div>
                          <div className="mt-0.5 truncate text-xs font-semibold text-black/60">
                            {clientNameById.get(ev.client_id ?? '') ?? 'Client'}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs font-extrabold tabular-nums text-black/50">{formatTime(ev.start_at)}</div>
                      </button>

                      {ev.owner_coach_id === currentUserId && !ev.id.startsWith('optimistic-') ? (
                        <button
                          type="button"
                          onClick={() => {
                            const fd = new FormData()
                            fd.set('id', ev.id)
                            startTransition(async () => {
                              await deleteSessionAction(fd)
                              setEvents((prev) => prev.filter((e) => e.id !== ev.id))
                              router.refresh()
                            })
                          }}
                          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-red-600 ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                          aria-label="Supprimer"
                          title="Supprimer"
                        >
                          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      ) : null}

                      {ev.notes?.trim() ? (
                        <div className="truncate text-xs font-semibold text-black/45">{ev.notes}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-black/60 ring-1 ring-black/10">
                  Aucune séance ce jour.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
