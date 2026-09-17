'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
import { shiftWeekSessionOrdersForInsert } from '@/src/lib/persistence/sessionOrderPersistence'
import {
  decodeDaySessionOrder,
  encodeDaySessionOrder,
  renumberDayOrders,
} from '@/src/lib/programs/builderDayOrder'
import { formatBlockTimerSummary, loadSessionBlockDetail } from '@/src/lib/sessions/blockDetail'
import { ingestSessionLibraryComposition } from '@/src/lib/sessions/ingestSessionLibrary'
import { createClient } from '@/src/lib/supabase/server'

const MAX_SLOTS = 6

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin((profile as { role?: string | null } | null)?.role)) redirect('/home')
  return { supabase, userId: user.id }
}

async function assertTrainlyProgram(
  supabase: Awaited<ReturnType<typeof createClient>>,
  programId: string,
) {
  const { data } = await supabase
    .from('programs')
    .select('id,is_calendar')
    .eq('id', programId)
    .eq('is_trainly_catalog', true)
    .is('deleted_at', null)
    .maybeSingle()
  return data as { id: string; is_calendar: boolean } | null
}

function builderPath(programId: string, weekId?: string | null, ok?: string, error?: string) {
  const q = new URLSearchParams()
  if (weekId) q.set('week', weekId)
  if (ok) q.set('ok', ok)
  if (error) q.set('error', error)
  const qs = q.toString()
  return `/admin/programs/${programId}${qs ? `?${qs}` : ''}`
}

async function nextOrderForTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weekId: string,
  isCalendar: boolean,
  targetOrder: number,
) {
  const { data: existingRaw } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const existing = (existingRaw ?? []) as { id: string; session_order: number }[]

  if (isCalendar) {
    const day = Number.isFinite(targetOrder) ? Math.min(Math.max(targetOrder, 0), 6) : 0
    const onDay = existing.filter((s) => decodeDaySessionOrder(s.session_order).day === day)
    return encodeDaySessionOrder(day, onDay.length)
  }

  if (existing.length >= MAX_SLOTS) {
    throw new Error('Max 6 séances / semaine en mode slots')
  }
  const slot = Number.isFinite(targetOrder)
    ? Math.min(Math.max(targetOrder, 0), MAX_SLOTS - 1)
    : existing.length
  const insertOrder = Math.min(slot, existing.length)
  await shiftWeekSessionOrdersForInsert(supabase, weekId, insertOrder)
  return insertOrder
}

async function nextTimelinePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  const { data } = await supabase
    .from('session_items')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const max = (data as { position?: number } | null)?.position
  return (typeof max === 'number' && Number.isFinite(max) ? max : -1) + 1
}

async function nextBlockTablePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  const { data } = await supabase
    .from('session_blocks')
    .select('position')
    .eq('program_session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const max = (data as { position?: number } | null)?.position
  return (typeof max === 'number' && Number.isFinite(max) ? max : -1) + 1
}

/**
 * Bloc / exo → toujours une séance :
 * - session_id explicite (drop sur une carte) → on l’utilise
 * - sinon (drop hors séance / + catalogue) → crée une séance « Séance » avec l’item
 */
async function resolveSessionForItemDrop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weekId: string,
  isCalendar: boolean,
  targetOrder: number,
  explicitSessionId: string,
): Promise<string> {
  if (explicitSessionId) return explicitSessionId

  const insertOrder = await nextOrderForTarget(supabase, weekId, isCalendar, targetOrder)
  const { data: created, error } = await supabase
    .from('sessions')
    .insert({
      week_id: weekId,
      title: 'Séance',
      description: null,
      notes: null,
      objective_ressenti: true,
      objective_note: true,
      objective_difficulty: true,
      session_order: insertOrder,
    } as never)
    .select('id')
    .maybeSingle()
  if (error || !created) {
    throw new Error(error?.message ?? 'Création séance impossible')
  }
  return (created as { id: string }).id
}

function formatKeyToBlockType(formatKey: string | null | undefined): string {
  const k = String(formatKey ?? '').trim().toLowerCase()
  if (k.includes('warm')) return 'warmup'
  if (k.includes('cross') || k.includes('amrap') || k.includes('emom') || k.includes('for_time')) {
    return 'crosstraining'
  }
  if (k.includes('super') || k.includes('strength')) return 'strength'
  return 'free_text'
}

/** Séance catalogue publiée → jour/slot + ingest composition. */
export async function addTrainlyLibrarySessionAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const libraryId = String(formData.get('library_session_id') ?? '').trim()
  const targetRaw = String(formData.get('target_order') ?? '').trim()
  const targetOrder = Number.parseInt(targetRaw, 10)
  const intoSessionId = String(formData.get('into_session_id') ?? '').trim()

  if (!programId || !weekId || !libraryId) redirect('/admin/programs')
  const program = await assertTrainlyProgram(supabase, programId)
  if (!program) redirect('/admin/programs')

  const { data: week } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()
  if (!week) redirect(builderPath(programId, null, undefined, 'Semaine introuvable'))

  const { data: lib } = await supabase
    .from('session_library' as never)
    .select('id,name,notes,status,objective_ressenti,objective_note,objective_difficulty')
    .eq('id', libraryId)
    .is('coach_id', null)
    .is('deleted_at', null)
    .maybeSingle()

  const library = lib as {
    id: string
    name: string | null
    notes: string | null
    status: string
    objective_ressenti?: boolean
    objective_note?: boolean
    objective_difficulty?: boolean
  } | null
  if (!library || library.status !== 'published') {
    redirect(builderPath(programId, weekId, undefined, 'Séance catalogue introuvable ou non publiée'))
  }

  // Si cible = séance existante : on crée une nouvelle séance sur le même jour (multi-séances), pas merge.
  let insertOrder = 0
  try {
    if (intoSessionId) {
      const { data: host } = await supabase
        .from('sessions')
        .select('session_order')
        .eq('id', intoSessionId)
        .eq('week_id', weekId)
        .maybeSingle()
      if (!host) redirect(builderPath(programId, weekId, undefined, 'Séance cible introuvable'))
      const day = program.is_calendar
        ? decodeDaySessionOrder((host as { session_order: number }).session_order).day
        : (host as { session_order: number }).session_order
      insertOrder = await nextOrderForTarget(supabase, weekId, program.is_calendar, day)
    } else {
      insertOrder = await nextOrderForTarget(supabase, weekId, program.is_calendar, targetOrder)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Placement impossible'
    redirect(builderPath(programId, weekId, undefined, msg))
  }

  const { data: created, error } = await supabase
    .from('sessions')
    .insert({
      week_id: weekId,
      title: library.name?.trim() || 'Séance',
      description: library.notes?.trim() || null,
      notes: library.notes?.trim() || null,
      objective_ressenti: library.objective_ressenti !== false,
      objective_note: library.objective_note !== false,
      objective_difficulty: library.objective_difficulty !== false,
      session_order: insertOrder,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(builderPath(programId, weekId, undefined, error?.message ?? 'Insert séance impossible'))
  }

  const programSessionId = (created as { id: string }).id
  const ingest = await ingestSessionLibraryComposition(supabase, {
    librarySessionId: libraryId,
    programSessionId,
  })
  if (!ingest.ok) {
    await supabase.from('sessions').delete().eq('id', programSessionId)
    redirect(builderPath(programId, weekId, undefined, ingest.error))
  }

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'session_added'))
}

/** Crée une séance vide sur un jour/slot. */
export async function createEmptyProgramSessionAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Séance'
  const notes = String(formData.get('notes') ?? '').trim() || null
  const objectiveRessenti = formData.get('objective_ressenti') === 'on'
  const objectiveNote = formData.get('objective_note') === 'on'
  const objectiveDifficulty = formData.get('objective_difficulty') === 'on'
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)

  if (!programId || !weekId) redirect('/admin/programs')
  const program = await assertTrainlyProgram(supabase, programId)
  if (!program) redirect('/admin/programs')

  const { data: week } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()
  if (!week) redirect(builderPath(programId, null, undefined, 'Semaine introuvable'))

  let insertOrder = 0
  try {
    insertOrder = await nextOrderForTarget(supabase, weekId, program.is_calendar, targetOrder)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Placement impossible'
    redirect(builderPath(programId, weekId, undefined, msg))
  }

  const { error } = await supabase.from('sessions').insert({
    week_id: weekId,
    title,
    description: notes,
    notes,
    objective_ressenti: objectiveRessenti,
    objective_note: objectiveNote,
    objective_difficulty: objectiveDifficulty,
    session_order: insertOrder,
  } as never)

  if (error) redirect(builderPath(programId, weekId, undefined, error.message))

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'session_created'))
}

/** Métadonnées fiche (nom / notes / feedback) — hors composition. */
export async function updateTrainlyProgramSessionMetaAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Séance'
  const notes = String(formData.get('notes') ?? '').trim() || null
  const objectiveRessenti = formData.get('objective_ressenti') === 'on'
  const objectiveNote = formData.get('objective_note') === 'on'
  const objectiveDifficulty = formData.get('objective_difficulty') === 'on'

  if (!programId || !weekId || !sessionId) redirect('/admin/programs')
  if (!(await assertTrainlyProgram(supabase, programId))) redirect('/admin/programs')

  const { error } = await supabase
    .from('sessions')
    .update({
      title,
      notes,
      description: notes,
      objective_ressenti: objectiveRessenti,
      objective_note: objectiveNote,
      objective_difficulty: objectiveDifficulty,
    } as never)
    .eq('id', sessionId)
    .eq('week_id', weekId)

  if (error) redirect(builderPath(programId, weekId, undefined, error.message))
  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'session_updated'))
}

export async function renameTrainlyProgramSessionAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!programId || !weekId || !sessionId) redirect('/admin/programs')
  if (!(await assertTrainlyProgram(supabase, programId))) redirect('/admin/programs')

  const { error } = await supabase
    .from('sessions')
    .update({ title: title || 'Séance' } as never)
    .eq('id', sessionId)
    .eq('week_id', weekId)

  if (error) redirect(builderPath(programId, weekId, undefined, error.message))
  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'session_renamed'))
}

/** Déplace une séance vers un jour/slot (réécrit les ordres du jour source + cible). */
export async function moveTrainlyProgramSessionAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)

  if (!programId || !weekId || !sessionId) redirect('/admin/programs')
  const program = await assertTrainlyProgram(supabase, programId)
  if (!program) redirect('/admin/programs')

  const { data: allRaw } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const all = (allRaw ?? []) as { id: string; session_order: number }[]
  const moving = all.find((s) => s.id === sessionId)
  if (!moving) redirect(builderPath(programId, weekId, undefined, 'Séance introuvable'))

  if (program.is_calendar) {
    const fromDay = decodeDaySessionOrder(moving.session_order).day
    const toDay = Number.isFinite(targetOrder) ? Math.min(Math.max(targetOrder, 0), 6) : fromDay
    const without = all.filter((s) => s.id !== sessionId)

    if (fromDay === toDay) {
      const onDay = without.filter((s) => decodeDaySessionOrder(s.session_order).day === fromDay)
      onDay.push({ id: sessionId, session_order: 0 })
      for (const u of renumberDayOrders(fromDay, onDay)) {
        await supabase.from('sessions').update({ session_order: u.session_order } as never).eq('id', u.id)
      }
    } else {
      const fromList = without.filter((s) => decodeDaySessionOrder(s.session_order).day === fromDay)
      const toList = without.filter((s) => decodeDaySessionOrder(s.session_order).day === toDay)
      toList.push({ id: sessionId, session_order: 0 })
      for (const u of [...renumberDayOrders(fromDay, fromList), ...renumberDayOrders(toDay, toList)]) {
        await supabase.from('sessions').update({ session_order: u.session_order } as never).eq('id', u.id)
      }
    }
  } else {
    const without = all.filter((s) => s.id !== sessionId)
    const insertAt = Number.isFinite(targetOrder)
      ? Math.min(Math.max(targetOrder, 0), without.length)
      : without.length
    without.splice(insertAt, 0, moving)
    for (let i = 0; i < without.length; i += 1) {
      await supabase.from('sessions').update({ session_order: i } as never).eq('id', without[i]!.id)
    }
  }

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'session_moved'))
}

export async function deleteTrainlyProgramSessionAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  if (!programId || !weekId || !sessionId) redirect('/admin/programs')
  const program = await assertTrainlyProgram(supabase, programId)
  if (!program) redirect('/admin/programs')

  const { data: victim } = await supabase
    .from('sessions')
    .select('session_order')
    .eq('id', sessionId)
    .eq('week_id', weekId)
    .maybeSingle()
  if (!victim) redirect(builderPath(programId, weekId, undefined, 'Séance introuvable'))

  const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('week_id', weekId)
  if (error) redirect(builderPath(programId, weekId, undefined, error.message))

  const { data: rest } = await supabase
    .from('sessions')
    .select('id,session_order')
    .eq('week_id', weekId)
    .order('session_order', { ascending: true })

  const rows = (rest ?? []) as { id: string; session_order: number }[]
  if (program.is_calendar) {
    const day = decodeDaySessionOrder((victim as { session_order: number }).session_order).day
    const onDay = rows.filter((s) => decodeDaySessionOrder(s.session_order).day === day)
    for (const u of renumberDayOrders(day, onDay)) {
      await supabase.from('sessions').update({ session_order: u.session_order } as never).eq('id', u.id)
    }
  } else {
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i]!.session_order !== i) {
        await supabase.from('sessions').update({ session_order: i } as never).eq('id', rows[i]!.id)
      }
    }
  }

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'session_removed'))
}

/**
 * Ajoute un bloc catalogue dans une séance.
 * Sans session_id : crée une séance « Séance » et y place le bloc.
 */
export async function appendLibraryBlockToProgramAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const blockId = String(formData.get('block_id') ?? '').trim()
  const explicitSessionId = String(formData.get('session_id') ?? '').trim()
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)

  if (!programId || !weekId || !blockId) redirect('/admin/programs')
  const program = await assertTrainlyProgram(supabase, programId)
  if (!program) redirect('/admin/programs')

  const { detail, error: detailErr } = await loadSessionBlockDetail(supabase, blockId)
  if (detailErr || !detail || detail.status !== 'published') {
    redirect(builderPath(programId, weekId, undefined, detailErr ?? 'Bloc introuvable / non publié'))
  }

  let sessionId: string
  try {
    sessionId = await resolveSessionForItemDrop(
      supabase,
      weekId,
      program.is_calendar,
      targetOrder,
      explicitSessionId,
    )
  } catch (e) {
    redirect(builderPath(programId, weekId, undefined, e instanceof Error ? e.message : 'Erreur'))
  }

  const timelinePos = await nextTimelinePosition(supabase, sessionId)
  const blockPos = await nextBlockTablePosition(supabase, sessionId)

  let formatKey: string | null = null
  {
    const { data: bl } = await supabase
      .from('block_library' as never)
      .select('format_id')
      .eq('id' as never, blockId as never)
      .maybeSingle()
    const fid = (bl as { format_id?: string | null } | null)?.format_id
    if (fid) {
      const { data: fmt } = await supabase
        .from('block_formats' as never)
        .select('key')
        .eq('id' as never, fid as never)
        .maybeSingle()
      formatKey = (fmt as { key?: string } | null)?.key ?? null
    }
  }

  const timer = formatBlockTimerSummary(detail.timer_note)
  const notes = [detail.notes?.trim(), timer].filter(Boolean).join('\n') || null

  const { data: sb, error: bErr } = await supabase
    .from('session_blocks')
    .insert({
      program_session_id: sessionId,
      position: blockPos,
      type: formatKeyToBlockType(formatKey),
      title: detail.name,
      notes,
      objective: detail.expected_result_label,
      source_block_library_id: blockId,
    } as never)
    .select('id')
    .maybeSingle()
  if (bErr || !sb) {
    redirect(builderPath(programId, weekId, undefined, bErr?.message ?? 'Insert bloc impossible'))
  }
  const newBlockId = (sb as { id: string }).id

  for (let i = 0; i < detail.exercises.length; i += 1) {
    const ex = detail.exercises[i]!
    const { error: beErr } = await supabase.from('block_exercises').insert({
      session_block_id: newBlockId,
      exercise_id: ex.exercise_id,
      exercise_name: ex.name,
      position: i,
      notes: null,
    } as never)
    if (beErr) redirect(builderPath(programId, weekId, undefined, beErr.message))
  }

  const { error: siErr } = await supabase.from('session_items').insert({
    session_id: sessionId,
    position: timelinePos,
    kind: 'block',
    session_block_id: newBlockId,
    program_exercise_id: null,
    prescriptions: [],
  } as never)
  if (siErr) redirect(builderPath(programId, weekId, undefined, siErr.message))

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'block_added'))
}

/** Ajoute un exo catalogue dans une séance (ou crée « Séance » si drop hors séance). */
export async function appendLibraryExerciseToProgramAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const exerciseId = String(formData.get('exercise_id') ?? '').trim()
  const explicitSessionId = String(formData.get('session_id') ?? '').trim()
  const targetOrder = Number.parseInt(String(formData.get('target_order') ?? ''), 10)

  if (!programId || !weekId || !exerciseId) redirect('/admin/programs')
  const program = await assertTrainlyProgram(supabase, programId)
  if (!program) redirect('/admin/programs')

  const { data: exo } = await supabase
    .from('exercise_library')
    .select('id,name,status')
    .eq('id', exerciseId)
    .is('coach_id', null)
    .is('deleted_at', null)
    .maybeSingle()

  const exercise = exo as { id: string; name: string; status: string } | null
  if (!exercise || exercise.status !== 'published') {
    redirect(builderPath(programId, weekId, undefined, 'Exercice introuvable / non publié'))
  }

  let sessionId: string
  try {
    sessionId = await resolveSessionForItemDrop(
      supabase,
      weekId,
      program.is_calendar,
      targetOrder,
      explicitSessionId,
    )
  } catch (e) {
    redirect(builderPath(programId, weekId, undefined, e instanceof Error ? e.message : 'Erreur'))
  }

  const timelinePos = await nextTimelinePosition(supabase, sessionId)
  const { data: pe, error: peErr } = await supabase
    .from('program_exercises')
    .insert({
      session_id: sessionId,
      exercise_id: exercise.id,
      name: exercise.name,
      exercise_order: timelinePos,
    } as never)
    .select('id')
    .maybeSingle()
  if (peErr || !pe) {
    redirect(builderPath(programId, weekId, undefined, peErr?.message ?? 'Insert exo impossible'))
  }

  const { error: siErr } = await supabase.from('session_items').insert({
    session_id: sessionId,
    position: timelinePos,
    kind: 'exercise',
    program_exercise_id: (pe as { id: string }).id,
    session_block_id: null,
    prescriptions: [],
  } as never)
  if (siErr) redirect(builderPath(programId, weekId, undefined, siErr.message))

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'exercise_added'))
}

/** Remplace la composition d’une séance programme (même UI que /admin/sessions/new). */
export async function replaceProgramSessionCompositionAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()

  if (!programId || !weekId || !sessionId) redirect('/admin/programs')
  if (!(await assertTrainlyProgram(supabase, programId))) redirect('/admin/programs')

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('week_id', weekId)
    .maybeSingle()
  if (!session) redirect(builderPath(programId, weekId, undefined, 'Séance introuvable'))

  const { parseSessionCompositionFormData } = await import(
    '@/src/lib/sessions/parseSessionCompositionForm'
  )
  const { writeProgramSessionComposition } = await import(
    '@/src/lib/sessions/writeProgramSessionComposition'
  )

  const slots = parseSessionCompositionFormData(formData)
  const result = await writeProgramSessionComposition(supabase, sessionId, slots)
  if (!result.ok) {
    redirect(builderPath(programId, weekId, undefined, result.error))
  }

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'composition_saved'))
}
