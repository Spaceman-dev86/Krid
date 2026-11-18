'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent,
} from 'react'

import {
  addDays,
  buildWeekDays,
  startOfWeekMonday,
  toIsoDate,
  weekRangeLabel,
  type CalendarDay,
} from '@/src/lib/client-portal/weekCalendar'
import {
  addMonths,
  buildMonthGrid,
  eventsByDay,
  monthTitle,
  startOfMonth,
  slotsForDay,
  slotChipMeta,
  WEEK_HOUR_MARKS,
  WEEK_DAY_START_H,
  WEEK_DAY_END_H,
  weekSlotLayout,
  type CoachCalEvent,
  type DaySlot,
} from './calendarUi'

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const
const ANIM_MS = 520
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

type ViewMode = 'month' | 'week'
type MonthCell = ReturnType<typeof buildMonthGrid>[number]

type Props = {
  events: CoachCalEvent[]
  onDayClick: (iso: string) => void
  initialView?: ViewMode
  initialMonthIso?: string
  initialWeekStartIso?: string
}

export function CoachCalendarBoard({
  events,
  onDayClick,
  initialView = 'month',
  initialMonthIso,
  initialWeekStartIso,
}: Props) {
  const todayIso = toIsoDate(new Date())
  const [view, setView] = useState<ViewMode>(initialView)
  const [cursorMonth, setCursorMonth] = useState(() =>
    initialMonthIso
      ? startOfMonth(new Date(initialMonthIso + 'T12:00:00'))
      : startOfMonth(new Date()),
  )
  const [weekStart, setWeekStart] = useState(() =>
    initialWeekStartIso
      ? new Date(initialWeekStartIso + 'T12:00:00')
      : startOfWeekMonday(new Date()),
  )

  const [strip, setStrip] = useState<{
    a: Date
    b: Date | null
    fromPct: number
    toPct: number
    animating: boolean
  }>(() => ({
    a: initialView === 'week' ? weekStart : cursorMonth,
    b: null,
    fromPct: 0,
    toPct: 0,
    animating: false,
  }))

  const byDay = useMemo(() => eventsByDay(events), [events])
  const busy = strip.animating
  const surfaceRef = useRef<HTMLDivElement>(null)
  const wheelLock = useRef(0)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const pendingCommit = useRef<Date | null>(null)
  const viewRef = useRef(view)
  const busyRef = useRef(busy)
  const cursorMonthRef = useRef(cursorMonth)
  const weekStartRef = useRef(weekStart)
  viewRef.current = view
  busyRef.current = busy
  cursorMonthRef.current = cursorMonth
  weekStartRef.current = weekStart

  useEffect(() => {
    if (busy) return
    setStrip({
      a: view === 'month' ? cursorMonth : weekStart,
      b: null,
      fromPct: 0,
      toPct: 0,
      animating: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on view toggle only
  }, [view])

  const shift = useCallback((delta: number) => {
    if (busyRef.current || !delta) return
    const v = viewRef.current
    const current = v === 'month' ? cursorMonthRef.current : weekStartRef.current
    const next = v === 'month' ? addMonths(current, delta) : addDays(current, delta * 7)

    pendingCommit.current = next

    if (delta > 0) {
      setStrip({ a: current, b: next, fromPct: 0, toPct: 0, animating: false })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStrip({ a: current, b: next, fromPct: 0, toPct: -50, animating: true })
        })
      })
    } else {
      setStrip({ a: next, b: current, fromPct: -50, toPct: -50, animating: false })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStrip({ a: next, b: current, fromPct: -50, toPct: 0, animating: true })
        })
      })
    }
  }, [])

  // Bloque le scroll page sur la zone calendrier (wheel passive:false).
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)
      if (absX < 6 && absY < 6) return

      const now = Date.now()
      if (now - wheelLock.current < ANIM_MS + 60) return

      const v = viewRef.current
      if (v === 'month') {
        if (absY < 10) return
        // Mois : haut / bas uniquement
        if (absY < absX) return
        wheelLock.current = now
        shift(e.deltaY > 0 ? 1 : -1)
        return
      }

      // Semaine : gauche / droite (trackpad) ; molette verticale aussi → semaine
      if (absX >= absY && absX >= 8) {
        wheelLock.current = now
        shift(e.deltaX > 0 ? 1 : -1)
        return
      }
      if (absY >= 10) {
        wheelLock.current = now
        shift(e.deltaY > 0 ? 1 : -1)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [shift])

  function onTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== 'transform') return
    const next = pendingCommit.current
    pendingCommit.current = null
    if (next) {
      if (viewRef.current === 'month') setCursorMonth(startOfMonth(next))
      else setWeekStart(next)
    }
    setStrip({
      a: next ?? (viewRef.current === 'month' ? cursorMonthRef.current : weekStartRef.current),
      b: null,
      fromPct: 0,
      toPct: 0,
      animating: false,
    })
  }

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    swipe.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    if (!swipe.current || busy) {
      swipe.current = null
      return
    }
    const dx = e.clientX - swipe.current.x
    const dy = e.clientY - swipe.current.y
    swipe.current = null
    if (view === 'month') {
      if (Math.abs(dy) < 48 || Math.abs(dy) < Math.abs(dx)) return
      shift(dy < 0 ? 1 : -1)
    } else {
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return
      shift(dx < 0 ? 1 : -1)
    }
  }

  function openWeekFromDay(iso: string) {
    const [y, m, d] = iso.split('-').map(Number)
    const date = new Date(y, (m ?? 1) - 1, d ?? 1)
    setWeekStart(startOfWeekMonday(date))
    setView('week')
  }

  function setViewMode(next: ViewMode) {
    if (next === view || busy) return
    if (next === 'week') {
      const now = new Date()
      const onCurrentMonth =
        cursorMonth.getFullYear() === now.getFullYear() &&
        cursorMonth.getMonth() === now.getMonth()
      // Mois courant → semaine d’aujourd’hui ; sinon semaine du 1er du mois affiché
      setWeekStart(startOfWeekMonday(onCurrentMonth ? now : cursorMonth))
    } else {
      setCursorMonth(startOfMonth(weekStart))
    }
    setView(next)
  }

  const titleDate =
    strip.b && strip.animating
      ? strip.toPct < strip.fromPct
        ? strip.b
        : strip.a
      : view === 'month'
        ? cursorMonth
        : weekStart

  const axis = view === 'month' ? 'y' : 'x'
  const stripStyle: CSSProperties = {
    transform:
      axis === 'y'
        ? `translate3d(0, ${strip.toPct}%, 0)`
        : `translate3d(${strip.toPct}%, 0, 0)`,
    transition: strip.animating ? `transform ${ANIM_MS}ms ${EASE}` : 'none',
    willChange: 'transform',
  }

  return (
    <section className="coach-cal-object pt-1">
      <div className="coach-cal-rings" aria-hidden>
        <span className="coach-cal-ring" />
        <span className="coach-cal-ring" />
      </div>

      <div className="coach-cal-pad">
        <header className="coach-cal-header">
          <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
                {view === 'month' ? 'Vue mois' : 'Vue semaine'}
              </p>
              <p className="mt-0.5 truncate text-lg font-extrabold capitalize tracking-tight text-[var(--brand-fg)] sm:text-xl">
                {view === 'month' ? monthTitle(titleDate) : weekRangeLabel(titleDate)}
              </p>
            </div>
            <div className="coach-cal-chip shrink-0">
              <button
                type="button"
                onClick={() => shift(-1)}
                disabled={busy}
                className="px-2.5 py-1.5 text-sm font-bold sm:px-3"
                aria-label="Période précédente"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide sm:px-3 ${
                  view === 'month' ? 'coach-cal-chip__active' : ''
                }`}
              >
                Mois
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide sm:px-3 ${
                  view === 'week' ? 'coach-cal-chip__active' : ''
                }`}
              >
                <span className="sm:hidden">Sem.</span>
                <span className="hidden sm:inline">Semaine</span>
              </button>
              <button
                type="button"
                onClick={() => shift(1)}
                disabled={busy}
                className="px-2.5 py-1.5 text-sm font-bold sm:px-3"
                aria-label="Période suivante"
              >
                →
              </button>
            </div>
          </div>
        </header>

        <div
          ref={surfaceRef}
          className="coach-cal-body select-none overscroll-contain"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipe.current = null
          }}
        >
          {view === 'month' ? (
            <>
              <div className="mb-2 grid grid-cols-7 gap-1.5 px-0.5 sm:gap-2">
                {DOW.map((d) => (
                  <div
                    key={d}
                    className="coach-cal-dow py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.14em] sm:text-[10px]"
                  >
                    <span className="sm:hidden">{d.slice(0, 1)}</span>
                    <span className="hidden sm:inline">{d}</span>
                  </div>
                ))}
              </div>
              <div className="coach-cal-well relative overflow-hidden">
                <div className="invisible pointer-events-none p-0.5" aria-hidden>
                  <MonthGrid
                    cells={buildMonthGrid(strip.a, todayIso)}
                    byDay={byDay}
                    onDayClick={onDayClick}
                    onDayZoom={openWeekFromDay}
                  />
                </div>
                <div className="absolute inset-0 overflow-hidden p-0.5">
                  <div className="flex w-full flex-col" style={stripStyle} onTransitionEnd={onTransitionEnd}>
                    <div className="w-full shrink-0">
                      <MonthGrid
                        cells={buildMonthGrid(strip.a, todayIso)}
                        byDay={byDay}
                        onDayClick={onDayClick}
                        onDayZoom={openWeekFromDay}
                      />
                    </div>
                    {strip.b ? (
                      <div className="w-full shrink-0">
                        <MonthGrid
                          cells={buildMonthGrid(strip.b, todayIso)}
                          byDay={byDay}
                          onDayClick={onDayClick}
                          onDayZoom={openWeekFromDay}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="coach-cal-hint mt-3 text-[10px]">
                Scroll haut / bas = mois · clic = détail · double-clic = semaine
              </p>
            </>
          ) : (
            <>
              <div className="coach-cal-well relative overflow-hidden">
                <div className="invisible pointer-events-none p-0.5" aria-hidden>
                  <WeekGrid
                    days={buildWeekDays(strip.a, todayIso)}
                    byDay={byDay}
                    onDayClick={onDayClick}
                  />
                </div>
                <div className="absolute inset-0 overflow-hidden p-0.5">
                  <div
                    className="flex flex-row"
                    style={{
                      ...stripStyle,
                      width: strip.b ? '200%' : '100%',
                    }}
                    onTransitionEnd={onTransitionEnd}
                  >
                    <div className="min-w-0 shrink-0" style={{ width: strip.b ? '50%' : '100%' }}>
                      <WeekGrid
                        days={buildWeekDays(strip.a, todayIso)}
                        byDay={byDay}
                        onDayClick={onDayClick}
                      />
                    </div>
                    {strip.b ? (
                      <div className="min-w-0 w-1/2 shrink-0">
                        <WeekGrid
                          days={buildWeekDays(strip.b, todayIso)}
                          byDay={byDay}
                          onDayClick={onDayClick}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="coach-cal-hint mt-3 text-[10px]">
                Scroll gauche / droite = semaine · clic = détail du jour
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function SlotPill({
  slot,
  dense,
}: {
  slot: DaySlot
  /** Mois mobile : heure seule (+ pip). */
  dense?: boolean
}) {
  const meta = slotChipMeta(slot)
  return (
    <span className="coach-cal-pill" title={meta.title}>
      <span className={`coach-cal-pill__pip ${meta.statusClass}`} aria-hidden />
      <span className="coach-cal-pill__time">{meta.time}</span>
      {!dense ? (
        <>
          <span className="coach-cal-pill__label">{meta.label}</span>
          {meta.isBatch && meta.rate ? (
            <span className="coach-cal-pill__meta">{meta.rate}</span>
          ) : null}
        </>
      ) : (
        <span className="coach-cal-pill__label hidden sm:inline">{meta.label}</span>
      )}
    </span>
  )
}

function MonthGrid({
  cells,
  byDay,
  onDayClick,
  onDayZoom,
}: {
  cells: MonthCell[]
  byDay: Record<string, CoachCalEvent[]>
  onDayClick: (iso: string) => void
  onDayZoom: (iso: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {cells.map((cell) => {
        const slots = slotsForDay(byDay[cell.iso] ?? [])
        const busyDay = slots.length > 0 && cell.inMonth
        const shown = slots.slice(0, 2)
        return (
          <button
            key={cell.iso}
            type="button"
            onClick={() => onDayClick(cell.iso)}
            onDoubleClick={() => onDayZoom(cell.iso)}
            className={`coach-cal-cell flex min-h-[3.1rem] min-w-0 flex-col items-stretch px-0.5 py-1 text-center sm:min-h-[5rem] sm:px-1 sm:py-1.5 ${
              cell.isToday ? 'coach-cal-cell--today' : ''
            } ${!cell.inMonth ? 'coach-cal-cell--muted' : ''} ${busyDay && !cell.isToday ? 'coach-cal-cell--busy' : ''}`}
          >
            <span className="coach-cal-cell__num self-center text-[11px] font-extrabold tabular-nums sm:text-sm">
              {cell.dayNum}
            </span>
            <span className="mt-0.5 flex min-h-[0.75rem] w-full flex-col items-stretch gap-0.5 sm:mt-1 sm:gap-1">
              {shown.map((slot) => (
                <SlotPill key={slot.key} slot={slot} dense />
              ))}
              {slots.length > 2 ? (
                <span className="self-center text-[8px] font-bold opacity-70 sm:text-[9px]">
                  +{slots.length - 2}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function WeekGrid({
  days,
  byDay,
  onDayClick,
}: {
  days: CalendarDay[]
  byDay: Record<string, CoachCalEvent[]>
  onDayClick: (iso: string) => void
}) {
  const hourSpan = WEEK_DAY_END_H - WEEK_DAY_START_H

  return (
    <div className="coach-cal-week">
      <div className="coach-cal-week__gutter" aria-hidden>
        <div className="coach-cal-week__gutter-head" />
        <div className="coach-cal-week__track">
          {WEEK_HOUR_MARKS.map((h) => {
            const pct = ((h - WEEK_DAY_START_H) / hourSpan) * 100
            return (
              <span
                key={h}
                className="coach-cal-week__hour-label"
                style={{ top: `clamp(0.35rem, ${pct}%, calc(100% - 0.35rem))` }}
              >
                {String(h).padStart(2, '0')}h
              </span>
            )
          })}
        </div>
      </div>

      <div className="coach-cal-week__days">
        {days.map((day) => {
          const slots = slotsForDay(byDay[day.iso] ?? [])
          const busyDay = slots.length > 0
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onDayClick(day.iso)}
              className={`coach-cal-week__day ${
                day.isToday ? 'coach-cal-week__day--today' : ''
              } ${busyDay && !day.isToday ? 'coach-cal-week__day--busy' : ''}`}
            >
              <span className="coach-cal-week__day-head">
                <span className="coach-cal-week__dow">
                  <span className="sm:hidden">{day.label.slice(0, 1)}</span>
                  <span className="hidden sm:inline">{day.label}</span>
                </span>
                <span className="coach-cal-week__dom">{day.dayNum}</span>
              </span>

              <span className="coach-cal-week__track">
                {WEEK_HOUR_MARKS.map((h) => (
                  <span
                    key={h}
                    className="coach-cal-week__hline"
                    style={{ top: `${((h - WEEK_DAY_START_H) / hourSpan) * 100}%` }}
                  />
                ))}
                {slots.map((slot) => {
                  const layout = weekSlotLayout(slot)
                  const meta = slotChipMeta(slot)
                  return (
                    <span
                      key={slot.key}
                      className="coach-cal-week__event"
                      title={meta.title}
                      style={{ top: `${layout.topPct}%`, height: `${layout.heightPct}%` }}
                    >
                      <span className={`coach-cal-week__event-pip ${meta.statusClass}`} />
                      <span className="coach-cal-week__event-body">
                        <span className="coach-cal-week__event-time">{meta.time}</span>
                        <span className="coach-cal-week__event-label">{meta.label}</span>
                        {meta.isBatch && meta.rate ? (
                          <span className="coach-cal-week__event-meta">{meta.rate}</span>
                        ) : null}
                      </span>
                    </span>
                  )
                })}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
