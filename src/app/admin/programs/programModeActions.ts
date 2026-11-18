'use server'

import { redirect } from 'next/navigation'

import {
  decodeDaySessionOrder,
  encodeDaySessionOrder,
  renumberDayOrders,
} from '@/src/lib/programs/builderDayOrder'
import {
  flattenWeekSessionsToSlots,
  mapSlotDaysToCalendar,
} from '@/src/lib/programs/flattenWeekSessionsToSlots'
import {
  assertEditableBuilderProgram,
  requireProgramBuilderUser,
} from '@/src/lib/programs/programBuilderAccess'
import { createClient } from '@/src/lib/supabase/server'
import type { BoardMutationPatch } from '@/src/app/admin/programs/programSessionActions'
import type { WeekBoardPatch } from '@/src/app/admin/programs/programWeekActions'

export type ConvertModeResult =
  | {
      ok: true
      flash: string
      refresh?: boolean
      is_calendar: boolean
      board: WeekBoardPatch & { deletedSessionIds?: string[] }
    }
  | { ok: false; error: string }

/** @deprecated alias */
export type ConvertToSlotsResult = ConvertModeResult

async function requireBuilder() {
  return requireProgramBuilderUser({ adminLoginRedirect: '/loginadmin' })
}

async function assertProgram(
  ...args: Parameters<typeof assertEditableBuilderProgram>
) {
  return assertEditableBuilderProgram(...args)
}

async function loadProgramWeeksAndSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  programId: string,
) {
  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  const weeks = (weeksRaw ?? []) as { id: string; title: string | null; week_order: number }[]
  if (!weeks.length) return { weeks, byWeek: new Map<string, { id: string; session_order: number }[]>() }

  const weekIds = weeks.map((w) => w.id)
  const { data: sessRaw } = await supabase
    .from('sessions')
    .select('id,week_id,session_order')
    .in('week_id', weekIds)

  const sessions = (sessRaw ?? []) as {
    id: string
    week_id: string
    session_order: number
  }[]

  const byWeek = new Map<string, { id: string; session_order: number }[]>()
  for (const s of sessions) {
    const list = byWeek.get(s.week_id) ?? []
    list.push(s)
    byWeek.set(s.week_id, list)
  }
  return { weeks, byWeek }
}

/**
 * Calendrier → journées :
 * jours non vides Lun→Sam → slots compactés multi-séances ;
 * Dimanche purgé ; is_calendar = false.
 * Quiet : pas de revalidatePath (évite remount RSC).
 */
export async function convertTrainlyProgramToSlotsQuietAction(
  formData: FormData,
): Promise<ConvertModeResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const stayWeekId = String(formData.get('week_id') ?? '').trim() || null
  if (!programId) return { ok: false, error: 'Paramètres manquants' }

  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }
  if (!program.is_calendar) {
    return { ok: false, error: 'Ce programme est déjà en mode journées' }
  }

  const { weeks, byWeek } = await loadProgramWeeksAndSessions(supabase, programId)
  if (!weeks.length) return { ok: false, error: 'Aucune semaine' }

  const allOrders: { id: string; session_order: number }[] = []
  const allDeleteIds: string[] = []

  for (const week of weeks) {
    const { keep, deleteIds } = flattenWeekSessionsToSlots(byWeek.get(week.id) ?? [])
    allOrders.push(...keep)
    allDeleteIds.push(...deleteIds)
  }

  for (const o of allOrders) {
    const { error } = await supabase
      .from('sessions')
      .update({ session_order: o.session_order } as never)
      .eq('id', o.id)
    if (error) return { ok: false, error: error.message }
  }

  if (allDeleteIds.length) {
    const { error: delErr } = await supabase.from('sessions').delete().in('id', allDeleteIds)
    if (delErr) return { ok: false, error: delErr.message }
  }

  const { error: progErr } = await supabase
    .from('programs')
    .update({
      is_calendar: false,
      start_date: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)
  if (progErr) return { ok: false, error: progErr.message }

  const openWeekId =
    (stayWeekId && weeks.some((w) => w.id === stayWeekId) ? stayWeekId : null) ??
    weeks[0]?.id ??
    null

  return {
    ok: true,
    flash: 'Mode journées',
    refresh: false,
    is_calendar: false,
    board: {
      weeks,
      openWeekId,
      sessionOrders: allOrders,
      deletedSessionIds: allDeleteIds,
    },
  }
}

/**
 * Journées → calendrier : Jour 1 sur startDay, puis enchaîne jusqu’à Dimanche.
 * Pas de wrap — les journées au-delà sont purgées.
 * Quiet : pas de revalidatePath.
 */
export async function convertTrainlyProgramToCalendarQuietAction(
  formData: FormData,
): Promise<ConvertModeResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const stayWeekId = String(formData.get('week_id') ?? '').trim() || null
  const startDayRaw = Number.parseInt(String(formData.get('start_day') ?? '0'), 10)
  const startDay = Number.isFinite(startDayRaw) ? Math.min(Math.max(startDayRaw, 0), 6) : 0

  if (!programId) return { ok: false, error: 'Paramètres manquants' }

  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }
  if (program.is_calendar) {
    return { ok: false, error: 'Ce programme est déjà en mode calendrier' }
  }

  const { weeks, byWeek } = await loadProgramWeeksAndSessions(supabase, programId)
  if (!weeks.length) return { ok: false, error: 'Aucune semaine' }

  const allOrders: { id: string; session_order: number }[] = []
  const allDeleteIds: string[] = []

  for (const week of weeks) {
    const { keep, deleteIds } = mapSlotDaysToCalendar(byWeek.get(week.id) ?? [], startDay)
    allOrders.push(...keep)
    allDeleteIds.push(...deleteIds)
  }

  for (const o of allOrders) {
    const { error } = await supabase
      .from('sessions')
      .update({ session_order: o.session_order } as never)
      .eq('id', o.id)
    if (error) return { ok: false, error: error.message }
  }

  if (allDeleteIds.length) {
    const { error: delErr } = await supabase.from('sessions').delete().in('id', allDeleteIds)
    if (delErr) return { ok: false, error: delErr.message }
  }

  const { error: progErr } = await supabase
    .from('programs')
    .update({
      is_calendar: true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)
  if (progErr) return { ok: false, error: progErr.message }

  const openWeekId =
    (stayWeekId && weeks.some((w) => w.id === stayWeekId) ? stayWeekId : null) ??
    weeks[0]?.id ??
    null

  return {
    ok: true,
    flash: 'Mode calendrier',
    refresh: false,
    is_calendar: true,
    board: {
      weeks,
      openWeekId,
      sessionOrders: allOrders,
      deletedSessionIds: allDeleteIds,
    },
  }
}

/**
 * Retire une journée-slot (mode hors calendrier) : purge ses séances,
 * décale les journées suivantes (day-1), sans wrap.
 */
export async function removeTrainlyProgramSlotDayQuietAction(
  formData: FormData,
): Promise<
  | { ok: true; board: BoardMutationPatch; flash?: string }
  | { ok: false; error: string }
> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const dayRaw = Number.parseInt(String(formData.get('day') ?? ''), 10)
  if (!programId || !weekId || !Number.isFinite(dayRaw)) {
    return { ok: false, error: 'Paramètres manquants' }
  }
  const day = Math.min(Math.max(dayRaw, 0), 5)

  const program = await assertProgram(supabase, programId, auth)
  if (!program) return { ok: false, error: 'Programme introuvable' }
  if (program.is_calendar) {
    return { ok: false, error: 'Retrait de journée réservé au mode journées' }
  }

  const { data: week } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()
  if (!week) return { ok: false, error: 'Semaine introuvable' }

  const { data: sessRaw } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const all = (sessRaw ?? []) as { id: string; session_order: number }[]
  const deleteIds: string[] = []
  const keepByDay = new Map<number, { id: string }[]>()

  for (const s of all) {
    const { day: d } = decodeDaySessionOrder(s.session_order)
    if (d === day) {
      deleteIds.push(s.id)
      continue
    }
    const newDay = d > day ? d - 1 : d
    if (newDay < 0 || newDay > 5) continue
    const list = keepByDay.get(newDay) ?? []
    list.push({ id: s.id })
    keepByDay.set(newDay, list)
  }

  if (deleteIds.length) {
    const { error: delErr } = await supabase.from('sessions').delete().in('id', deleteIds)
    if (delErr) return { ok: false, error: delErr.message }
  }

  const orders: { id: string; session_order: number }[] = []
  for (const [d, list] of keepByDay) {
    orders.push(...renumberDayOrders(d, list))
  }

  for (const o of orders) {
    const { error } = await supabase
      .from('sessions')
      .update({ session_order: o.session_order } as never)
      .eq('id', o.id)
    if (error) return { ok: false, error: error.message }
  }

  return {
    ok: true,
    flash: `Jour ${day + 1} retiré`,
    board: {
      sessionOrders: orders,
      deletedSessionIds: deleteIds,
    },
  }
}
