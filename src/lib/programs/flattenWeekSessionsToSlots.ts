import {
  encodeDaySessionOrder,
  groupSessionsByDay,
} from '@/src/lib/programs/builderDayOrder'

/** Max journées-slots / semaine (Lun→Sam ; Dimanche exclu à la convert). */
export const MAX_SLOT_DAYS_PER_WEEK = 6

/** Index jour calendrier Dimanche (purge à la convert). */
export const SUNDAY_DAY_INDEX = 6

export type FlattenWeekSessionsResult = {
  keep: { id: string; session_order: number }[]
  deleteIds: string[]
}

/**
 * Calendrier → slots (slot = journée) :
 * - jours non vides Lun→Sam (0…5) → slots compactés 0…k-1
 * - multi-séances / jour conservées via encodeDaySessionOrder(slot, index)
 * - Dimanche (6) : toutes les séances → deleteIds
 */
export function flattenWeekSessionsToSlots<T extends { id: string; session_order: number }>(
  sessions: T[],
  maxSlots: number = MAX_SLOT_DAYS_PER_WEEK,
): FlattenWeekSessionsResult {
  const byDay = groupSessionsByDay(sessions)
  const cap = Math.min(MAX_SLOT_DAYS_PER_WEEK, Math.max(0, Math.floor(maxSlots)))
  const keep: { id: string; session_order: number }[] = []
  const deleteIds: string[] = []

  let slotIndex = 0
  for (let day = 0; day < SUNDAY_DAY_INDEX; day += 1) {
    const daySessions = byDay[day] ?? []
    if (!daySessions.length) continue
    if (slotIndex >= cap) {
      for (const s of daySessions) deleteIds.push(s.id)
      continue
    }
    daySessions.forEach((s, i) => {
      keep.push({ id: s.id, session_order: encodeDaySessionOrder(slotIndex, i) })
    })
    slotIndex += 1
  }

  for (const s of byDay[SUNDAY_DAY_INDEX] ?? []) {
    deleteIds.push(s.id)
  }

  return { keep, deleteIds }
}

/** Séances Dimanche (et éventuel overflow) purgées — message popup. */
export function countSundaySessionsToDeleteOnSlotsConvert(
  sessionsByWeek: { week_id: string; id: string; session_order: number }[],
): number {
  const byWeek = new Map<string, { id: string; session_order: number }[]>()
  for (const s of sessionsByWeek) {
    const list = byWeek.get(s.week_id) ?? []
    list.push(s)
    byWeek.set(s.week_id, list)
  }
  let n = 0
  for (const list of byWeek.values()) {
    n += flattenWeekSessionsToSlots(list).deleteIds.length
  }
  return n
}

/** @deprecated alias — préférer countSundaySessionsToDeleteOnSlotsConvert */
export const countSessionsToDeleteOnSlotsConvert = countSundaySessionsToDeleteOnSlotsConvert

export type MapSlotDaysToCalendarResult = {
  keep: { id: string; session_order: number }[]
  deleteIds: string[]
  /** Nombre de journées-slots qui ne rentrent pas (au-delà de Dimanche). */
  deletedDayCount: number
}

/**
 * Journées → calendrier (sans wrap) :
 * Jour i → startDay + i si ≤ Dimanche, sinon séances purgées.
 * Ex. start=Mer + 6 journées → Mer…Dim gardés, 6ᵉ journée supprimée.
 */
export function mapSlotDaysToCalendar<T extends { id: string; session_order: number }>(
  sessions: T[],
  startDay: number,
): MapSlotDaysToCalendarResult {
  const start = Math.min(Math.max(Math.floor(startDay), 0), 6)
  const byDay = groupSessionsByDay(sessions)
  const keep: { id: string; session_order: number }[] = []
  const deleteIds: string[] = []
  let deletedDayCount = 0

  for (let slot = 0; slot < MAX_SLOT_DAYS_PER_WEEK; slot += 1) {
    const daySessions = byDay[slot] ?? []
    if (!daySessions.length) continue
    const calDay = start + slot
    if (calDay > 6) {
      deletedDayCount += 1
      for (const s of daySessions) deleteIds.push(s.id)
      continue
    }
    daySessions.forEach((s, i) => {
      keep.push({ id: s.id, session_order: encodeDaySessionOrder(calDay, i) })
    })
  }

  return { keep, deleteIds, deletedDayCount }
}

/** Journées qui seraient purgées (toutes semaines) pour un startDay donné. */
export function countDaysDeletedOnCalendarConvert(
  sessionsByWeek: { week_id: string; id: string; session_order: number }[],
  startDay: number,
): number {
  const byWeek = new Map<string, { id: string; session_order: number }[]>()
  for (const s of sessionsByWeek) {
    const list = byWeek.get(s.week_id) ?? []
    list.push(s)
    byWeek.set(s.week_id, list)
  }
  let n = 0
  for (const list of byWeek.values()) {
    n += mapSlotDaysToCalendar(list, startDay).deletedDayCount
  }
  return n
}
