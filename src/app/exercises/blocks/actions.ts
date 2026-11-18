'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../../lib/auth/roles'
import {
  parseExerciseSlots,
  type ExercisePrescription,
} from '../../../lib/blocks/constants'
import { safeReturnTo } from '../../../lib/navigation/safeReturnTo'
import { createClient } from '../../../lib/supabase/server'
import { ensureCoachTagCopies, remapId } from '../../../lib/tags/seedCoachTags'

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  return { supabase, userId: user.id }
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function revalidateBlocks(id?: string) {
  revalidatePath('/exercises/blocks')
  revalidatePath('/exercises/blocks/catalogue')
  revalidatePath('/exercises/blocks/mine')
  revalidatePath('/exercises/blocks/brouillon')
  revalidatePath('/exercises/blocks/new')
  if (id) {
    revalidatePath(`/exercises/blocks/mine/${id}`)
    revalidatePath(`/exercises/blocks/brouillon/${id}`)
  }
}

function parseHiddenTypeIds(formData: FormData): string[] {
  return formData
    .getAll('hidden_type_ids')
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
}

type SaveIntent = 'publish' | 'draft'

function readBlockFields(formData: FormData) {
  const slots = parseExerciseSlots(formData)
  return {
    name: String(formData.get('name') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim(),
    timerNote: String(formData.get('timer_note') ?? '').trim(),
    sportId: String(formData.get('sport_id') ?? '').trim(),
    expectedResultUnitId: String(formData.get('expected_result_unit_id') ?? '').trim(),
    exerciseIds: slots.exerciseIds,
    prescriptions: slots.prescriptions,
    hiddenTypeIds: parseHiddenTypeIds(formData),
  }
}

function validateForIntent(intent: SaveIntent, f: ReturnType<typeof readBlockFields>, basePath: string) {
  if (!f.name) redirect(`${basePath}?error=${encodeURIComponent('Nom requis')}`)
  if (!f.sportId) redirect(`${basePath}?error=${encodeURIComponent('Sport requis')}`)
  if (intent === 'publish') {
    if (!f.exerciseIds.length) {
      redirect(`${basePath}?error=${encodeURIComponent('Au moins 1 exercice requis pour publier')}`)
    }
    if (!f.expectedResultUnitId) {
      redirect(
        `${basePath}?error=${encodeURIComponent('Résultat attendu (unité) requis pour publier')}`,
      )
    }
  }
}

async function syncBlockExercises(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blockId: string,
  exerciseIds: string[],
  prescriptions: ExercisePrescription[][],
) {
  if (exerciseIds.length) {
    const { data: targets, error: targetErr } = await supabase
      .from('exercise_library')
      .select('id, status, deleted_at')
      .in('id', exerciseIds)
    if (targetErr) return targetErr.message
    const ok = new Set(
      ((targets ?? []) as { id: string; status?: string | null; deleted_at?: string | null }[])
        .filter((t) => !t.deleted_at && (!t.status || t.status === 'published'))
        .map((t) => t.id),
    )
    if (exerciseIds.some((id) => !ok.has(id))) {
      return 'Chaque exercice du bloc doit être publié (pas de brouillon)'
    }
  }

  const db = supabase as unknown as {
    from: (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>
    }
  }
  const { error: delErr } = await db.from('block_library_exercises').delete().eq('block_id', blockId)
  if (delErr) return delErr.message
  if (!exerciseIds.length) return null
  const rows = exerciseIds.map((exercise_id, position) => ({
    block_id: blockId,
    exercise_id,
    position,
    prescriptions: prescriptions[position] ?? [],
  }))
  const { error: insErr } = await db.from('block_library_exercises').insert(rows)
  return insErr?.message ?? null
}

async function syncHiddenTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blockId: string,
  hiddenTypeIds: string[],
) {
  const db = supabase as unknown as {
    from: (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>
    }
  }
  const { error: delErr } = await db.from('block_library_hidden_types').delete().eq('block_id', blockId)
  if (delErr) return delErr.message
  const unique = [...new Set(hiddenTypeIds)]
  if (!unique.length) return null
  const rows = unique.map((exercise_type_id) => ({ block_id: blockId, exercise_type_id }))
  const { error: insErr } = await db.from('block_library_hidden_types').insert(rows)
  return insErr?.message ?? null
}

export async function createCoachBlockPublishedAction(formData: FormData) {
  return createCoachBlockCore('publish', formData)
}

export async function createCoachBlockDraftAction(formData: FormData) {
  return createCoachBlockCore('draft', formData)
}

async function createCoachBlockCore(intent: SaveIntent, formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const f = readBlockFields(formData)
  validateForIntent(intent, f, '/exercises/blocks/new')

  const status = intent === 'publish' ? 'published' : 'draft'
  const { data: created, error } = await supabase
    .from('block_library' as never)
    .insert({
      coach_id: userId,
      name: f.name,
      notes: f.notes || null,
      timer_note: f.timerNote || null,
      sport_id: f.sportId,
      format_id: null,
      expected_result_unit_id: f.expectedResultUnitId || null,
      free_constraints: [],
      status,
      allow_duplicate: false,
      allow_download: false,
      source_kind: 'own',
      source_block_id: null,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(
      `/exercises/blocks/new?error=${encodeURIComponent(error?.message ?? 'Création impossible')}`,
    )
  }

  const id = (created as { id: string }).id
  const exoErr = await syncBlockExercises(supabase, id, f.exerciseIds, f.prescriptions)
  if (exoErr) redirect(`/exercises/blocks/brouillon/${id}?error=${encodeURIComponent(exoErr)}`)
  const hideErr = await syncHiddenTypes(supabase, id, f.hiddenTypeIds)
  if (hideErr) redirect(`/exercises/blocks/brouillon/${id}?error=${encodeURIComponent(hideErr)}`)

  revalidateBlocks(id)
  redirect(intent === 'publish' ? '/exercises/blocks/mine' : '/exercises/blocks/brouillon')
}

export async function saveAndPublishCoachBlockAction(formData: FormData) {
  formData.set('publish', '1')
  formData.delete('keep_draft')
  return saveCoachBlockAction(formData)
}

export async function saveKeepDraftCoachBlockAction(formData: FormData) {
  formData.set('keep_draft', '1')
  formData.delete('publish')
  return saveCoachBlockAction(formData)
}

export async function saveCoachBlockAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  const publish = str(formData, 'publish') === '1'
  const keepDraft = str(formData, 'keep_draft') === '1'
  if (!id) redirect('/exercises/blocks/mine')

  const f = readBlockFields(formData)
  const intent: SaveIntent = publish ? 'publish' : 'draft'
  const base = keepDraft || !publish ? `/exercises/blocks/brouillon/${id}` : `/exercises/blocks/mine/${id}`
  validateForIntent(intent === 'publish' ? 'publish' : 'draft', f, base)

  const patch: Record<string, unknown> = {
    name: f.name,
    notes: f.notes || null,
    timer_note: f.timerNote || null,
    sport_id: f.sportId,
    expected_result_unit_id: f.expectedResultUnitId || null,
    updated_at: new Date().toISOString(),
  }
  if (publish) patch.status = 'published'
  if (keepDraft) patch.status = 'draft'

  const { error } = await supabase
    .from('block_library' as never)
    .update(patch as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)

  if (error) redirect(`${base}?error=${encodeURIComponent(error.message)}`)

  const exoErr = await syncBlockExercises(supabase, id, f.exerciseIds, f.prescriptions)
  if (exoErr) redirect(`${base}?error=${encodeURIComponent(exoErr)}`)
  const hideErr = await syncHiddenTypes(supabase, id, f.hiddenTypeIds)
  if (hideErr) redirect(`${base}?error=${encodeURIComponent(hideErr)}`)

  revalidateBlocks(id)
  const returnTo = safeReturnTo(str(formData, 'returnTo'), '')
  if (returnTo) redirect(returnTo)
  if (publish) redirect('/exercises/blocks/mine')
  if (keepDraft) redirect('/exercises/blocks/brouillon')
  redirect(`/exercises/blocks/mine/${id}`)
}

export async function moveCoachBlockToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises/blocks/mine')

  const { error } = await supabase
    .from('block_library' as never)
    .update({ status: 'draft', updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)

  if (error) redirect('/exercises/blocks/mine?error=' + encodeURIComponent(error.message))
  revalidateBlocks(id)
  redirect(`/exercises/blocks/brouillon/${id}`)
}

export async function publishCoachBlockAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises/blocks/brouillon')

  const { data: block } = await supabase
    .from('block_library' as never)
    .select('expected_result_unit_id')
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .maybeSingle()

  const { data: exos } = await supabase
    .from('block_library_exercises' as never)
    .select('id')
    .eq('block_id' as never, id as never)

  if (!(block as { expected_result_unit_id?: string | null } | null)?.expected_result_unit_id) {
    redirect(
      `/exercises/blocks/brouillon/${id}?error=` +
        encodeURIComponent('Résultat attendu requis pour publier — ouvre la fiche'),
    )
  }
  if (!(exos ?? []).length) {
    redirect(
      `/exercises/blocks/brouillon/${id}?error=` +
        encodeURIComponent('Ajoute au moins 1 exercice avant de publier'),
    )
  }

  const { error } = await supabase
    .from('block_library' as never)
    .update({ status: 'published', updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)

  if (error) redirect('/exercises/blocks/brouillon?error=' + encodeURIComponent(error.message))
  revalidateBlocks(id)
  redirect('/exercises/blocks/mine')
}

export async function softDeleteCoachBlockAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  const from = str(formData, 'from') || 'mine'
  const dest = from === 'brouillon' ? '/exercises/blocks/brouillon' : '/exercises/blocks/mine'
  if (!id) redirect(dest)

  const { loadBlockTemplateUsages } = await import('@/src/lib/blocks/templateUsage')
  const usages = await loadBlockTemplateUsages(supabase, userId, [id])
  const templates = usages.get(id)?.templates ?? []
  if (templates.length) {
    const n = templates.length
    redirect(
      `${dest}?error=` +
        encodeURIComponent(
          `Impossible d’archiver : utilisé dans ${n} séance${n > 1 ? 's' : ''} modèle. Ouvre le compteur Utilisé pour retirer ou remplacer.`,
        ),
    )
  }

  await supabase
    .from('block_library' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)

  revalidateBlocks()
  redirect(`${dest}?deleted=1`)
}

/** Fork Krid → brouillon (copie détachée + slots). */
export async function forkKridBlockToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises/blocks/catalogue')

  const { data: src, error: srcErr } = await supabase
    .from('block_library' as never)
    .select(
      'name, notes, timer_note, sport_id, expected_result_unit_id, status, allow_duplicate',
    )
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)
    .is('deleted_at' as never, null)
    .maybeSingle()

  if (srcErr || !src) {
    redirect(
      '/exercises/blocks/catalogue?error=' +
        encodeURIComponent(srcErr?.message || 'Bloc introuvable'),
    )
  }

  const srcRow = src as {
    name: string
    notes: string | null
    timer_note: string | null
    sport_id: string | null
    expected_result_unit_id: string | null
    status?: string | null
    allow_duplicate?: boolean | null
  }

  if (srcRow.status && srcRow.status !== 'published') {
    redirect('/exercises/blocks/catalogue?error=' + encodeURIComponent('Bloc non publié'))
  }
  if (srcRow.allow_duplicate === false) {
    redirect('/exercises/blocks/catalogue?error=' + encodeURIComponent('Duplication non autorisée'))
  }

  const maps = await ensureCoachTagCopies(supabase, userId)

  const { data: created, error } = await supabase
    .from('block_library' as never)
    .insert({
      coach_id: userId,
      name: srcRow.name,
      notes: srcRow.notes,
      timer_note: srcRow.timer_note,
      sport_id: remapId(maps.sports, srcRow.sport_id),
      format_id: null,
      expected_result_unit_id: remapId(maps.units, srcRow.expected_result_unit_id),
      free_constraints: [],
      status: 'draft',
      allow_duplicate: false,
      allow_download: false,
      source_kind: 'krid',
      source_block_id: id,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(
      '/exercises/blocks/catalogue?error=' +
        encodeURIComponent(error?.message || 'Copie impossible'),
    )
  }

  const newId = (created as { id: string }).id

  const { data: slots } = await supabase
    .from('block_library_exercises' as never)
    .select('exercise_id, position, prescriptions')
    .eq('block_id' as never, id as never)
    .order('position' as never, { ascending: true })

  const exerciseIds = ((slots ?? []) as { exercise_id: string; prescriptions?: unknown }[]).map(
    (s) => s.exercise_id,
  )
  const prescriptions = ((slots ?? []) as { prescriptions?: ExercisePrescription[] }[]).map((s) =>
    (Array.isArray(s.prescriptions) ? s.prescriptions : []).map((p) => ({
      ...p,
      unit_id: remapId(maps.units, p.unit_id) ?? p.unit_id,
    })),
  )
  const exoErr = await syncBlockExercises(supabase, newId, exerciseIds, prescriptions)
  if (exoErr) {
    redirect(`/exercises/blocks/brouillon/${newId}?error=${encodeURIComponent(exoErr)}`)
  }

  const { data: hidden } = await supabase
    .from('block_library_hidden_types' as never)
    .select('exercise_type_id')
    .eq('block_id' as never, id as never)
  const hiddenIds = ((hidden ?? []) as { exercise_type_id: string }[])
    .map((h) => remapId(maps.types, h.exercise_type_id))
    .filter((x): x is string => Boolean(x))
  await syncHiddenTypes(supabase, newId, hiddenIds)

  revalidateBlocks(newId)
  redirect(`/exercises/blocks/brouillon/${newId}?forked=1`)
}
