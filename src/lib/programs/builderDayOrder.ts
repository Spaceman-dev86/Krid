/** Calendrier : session_order encode le jour + l’index dans le jour (multi-séances). */

export const DAY_ORDER_BASE = 1000
/** Plage dédiée au lundi (évite collision avec legacy 0–6). */
const MONDAY_ORDER_BASE = 10_000

/**
 * Encode jour + index.
 * - Lundi : 10000, 10001, … (jamais 1–6, qui sont des jours legacy)
 * - Mar–Dim : day * 1000 + index (1000+, 2000+, …)
 * - Legacy conservé en lecture : 0–6 = un seul ordre = jour
 */
export function encodeDaySessionOrder(dayIndex: number, indexInDay: number): number {
  const day = Math.min(Math.max(Math.floor(dayIndex), 0), 6)
  const idx = Math.max(0, Math.floor(indexInDay))
  if (day === 0) return MONDAY_ORDER_BASE + idx
  return day * DAY_ORDER_BASE + idx
}

export function decodeDaySessionOrder(sessionOrder: number): { day: number; index: number } {
  const n = Number(sessionOrder)
  if (!Number.isFinite(n) || n < 0) return { day: 0, index: 0 }

  // Lundi (nouvelle plage)
  if (n >= MONDAY_ORDER_BASE) {
    return { day: 0, index: n - MONDAY_ORDER_BASE }
  }

  // Legacy : 0–6 = un seul ordre = jour
  if (n < DAY_ORDER_BASE) {
    return { day: Math.min(Math.max(Math.floor(n), 0), 6), index: 0 }
  }

  return {
    day: Math.min(Math.floor(n / DAY_ORDER_BASE), 6),
    index: n % DAY_ORDER_BASE,
  }
}

export function groupSessionsByDay<T extends { session_order: number }>(
  sessions: T[],
): T[][] {
  const days: T[][] = Array.from({ length: 7 }, () => [])
  const sorted = sessions.slice().sort((a, b) => a.session_order - b.session_order)
  for (const s of sorted) {
    const { day } = decodeDaySessionOrder(s.session_order)
    days[day].push(s)
  }
  return days
}

/** Réécrit les session_order d’un jour pour 0..n-1 contigus. */
export function renumberDayOrders(
  dayIndex: number,
  sessionsInDayOrder: { id: string }[],
): { id: string; session_order: number }[] {
  return sessionsInDayOrder.map((s, i) => ({
    id: s.id,
    session_order: encodeDaySessionOrder(dayIndex, i),
  }))
}
