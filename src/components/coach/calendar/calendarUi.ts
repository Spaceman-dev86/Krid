import type { CalendarEventRow } from '@/src/lib/calendar/rdv'
import { formatRdvTime, rdvDateIso } from '@/src/lib/calendar/rdv'

export type CoachCalEvent = CalendarEventRow & { clientName: string; groupName?: string }

export type ClientOpt = { id: string; label: string }
export type GroupOpt = { id: string; label: string; memberIds: string[] }
export type PrestaOpt = { id: string; label: string }

export type DaySlot =
  | { kind: 'solo'; key: string; event: CoachCalEvent }
  | { kind: 'batch'; key: string; batchId: string; events: CoachCalEvent[]; title: string; groupLabel: string }

export function statusDotClass(status: CalendarEventRow['status']): string {
  switch (status) {
    case 'accepted':
      return 'bg-[var(--success)]'
    case 'requested':
      return 'bg-[var(--warning)]'
    case 'pending':
      return 'bg-[var(--brand)]'
    case 'refused':
      return 'bg-[var(--danger)]'
    default:
      return 'bg-[color:var(--muted)]'
  }
}

export type BatchCounts = {
  accepted: number
  pending: number
  refused: number
  total: number
}

export function batchCounts(events: CoachCalEvent[]): BatchCounts {
  const active = events.filter((e) => e.status !== 'cancelled')
  return {
    accepted: active.filter((e) => e.status === 'accepted').length,
    pending: active.filter((e) => e.status === 'pending' || e.status === 'requested').length,
    refused: active.filter((e) => e.status === 'refused').length,
    total: active.length,
  }
}

/** Pastille groupe selon taux d’acceptation. */
export function batchDotClass(events: CoachCalEvent[]): string {
  const c = batchCounts(events)
  if (c.total === 0) return 'bg-[color:var(--muted)]'
  if (c.accepted === c.total) return 'bg-[var(--success)]'
  if (c.refused > c.accepted && c.refused >= c.pending) return 'bg-[var(--danger)]'
  if (c.accepted === 0) return 'bg-[var(--warning)]'
  return 'bg-[var(--brand)]'
}

export function batchAcceptRateLabel(events: CoachCalEvent[]): string {
  const c = batchCounts(events)
  if (c.total === 0) return '—'
  return `${c.accepted}/${c.total} ok`
}

/** Libellés pastille : heure + qui / groupe. */
export function slotChipMeta(slot: DaySlot): {
  time: string
  label: string
  title: string
  statusClass: string
  isBatch: boolean
  rate?: string
} {
  if (slot.kind === 'batch') {
    const lead = slot.events[0]
    const rate = batchAcceptRateLabel(slot.events)
    return {
      time: formatRdvTime(lead?.starts_at),
      label: slot.groupLabel,
      title: `${slot.title} · ${slot.groupLabel} · ${rate}`,
      statusClass: batchDotClass(slot.events),
      isBatch: true,
      rate,
    }
  }
  const ev = slot.event
  const short =
    ev.clientName.split(/\s+/).filter(Boolean)[0]?.slice(0, 10) || ev.clientName.slice(0, 10) || 'Client'
  return {
    time: formatRdvTime(ev.starts_at),
    label: short,
    title: `${ev.title} · ${ev.clientName} · ${formatRdvTime(ev.starts_at)}`,
    statusClass: statusDotClass(ev.status),
    isBatch: false,
  }
}

/** Plage horaire vue semaine (planning construit). */
export const WEEK_DAY_START_H = 8
export const WEEK_DAY_END_H = 20
/** Heures affichées en grille (tous les 2 h). */
export const WEEK_HOUR_MARKS = [8, 10, 12, 14, 16, 18, 20] as const

export function localMinutesOfDay(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
}

/** Position % dans la colonne jour (0–100) pour un créneau. */
export function weekSlotLayout(slot: DaySlot): { topPct: number; heightPct: number } {
  const spanMin = (WEEK_DAY_END_H - WEEK_DAY_START_H) * 60
  const startIso = slot.kind === 'batch' ? slot.events[0]?.starts_at : slot.event.starts_at
  const endIso = slot.kind === 'batch' ? slot.events[0]?.ends_at : slot.event.ends_at
  const startMin = localMinutesOfDay(startIso)
  const endMin = localMinutesOfDay(endIso)
  const dayStart = WEEK_DAY_START_H * 60
  const rawStart = startMin == null ? dayStart : Math.max(dayStart, Math.min(WEEK_DAY_END_H * 60, startMin))
  let rawEnd =
    endMin == null
      ? rawStart + 60
      : Math.max(rawStart + 30, Math.min(WEEK_DAY_END_H * 60, endMin))
  if (rawEnd <= rawStart) rawEnd = Math.min(WEEK_DAY_END_H * 60, rawStart + 45)
  const topPct = ((rawStart - dayStart) / spanMin) * 100
  const heightPct = Math.max(4.5, ((rawEnd - rawStart) / spanMin) * 100)
  return { topPct, heightPct: Math.min(heightPct, 100 - topPct) }
}

/** Agrège les lignes d’un même batch en 1 slot (sinon solo). */
export function slotsForDay(events: CoachCalEvent[]): DaySlot[] {
  const slots: DaySlot[] = []
  const seenBatch = new Set<string>()
  for (const ev of events) {
    if (ev.batch_id && !seenBatch.has(ev.batch_id)) {
      const members = events.filter((e) => e.batch_id === ev.batch_id)
      if (members.length > 1) {
        seenBatch.add(ev.batch_id)
        slots.push({
          kind: 'batch',
          key: `batch:${ev.batch_id}`,
          batchId: ev.batch_id,
          events: members,
          title: ev.title,
          groupLabel: ev.groupName || 'Groupe',
        })
        continue
      }
    }
    if (ev.batch_id && seenBatch.has(ev.batch_id)) continue
    slots.push({ kind: 'solo', key: ev.id, event: ev })
  }
  return slots
}

export function eventsByDay(events: CoachCalEvent[]): Record<string, CoachCalEvent[]> {
  const map: Record<string, CoachCalEvent[]> = {}
  for (const ev of events) {
    if (!ev.starts_at || ev.status === 'cancelled') continue
    if (
      ev.status !== 'accepted' &&
      ev.status !== 'requested' &&
      ev.status !== 'pending' &&
      ev.status !== 'refused'
    ) {
      continue
    }
    const iso = rdvDateIso(ev.starts_at)
    if (!iso) continue
    ;(map[iso] ??= []).push(ev)
  }
  return map
}

export function formatDayTitle(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function monthTitle(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Grille mois Lun→Dim (cellules hors mois incluses). */
export function buildMonthGrid(month: Date, todayIso: string) {
  const first = startOfMonth(month)
  const day = first.getDay()
  const mondayBased = (day + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayBased)
  start.setHours(0, 0, 0, 0)

  const cells: {
    date: Date
    iso: string
    dayNum: number
    inMonth: boolean
    isToday: boolean
  }[] = []

  for (let i = 0; i < 42; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const da = String(date.getDate()).padStart(2, '0')
    const iso = `${y}-${mo}-${da}`
    cells.push({
      date,
      iso,
      dayNum: date.getDate(),
      inMonth: date.getMonth() === month.getMonth(),
      isToday: iso === todayIso,
    })
  }
  return cells
}
