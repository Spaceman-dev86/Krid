'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { durationLabelFromWeekCount } from '@/src/lib/formatProgramDuration'
import { reorderScopedRowsTwoPass } from '@/src/lib/persistence/reorderUniquePositions'
import { duplicateProgramWeekContents } from '@/src/lib/programs/duplicateProgramWeekContents'
import {
  assertEditableBuilderProgram,
  requireProgramBuilderUser,
} from '@/src/lib/programs/programBuilderAccess'

export type WeekBoardPatch = {
  weeks: { id: string; title: string | null; week_order: number }[]
  openWeekId: string | null
  /** Séances de la semaine ouverte (après duplicate). */
  weekSessions?: {
    id: string
    week_id: string
    title: string | null
    session_order: number
    notes?: string | null
    objective_ressenti?: boolean
    objective_note?: boolean
    objective_difficulty?: boolean
    composition_version?: number
    item_count: number
    items: import('@/src/app/admin/programs/programSessionActions').CompositionLiveItem[]
    compositionSlots: import('@/src/app/admin/programs/programSessionActions').CompositionLiveSlot[]
  }[]
  /** Ordres à merger (ex. semaine source après duplicate) — jamais un wipe global. */
  sessionOrders?: { id: string; session_order: number }[]
}

export type WeekQuietResult =
  | { ok: true; board: WeekBoardPatch; flash?: string; refresh?: boolean }
  | { ok: false; error: string }

async function requireBuilder() {
  return requireProgramBuilderUser({ adminLoginRedirect: '/loginadmin' })
}

async function assertProgram(
  ...args: Parameters<typeof assertEditableBuilderProgram>
) {
  return assertEditableBuilderProgram(...args)
}

function builderPath(programId: string, weekId?: string | null, ok?: string, error?: string) {
  const q = new URLSearchParams()
  if (weekId) q.set('week', weekId)
  if (ok) q.set('ok', ok)
  if (error) q.set('error', error)
  const qs = q.toString()
  return `/admin/programs/${programId}${qs ? `?${qs}` : ''}`
}

export async function renameTrainlyProgramWeekAction(formData: FormData) {
  const quiet = await renameTrainlyProgramWeekQuietAction(formData)
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  if (!quiet.ok) {
    if (!programId) redirect('/admin/programs')
    redirect(builderPath(programId, weekId || null, undefined, quiet.error))
  }
  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, quiet.board.openWeekId ?? weekId, 'week_renamed'))
}

/** Renomme une semaine sans redirect — patch weeksLive. */
export async function renameTrainlyProgramWeekQuietAction(
  formData: FormData,
): Promise<WeekQuietResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!programId || !weekId) return { ok: false, error: 'Paramètres manquants' }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable' }
  }

  const { error } = await supabase
    .from('program_weeks')
    .update({ title: title || null } as never)
    .eq('id', weekId)
    .eq('program_id', programId)

  if (error) return { ok: false, error: error.message }

  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  return {
    ok: true,
    flash: 'Semaine renommée',
    refresh: false,
    board: {
      weeks: (weeksRaw ?? []) as { id: string; title: string | null; week_order: number }[],
      openWeekId: weekId,
    },
  }
}

export async function duplicateTrainlyProgramWeekAction(formData: FormData) {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  if (!programId || !weekId) redirect('/admin/programs')
  if (!(await assertProgram(supabase, programId, auth))) redirect('/admin/programs')

  const { data: source } = await supabase
    .from('program_weeks')
    .select('id,title,week_order,notes')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!source) redirect(builderPath(programId, null, undefined, 'Semaine introuvable'))

  const src = source as { id: string; title: string | null; week_order: number; notes: string | null }

  const { data: after } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .gt('week_order', src.week_order)
    .order('week_order', { ascending: false })

  for (const row of (after ?? []) as { id: string; week_order: number }[]) {
    await supabase
      .from('program_weeks')
      .update({ week_order: row.week_order + 1 } as never)
      .eq('id', row.id)
  }

  const baseTitle = src.title?.trim() || `Semaine ${src.week_order + 1}`
  const { data: created, error } = await supabase
    .from('program_weeks')
    .insert({
      program_id: programId,
      week_order: src.week_order + 1,
      title: `${baseTitle} (copie)`,
      notes: src.notes,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(builderPath(programId, weekId, undefined, error?.message ?? 'Duplication impossible'))
  }

  const newId = (created as { id: string }).id

  const copied = await duplicateProgramWeekContents(supabase, weekId, newId)
  if (!copied.ok) {
    await supabase.from('program_weeks').delete().eq('id', newId)
    redirect(builderPath(programId, weekId, undefined, copied.error))
  }

  const { count } = await supabase
    .from('program_weeks')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(count ?? 0),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, newId, 'week_duplicated'))
}

/** Duplicate semaine sans redirect — overlay client + soft flash. */
export async function duplicateTrainlyProgramWeekQuietAction(
  formData: FormData,
): Promise<WeekQuietResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  if (!programId || !weekId) return { ok: false, error: 'Paramètres manquants' }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable' }
  }

  const { data: source } = await supabase
    .from('program_weeks')
    .select('id,title,week_order,notes')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!source) return { ok: false, error: 'Semaine introuvable' }

  const src = source as { id: string; title: string | null; week_order: number; notes: string | null }

  const { data: after } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .gt('week_order', src.week_order)
    .order('week_order', { ascending: false })

  await Promise.all(
    ((after ?? []) as { id: string; week_order: number }[]).map((row) =>
      supabase
        .from('program_weeks')
        .update({ week_order: row.week_order + 1 } as never)
        .eq('id', row.id),
    ),
  )

  const baseTitle = src.title?.trim() || `Semaine ${src.week_order + 1}`
  const { data: created, error } = await supabase
    .from('program_weeks')
    .insert({
      program_id: programId,
      week_order: src.week_order + 1,
      title: `${baseTitle} (copie)`,
      notes: src.notes,
    } as never)
    .select('id,title,week_order')
    .maybeSingle()

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Duplication impossible' }
  }

  const newRow = created as { id: string; title: string | null; week_order: number }
  const copied = await duplicateProgramWeekContents(supabase, weekId, newRow.id)
  if (!copied.ok) {
    await supabase.from('program_weeks').delete().eq('id', newRow.id)
    return { ok: false, error: copied.error }
  }

  const { data: weeksRaw, count } = await supabase
    .from('program_weeks')
    .select('id,title,week_order', { count: 'exact' })
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(count ?? 0),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  // Snapshots en parallèle — tout le contenu d’un coup (overlay jusqu’à la fin).
  const { data: sessRows } = await supabase
    .from('sessions')
    .select(
      'id,week_id,title,session_order,notes,objective_ressenti,objective_note,objective_difficulty,composition_version',
    )
    .eq('week_id', newRow.id)
    .order('session_order', { ascending: true })

  const sessList = (sessRows ?? []) as {
    id: string
    week_id: string
    title: string | null
    session_order: number
    notes: string | null
    objective_ressenti: boolean
    objective_note: boolean
    objective_difficulty: boolean
    composition_version: number | null
  }[]

  const { loadProgramSessionBoardSnapshot } = await import(
    '@/src/app/admin/programs/programSessionActions'
  )
  const weekSessions: NonNullable<WeekBoardPatch['weekSessions']> = await Promise.all(
    sessList.map(async (s) => {
      const snap = await loadProgramSessionBoardSnapshot(supabase, s.id)
      return {
        id: s.id,
        week_id: s.week_id,
        title: s.title,
        session_order: s.session_order,
        notes: s.notes,
        objective_ressenti: s.objective_ressenti !== false,
        objective_note: s.objective_note !== false,
        objective_difficulty: s.objective_difficulty !== false,
        composition_version: s.composition_version ?? 0,
        item_count: snap.item_count,
        items: snap.items,
        compositionSlots: snap.compositionSlots,
      }
    }),
  )

  // Ordres DB de la semaine source — le client ne doit pas retomber sur un SSR stale.
  const { data: sourceOrderRows } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
  const sessionOrders = [
    ...((sourceOrderRows ?? []) as { id: string; session_order: number }[]),
    ...weekSessions.map((s) => ({ id: s.id, session_order: s.session_order })),
  ]

  // Pas de revalidatePath ni router.refresh : weeksLive + weekSessions = vérité.
  // revalidatePath déclenchait un catch-up RSC au 1er switch semaine (= « refresh »).
  return {
    ok: true,
    flash: 'Semaine dupliquée',
    refresh: false,
    board: {
      weeks: (weeksRaw ?? []) as { id: string; title: string | null; week_order: number }[],
      openWeekId: newRow.id,
      weekSessions,
      sessionOrders,
    },
  }
}

export async function deleteTrainlyProgramWeekAction(formData: FormData) {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  if (!programId || !weekId) redirect('/admin/programs')
  if (!(await assertProgram(supabase, programId, auth))) redirect('/admin/programs')

  const { count } = await supabase
    .from('program_weeks')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)

  if ((count ?? 0) <= 1) {
    redirect(builderPath(programId, weekId, undefined, 'Au moins 1 semaine requise'))
  }

  const { data: victim } = await supabase
    .from('program_weeks')
    .select('week_order')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!victim) redirect(builderPath(programId, null, undefined, 'Semaine introuvable'))

  const order = (victim as { week_order: number }).week_order
  const { error } = await supabase.from('program_weeks').delete().eq('id', weekId).eq('program_id', programId)
  if (error) {
    redirect(builderPath(programId, weekId, undefined, error.message))
  }

  const { data: rest } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .gt('week_order', order)
    .order('week_order', { ascending: true })

  for (const row of (rest ?? []) as { id: string; week_order: number }[]) {
    await supabase
      .from('program_weeks')
      .update({ week_order: row.week_order - 1 } as never)
      .eq('id', row.id)
  }

  const { data: fallback } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { count: left } = await supabase
    .from('program_weeks')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(left ?? 0),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, (fallback as { id?: string } | null)?.id ?? null, 'week_deleted'))
}

/** Supprime une semaine sans redirect — pas d’auto-refresh page. */
export async function deleteTrainlyProgramWeekQuietAction(
  formData: FormData,
): Promise<WeekQuietResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  if (!programId || !weekId) return { ok: false, error: 'Paramètres manquants' }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable' }
  }

  const { count } = await supabase
    .from('program_weeks')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)

  if ((count ?? 0) <= 1) {
    return { ok: false, error: 'Au moins 1 semaine requise' }
  }

  const { data: victim } = await supabase
    .from('program_weeks')
    .select('week_order')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!victim) return { ok: false, error: 'Semaine introuvable' }

  const order = (victim as { week_order: number }).week_order

  // Voisin précédent (sinon suivant) — pas toujours S1.
  const { data: neighborRaw } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .neq('id', weekId)
    .order('week_order', { ascending: true })
  const neighbors = (neighborRaw ?? []) as { id: string; week_order: number }[]
  const prev =
    [...neighbors].reverse().find((w) => w.week_order < order) ??
    neighbors.find((w) => w.week_order > order) ??
    null

  const { error } = await supabase.from('program_weeks').delete().eq('id', weekId).eq('program_id', programId)
  if (error) return { ok: false, error: error.message }

  const { data: rest } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .gt('week_order', order)
    .order('week_order', { ascending: true })

  await Promise.all(
    ((rest ?? []) as { id: string; week_order: number }[]).map((row) =>
      supabase
        .from('program_weeks')
        .update({ week_order: row.week_order - 1 } as never)
        .eq('id', row.id),
    ),
  )

  const { data: weeksRaw, count: left } = await supabase
    .from('program_weeks')
    .select('id,title,week_order', { count: 'exact' })
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  const weeks = (weeksRaw ?? []) as { id: string; title: string | null; week_order: number }[]
  const openWeekId =
    (prev && weeks.some((w) => w.id === prev.id) ? prev.id : null) ??
    weeks[0]?.id ??
    null

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(left ?? 0),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  // Pas de revalidatePath / refresh : weeksLive porte la liste post-delete.
  return {
    ok: true,
    flash: 'Semaine supprimée',
    refresh: false,
    board: {
      weeks,
      openWeekId,
    },
  }
}

/** Aligne le nombre de semaines (ajoute en fin / retire depuis la fin) — patch client. */
export async function syncTrainlyProgramWeekCountQuietAction(
  formData: FormData,
): Promise<WeekQuietResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const stayWeekId = String(formData.get('week_id') ?? '').trim() || null
  const target = Number.parseInt(String(formData.get('week_count') ?? ''), 10)
  if (!programId) return { ok: false, error: 'Programme manquant' }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable' }
  }
  if (!Number.isFinite(target) || target < 1 || target > 52) {
    return { ok: false, error: 'Durée : 1 à 52 semaines' }
  }

  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  const weeks = (weeksRaw ?? []) as { id: string; week_order: number }[]
  const current = weeks.length

  if (target > current) {
    const toAdd = Array.from({ length: target - current }, (_, i) => ({
      program_id: programId,
      week_order: current + i,
      title: `Semaine ${current + i + 1}`,
    }))
    const { error } = await supabase.from('program_weeks').insert(toAdd as never)
    if (error) return { ok: false, error: error.message }
  } else if (target < current) {
    const toRemove = weeks.slice(target)
    for (const w of toRemove) {
      const { error } = await supabase.from('program_weeks').delete().eq('id', w.id)
      if (error) return { ok: false, error: error.message }
    }
  }

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(target),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  const { data: nextWeeksRaw } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  const nextWeeks = (nextWeeksRaw ?? []) as {
    id: string
    title: string | null
    week_order: number
  }[]

  let openWeekId: string | null = null
  if (stayWeekId && nextWeeks.some((w) => w.id === stayWeekId)) {
    openWeekId = stayWeekId
  } else {
    openWeekId = nextWeeks[0]?.id ?? null
  }

  return {
    ok: true,
    flash: 'Durée / semaines synchronisées',
    refresh: false,
    board: {
      weeks: nextWeeks,
      openWeekId,
    },
  }
}

/** Aligne le nombre de semaines sur la durée (ajoute en fin / retire depuis la fin). */
export async function syncTrainlyProgramWeekCountAction(formData: FormData) {
  const quiet = await syncTrainlyProgramWeekCountQuietAction(formData)
  const programId = String(formData.get('program_id') ?? '').trim()
  const stayWeekId = String(formData.get('week_id') ?? '').trim() || null
  if (!quiet.ok) {
    if (!programId) redirect('/admin/programs')
    redirect(builderPath(programId, stayWeekId, undefined, quiet.error))
  }
  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, quiet.board.openWeekId, 'weeks_synced'))
}

/**
 * Réordonne les semaines (DnD pills) — quiet, `week_order` 0-based contigu.
 * Ne touche pas aux séances (FK week_id). Pas de flash / redirect.
 */
export async function reorderTrainlyProgramWeeksQuietAction(
  formData: FormData,
): Promise<WeekQuietResult> {
  const auth = await requireBuilder()
  const { supabase } = auth
  const programId = String(formData.get('program_id') ?? '').trim()
  const stayWeekId = String(formData.get('week_id') ?? '').trim() || null
  const raw = String(formData.get('ordered_week_ids') ?? '').trim()
  if (!programId || !raw) return { ok: false, error: 'Paramètres manquants' }
  if (!(await assertProgram(supabase, programId, auth))) {
    return { ok: false, error: 'Programme introuvable' }
  }

  let orderedIds: string[]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string' && id.trim())) {
      return { ok: false, error: 'Ordre invalide' }
    }
    orderedIds = parsed.map((id) => String(id).trim())
  } catch {
    return { ok: false, error: 'Ordre invalide' }
  }

  const { data: existingRaw, error: existingErr } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('program_id', programId)
  if (existingErr) return { ok: false, error: existingErr.message }

  const existingIds = new Set(
    ((existingRaw ?? []) as { id: string }[]).map((r) => r.id),
  )
  if (
    orderedIds.length !== existingIds.size ||
    orderedIds.some((id) => !existingIds.has(id)) ||
    new Set(orderedIds).size !== orderedIds.length
  ) {
    return { ok: false, error: 'Ordre semaines incohérent' }
  }

  try {
    await reorderScopedRowsTwoPass(supabase, {
      table: 'program_weeks',
      scopeColumn: 'program_id',
      scopeId: programId,
      orderColumn: 'week_order',
      orderedIds,
      finalOrderBase: 0,
    })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Réordonnancement impossible',
    }
  }

  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  const weeks = (weeksRaw ?? []) as { id: string; title: string | null; week_order: number }[]
  const openWeekId =
    stayWeekId && weeks.some((w) => w.id === stayWeekId)
      ? stayWeekId
      : (weeks[0]?.id ?? null)

  return {
    ok: true,
    refresh: false,
    board: { weeks, openWeekId },
  }
}
