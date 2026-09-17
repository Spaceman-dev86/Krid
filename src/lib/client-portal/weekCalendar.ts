import type { SessionRunStyle } from './sessionRuns'

export type CalendarDay = {
  date: Date
  iso: string // YYYY-MM-DD
  label: string // Lun, Mar…
  dayNum: number
  isToday: boolean
  isWeekend: boolean
}

export type CalendarSessionDot = {
  id: string
  title: string
  style: SessionRunStyle | 'todo' | 'rdv' | 'rdv_pending' | 'meal' | 'meal_done'
  href: string
  dateIso: string
  kind?: 'session' | 'rdv' | 'meal'
  /** Pour valider un repas depuis Accueil. */
  mealMeta?: {
    planId: string
    mealId: string
    dayDate: string
    validated: boolean
  }
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Lundi de la semaine contenant `ref` (local). */
export function startOfWeekMonday(ref: Date = new Date()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const day = d.getDay() // 0=dim
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  out.setDate(out.getDate() + n)
  return out
}

export function buildWeekDays(weekStart: Date, todayIso?: string): CalendarDay[] {
  const today = todayIso ?? toIsoDate(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    const iso = toIsoDate(date)
    return {
      date,
      iso,
      label: DAY_LABELS[i],
      dayNum: date.getDate(),
      isToday: iso === today,
      isWeekend: i >= 5,
    }
  })
}

export function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return `${fmt(weekStart)} – ${fmt(end)}`
}

export function styleDotClass(
  style: SessionRunStyle | 'todo' | 'rdv' | 'rdv_pending' | 'meal' | 'meal_done'
): string {
  switch (style) {
    case 'fait':
      return 'bg-emerald-500'
    case 'fait_edite':
      return 'bg-teal-500'
    case 'en_cours':
      return 'bg-sky-500'
    case 'pas_fait':
      return 'bg-amber-500'
    case 'libre':
      return 'bg-violet-500'
    case 'rdv':
      return 'bg-rose-500'
    case 'rdv_pending':
      return 'bg-orange-400'
    case 'meal':
      return 'bg-lime-500'
    case 'meal_done':
      return 'bg-emerald-600'
    case 'todo':
    default:
      return 'bg-black/25'
  }
}

export function styleChipClass(
  style: SessionRunStyle | 'todo' | 'rdv' | 'rdv_pending' | 'meal' | 'meal_done'
): string {
  switch (style) {
    case 'fait':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'fait_edite':
      return 'bg-teal-50 text-teal-900 ring-teal-100'
    case 'en_cours':
      return 'bg-sky-50 text-sky-900 ring-sky-100'
    case 'pas_fait':
      return 'bg-amber-50 text-amber-900 ring-amber-100'
    case 'libre':
      return 'bg-violet-50 text-violet-900 ring-violet-100'
    case 'rdv':
      return 'bg-rose-50 text-rose-900 ring-rose-100'
    case 'rdv_pending':
      return 'bg-orange-50 text-orange-900 ring-orange-100'
    case 'meal':
      return 'bg-lime-50 text-lime-900 ring-lime-100'
    case 'meal_done':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
    case 'todo':
    default:
      return 'bg-black/5 text-black/55 ring-black/10'
  }
}
