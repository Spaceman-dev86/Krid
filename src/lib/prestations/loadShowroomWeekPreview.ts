import type { SupabaseClient } from '@supabase/supabase-js'

import { decodeDaySessionOrder } from '../programs/builderDayOrder'

export const SHOWROOM_DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

export type ShowroomWeekDayPreview = {
  dayIndex: number
  label: string
  sessions: { id: string; title: string }[]
}

export type ShowroomWeekPreview = {
  id: string
  title: string
  weekOrder: number
  days: ShowroomWeekDayPreview[]
}

export type ShowroomWeekOption = {
  id: string
  programId: string
  title: string
  weekOrder: number
}

/** Liste des semaines d’un (ou plusieurs) programmes pour le sélecteur coach. */
export async function loadShowroomWeekOptions(
  supabase: SupabaseClient,
  programIds: string[],
): Promise<ShowroomWeekOption[]> {
  const ids = [...new Set(programIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (!ids.length) return []

  const { data } = await supabase
    .from('program_weeks')
    .select('id, program_id, title, week_order')
    .in('program_id', ids)
    .order('week_order', { ascending: true })

  return ((data ?? []) as Array<{
    id: string
    program_id: string
    title: string | null
    week_order: number | null
  }>).map((w) => ({
    id: w.id,
    programId: w.program_id,
    title: String(w.title ?? '').trim() || `Semaine ${(w.week_order ?? 0) + 1}`,
    weekOrder: w.week_order ?? 0,
  }))
}

function buildWeekPreview(
  week: { id: string; title: string | null; week_order: number | null },
  sessions: Array<{ id: string; title: string | null; session_order: number }>,
): ShowroomWeekPreview {
  const byDay = new Map<number, { id: string; title: string }[]>()
  for (let d = 0; d < 7; d++) byDay.set(d, [])

  for (const s of sessions) {
    const { day } = decodeDaySessionOrder(s.session_order)
    const list = byDay.get(day) ?? []
    list.push({
      id: s.id,
      title: String(s.title ?? '').trim() || 'Séance',
    })
    byDay.set(day, list)
  }

  const days: ShowroomWeekDayPreview[] = SHOWROOM_DAY_LABELS.map((label, dayIndex) => ({
    dayIndex,
    label,
    sessions: byDay.get(dayIndex) ?? [],
  }))

  return {
    id: week.id,
    title: String(week.title ?? '').trim() || `Semaine ${(week.week_order ?? 0) + 1}`,
    weekOrder: week.week_order ?? 0,
    days,
  }
}

/** Aperçu compact Lun→Dim pour la popup showroom. */
export async function loadShowroomWeekPreview(
  supabase: SupabaseClient,
  weekId: string | null | undefined,
): Promise<ShowroomWeekPreview | null> {
  const id = String(weekId ?? '').trim()
  if (!id) return null
  const map = await loadShowroomWeekPreviews(supabase, [id])
  return map[id] ?? null
}

/** Charge plusieurs aperçus semaine (1 round-trip sessions). */
export async function loadShowroomWeekPreviews(
  supabase: SupabaseClient,
  weekIds: string[],
): Promise<Record<string, ShowroomWeekPreview>> {
  const ids = [...new Set(weekIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (!ids.length) return {}

  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id, title, week_order')
    .in('id', ids)

  const weeks = (weeksRaw ?? []) as Array<{
    id: string
    title: string | null
    week_order: number | null
  }>
  if (!weeks.length) return {}

  const { data: sessionsRaw } = await supabase
    .from('sessions')
    .select('id, title, session_order, week_id')
    .in('week_id', weeks.map((w) => w.id))
    .order('session_order', { ascending: true })

  const sessions = (sessionsRaw ?? []) as Array<{
    id: string
    title: string | null
    session_order: number
    week_id: string
  }>

  const byWeek = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const list = byWeek.get(s.week_id) ?? []
    list.push(s)
    byWeek.set(s.week_id, list)
  }

  const out: Record<string, ShowroomWeekPreview> = {}
  for (const w of weeks) {
    out[w.id] = buildWeekPreview(w, byWeek.get(w.id) ?? [])
  }
  return out
}
