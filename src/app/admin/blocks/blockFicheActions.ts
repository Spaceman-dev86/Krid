'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import {
  parseExerciseSlots,
  type ExercisePrescription,
} from '../../../lib/blocks/constants'
import { createClient } from '../../../lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/home')
  return { supabase }
}

function revalidateBlocks(id?: string) {
  revalidatePath('/admin/exercises')
  revalidatePath('/admin/blocks/new')
  if (id) {
    revalidatePath(`/admin/blocks/${id}/edit`)
  }
}

/** Interdit de repasser un bloc en draft s’il est encore dans une séance catalogue publiée. */
async function assertBlockNotLinkedToPublishedSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blockId: string,
): Promise<string | null> {
  const { data: items, error } = await supabase
    .from('session_library_items' as never)
    .select('session_id')
    .eq('block_id' as never, blockId as never)
    .eq('item_kind' as never, 'block' as never)
  if (error) return error.message
  const sessionIds = [
    ...new Set(
      ((items ?? []) as { session_id?: string }[])
        .map((r) => r.session_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (!sessionIds.length) return null
  const { data: sessions, error: sErr } = await supabase
    .from('session_library' as never)
    .select('id, name')
    .in('id' as never, sessionIds as never)
    .eq('status' as never, 'published' as never)
    .is('coach_id' as never, null)
    .is('deleted_at' as never, null)
  if (sErr) return sErr.message
  const linked = (sessions ?? []) as { id: string; name?: string | null }[]
  if (!linked.length) return null
  const names = linked
    .map((s) => s.name?.trim() || 'Séance')
    .slice(0, 3)
    .join(', ')
  const more = linked.length > 3 ? ` (+${linked.length - 3})` : ''
  return `Impossible de dépublier : bloc lié à une séance publiée (${names}${more})`
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
    allowDuplicate: formData.get('allow_duplicate') === 'on',
    exerciseIds: slots.exerciseIds,
    prescriptions: slots.prescriptions,
    hiddenTypeIds: parseHiddenTypeIds(formData),
  }
}

function validateForIntent(
  intent: SaveIntent,
  f: ReturnType<typeof readBlockFields>,
  basePath: string,
) {
  if (!f.name) redirect(`${basePath}?error=${encodeURIComponent('Nom requis')}`)
  if (!f.sportId) redirect(`${basePath}?error=${encodeURIComponent('Sport requis')}`)
  if (intent === 'publish') {
    if (!f.exerciseIds.length) {
      redirect(`${basePath}?error=${encodeURIComponent('Au moins 1 exercice requis pour publier')}`)
    }
    if (!f.expectedResultUnitId) {
      redirect(`${basePath}?error=${encodeURIComponent('Résultat attendu (unité) requis pour publier')}`)
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
      return 'Chaque exercice du bloc doit être publié (non corbeille)'
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

export async function createTrainlyBlockPublishedAction(formData: FormData) {
  return createTrainlyBlockCore('publish', formData)
}

export async function createTrainlyBlockDraftAction(formData: FormData) {
  return createTrainlyBlockCore('draft', formData)
}

async function createTrainlyBlockCore(intent: SaveIntent, formData: FormData) {
  const { supabase } = await requireAdmin()
  const f = readBlockFields(formData)
  validateForIntent(intent, f, '/admin/blocks/new')

  const status = intent === 'publish' ? 'published' : 'draft'
  const { data: created, error } = await supabase
    .from('block_library' as never)
    .insert({
      coach_id: null,
      name: f.name,
      notes: f.notes || null,
      timer_note: f.timerNote || null,
      sport_id: f.sportId,
      format_id: null,
      expected_result_unit_id: f.expectedResultUnitId || null,
      free_constraints: [],
      status,
      allow_duplicate: f.allowDuplicate,
      allow_download: false,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(
      `/admin/blocks/new?error=${encodeURIComponent(error?.message ?? 'Création impossible')}`,
    )
  }

  const id = (created as { id: string }).id
  const exoErr = await syncBlockExercises(supabase, id, f.exerciseIds, f.prescriptions)
  if (exoErr) redirect(`/admin/blocks/${id}/edit?error=${encodeURIComponent(exoErr)}`)
  const hideErr = await syncHiddenTypes(supabase, id, f.hiddenTypeIds)
  if (hideErr) redirect(`/admin/blocks/${id}/edit?error=${encodeURIComponent(hideErr)}`)

  revalidateBlocks(id)

  const returnTo = String(formData.get('return_to') ?? '').trim()
  const asPopup = String(formData.get('popup') ?? '') === '1'
  if (asPopup) {
    const q = new URLSearchParams({
      attachBlock: id,
      name: f.name || 'Bloc',
    })
    redirect(`/admin/blocks/popup-done?${q.toString()}`)
  }
  if (returnTo.startsWith('/admin/sessions')) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}attachBlock=${encodeURIComponent(id)}`)
  }

  redirect(
    intent === 'publish'
      ? `/admin/exercises?kind=blocks&view=published&ok=published`
      : `/admin/exercises?kind=blocks&view=draft&ok=draft`,
  )
}

export async function updateTrainlyBlockAction(formData: FormData) {
  return saveTrainlyBlock('keep', formData)
}

export async function publishTrainlyBlockAction(formData: FormData) {
  return saveTrainlyBlock('publish', formData)
}

export async function saveDraftTrainlyBlockAction(formData: FormData) {
  return saveTrainlyBlock('draft', formData)
}

async function saveTrainlyBlock(intent: SaveIntent | 'keep', formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/admin/exercises?kind=blocks')

  const f = readBlockFields(formData)
  const base = `/admin/blocks/${id}/edit`
  const effective: SaveIntent =
    intent === 'keep'
      ? formData.get('current_status') === 'published'
        ? 'publish'
        : 'draft'
      : intent
  validateForIntent(effective, f, base)

  const status =
    intent === 'publish' ? 'published' : intent === 'draft' ? 'draft' : effective === 'publish' ? 'published' : 'draft'

  if (status === 'draft') {
    const linkErr = await assertBlockNotLinkedToPublishedSession(supabase, id)
    if (linkErr) redirect(`${base}?error=${encodeURIComponent(linkErr)}`)
  }

  const { error } = await supabase
    .from('block_library' as never)
    .update({
      name: f.name,
      notes: f.notes || null,
      timer_note: f.timerNote || null,
      sport_id: f.sportId,
      format_id: null,
      expected_result_unit_id: f.expectedResultUnitId || null,
      free_constraints: [],
      status,
      allow_duplicate: f.allowDuplicate,
      allow_download: false,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) redirect(`${base}?error=${encodeURIComponent(error.message)}`)

  const exoErr = await syncBlockExercises(supabase, id, f.exerciseIds, f.prescriptions)
  if (exoErr) redirect(`${base}?error=${encodeURIComponent(exoErr)}`)
  const hideErr = await syncHiddenTypes(supabase, id, f.hiddenTypeIds)
  if (hideErr) redirect(`${base}?error=${encodeURIComponent(hideErr)}`)

  revalidateBlocks(id)
  redirect(
    intent === 'publish'
      ? `/admin/exercises?kind=blocks&view=published&ok=published`
      : intent === 'draft'
        ? `/admin/exercises?kind=blocks&view=draft&ok=draft`
        : `${base}?ok=saved`,
  )
}

export async function deleteTrainlyBlockAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const returnTo =
    String(formData.get('return_to') ?? '').trim() || '/admin/exercises?kind=blocks'
  if (!id) redirect('/admin/exercises?kind=blocks')

  const { error } = await supabase
    .from('block_library' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) {
    redirect(`/admin/blocks/${id}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidateBlocks(id)
  redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=deleted`)
}

export async function setBlockCatalogStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/admin/exercises?kind=blocks'
  if (!id || (status !== 'draft' && status !== 'published')) {
    redirect(returnTo)
  }

  if (status === 'published') {
    const { data: block } = await supabase
      .from('block_library' as never)
      .select('sport_id, expected_result_unit_id')
      .eq('id' as never, id as never)
      .maybeSingle()
    const b = block as {
      sport_id?: string | null
      expected_result_unit_id?: string | null
    } | null
    const { count } = await supabase
      .from('block_library_exercises' as never)
      .select('id', { count: 'exact', head: true })
      .eq('block_id' as never, id as never)
    if (!b?.sport_id || !b?.expected_result_unit_id || !count) {
      redirect(
        `${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
          'Publication : sport + unité résultat + ≥1 exo requis',
        )}`,
      )
    }
  } else {
    const linkErr = await assertBlockNotLinkedToPublishedSession(supabase, id)
    if (linkErr) {
      redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(linkErr)}`)
    }
  }

  const { error } = await supabase
    .from('block_library' as never)
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(error.message)}`)
  }

  revalidateBlocks(id)
  redirect(
    `${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=${status === 'published' ? 'published' : 'draft'}`,
  )
}

export async function createTrainlySportAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const label = String(formData.get('label') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/admin/exercises?view=sports'
  if (!label) redirect(`${returnTo}&error=${encodeURIComponent('Nom de sport requis')}`.replace('?&', '?'))

  const { error } = await supabase.from('sports' as never).insert({ coach_id: null, label } as never)
  if (error) {
    const msg = /unique|duplicate/i.test(error.message)
      ? 'Ce sport existe déjà.'
      : error.message
    redirect(`/admin/exercises?view=sports&error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/admin/exercises')
  revalidatePath('/admin/exercises/new')
  revalidatePath('/admin/blocks/new')
  redirect('/admin/exercises?view=sports&ok=sport')
}

export async function deleteTrainlySportAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/admin/exercises?view=sports')
  const { error } = await supabase
    .from('sports' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)
  if (error) redirect(`/admin/exercises?view=sports&error=${encodeURIComponent(error.message)}`)
  revalidatePath('/admin/exercises')
  redirect('/admin/exercises?view=sports&ok=sport_deleted')
}

export async function createTrainlyUnitAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const label = String(formData.get('label') ?? '').trim()
  const keyRaw = String(formData.get('key') ?? '').trim()
  const valueMode = String(formData.get('value_mode') ?? 'number').trim()
  const kind = String(formData.get('kind') ?? '').trim() || 'exercises'
  const returnTo =
    String(formData.get('return_to') ?? '').trim() ||
    `/admin/exercises?kind=${kind === 'blocks' ? 'blocks' : 'exercises'}&view=units`

  if (!label) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent('Libellé requis')}`)
  }
  const key =
    keyRaw ||
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) ||
    'unit'

  const mode = valueMode === 'time' || valueMode === 'text' || valueMode === 'list' ? valueMode : 'number'
  const dimension = mode === 'time' ? 'time' : mode === 'text' || mode === 'list' ? 'other' : 'count'
  const short_label = label.split(/\s+/)[0]?.slice(0, 12) || label.slice(0, 12)
  const listRaw = String(formData.get('list_options') ?? '')
  const list_options =
    mode === 'list'
      ? [
          ...new Set(
            listRaw
              .split(/[\n,;]+/)
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ].slice(0, 50)
      : null
  if (mode === 'list' && (!list_options || list_options.length < 2)) {
    redirect(
      `${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
        'Une liste nécessite au moins 2 options',
      )}`,
    )
  }

  const { error } = await supabase.from('units' as never).insert({
    coach_id: null,
    key,
    label,
    short_label,
    dimension,
    value_mode: mode,
    list_options,
  } as never)

  if (error) {
    const msg = /unique|duplicate/i.test(error.message)
      ? 'Cette unité existe déjà (clé unique).'
      : error.message
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/admin/exercises')
  revalidatePath('/admin/blocks/new')
  redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=unit`)
}

export async function deleteTrainlyUnitAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const kind = String(formData.get('kind') ?? '').trim() || 'exercises'
  const returnTo = `/admin/exercises?kind=${kind === 'blocks' ? 'blocks' : 'exercises'}&view=units`
  if (!id) redirect(returnTo)

  const { error } = await supabase
    .from('units' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) {
    redirect(`${returnTo}&error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/admin/exercises')
  redirect(`${returnTo}&ok=unit_deleted`)
}
