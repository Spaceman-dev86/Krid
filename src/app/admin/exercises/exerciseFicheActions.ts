'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import { normalizeDifficulty } from '../../../lib/exercises/ficheConstants'
import { createClient } from '../../../lib/supabase/server'

export type NamedNote = { title: string; body: string }
export type BridgeRow = { title: string; note: string; exerciseId: string }

function parseNamedNotes(formData: FormData): NamedNote[] {
  const titles = formData.getAll('note_titles').map((v) => String(v ?? '').trim())
  const bodies = formData.getAll('note_bodies').map((v) => String(v ?? '').trim())
  const len = Math.max(titles.length, bodies.length)
  const out: NamedNote[] = []
  for (let i = 0; i < len; i++) {
    const title = titles[i] ?? ''
    const body = bodies[i] ?? ''
    if (!title && !body) continue
    out.push({ title: title || 'Note', body })
  }
  return out
}

function parseBridges(formData: FormData): BridgeRow[] {
  const titles = formData.getAll('bridge_titles').map((v) => String(v ?? '').trim())
  const notes = formData.getAll('bridge_notes').map((v) => String(v ?? '').trim())
  const ids = formData.getAll('bridge_exercise_ids').map((v) => String(v ?? '').trim())
  const len = Math.max(titles.length, notes.length, ids.length)
  const out: BridgeRow[] = []
  for (let i = 0; i < len; i++) {
    const exerciseId = ids[i] ?? ''
    if (!exerciseId) continue
    out.push({
      title: titles[i] || 'Remplacement',
      note: notes[i] ?? '',
      exerciseId,
    })
  }
  return out
}

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

function revalidateExercise(id?: string) {
  revalidatePath('/admin/exercises')
  revalidatePath('/admin/catalog')
  if (id) {
    revalidatePath(`/admin/exercises/${id}`)
    revalidatePath(`/admin/exercises/${id}/edit`)
  }
}

async function syncBridges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  exerciseId: string,
  bridges: BridgeRow[],
) {
  const seen = new Set<string>()
  const cleaned: BridgeRow[] = []
  for (const b of bridges) {
    if (!b.exerciseId || b.exerciseId === exerciseId) continue
    if (seen.has(b.exerciseId)) continue
    seen.add(b.exerciseId)
    cleaned.push(b)
  }

  if (cleaned.length) {
    const ids = cleaned.map((b) => b.exerciseId)
    const { data: targets, error: targetErr } = await supabase
      .from('exercise_library')
      .select('id, status, deleted_at')
      .in('id', ids)

    if (targetErr) return targetErr.message

    const ok = new Set(
      ((targets ?? []) as { id: string; status?: string | null; deleted_at?: string | null }[])
        .filter((t) => !t.deleted_at && (!t.status || t.status === 'published'))
        .map((t) => t.id),
    )
    const bad = ids.filter((id) => !ok.has(id))
    if (bad.length) {
      return 'Ponts : chaque cible doit être un exercice publié (non corbeille)'
    }
  }

  const db = supabase as unknown as {
    from: (table: string) => {
      delete: () => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
      }
      insert: (values: unknown) => Promise<{ error: { message: string } | null }>
    }
  }

  const { error: delErr } = await db.from('exercise_replacements').delete().eq('exercise_id', exerciseId)
  if (delErr) return delErr.message

  if (cleaned.length) {
    const rows = cleaned.map((b, position) => ({
      exercise_id: exerciseId,
      replacement_id: b.exerciseId,
      position,
      title: b.title || null,
      note: b.note || null,
    }))
    const { error: insErr } = await db.from('exercise_replacements').insert(rows)
    if (insErr) return insErr.message
  }

  const { error: legErr } = await supabase
    .from('exercise_library')
    .update({
      replacement_exercise_id: cleaned[0]?.exerciseId ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', exerciseId)

  return legErr?.message ?? null
}

export async function createTrainlyExerciseTypeAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const label = String(formData.get('label') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/admin/exercises?view=types'

  if (!label) {
    redirect(`${returnTo}?error=${encodeURIComponent('Nom de type requis')}`)
  }

  const { error } = await supabase.from('exercise_types' as never).insert({
    coach_id: null,
    label,
  } as never)

  if (error) {
    const msg = /unique|duplicate/i.test(error.message)
      ? 'Ce type existe déjà (libellé unique).'
      : error.message
    redirect(`/admin/exercises?view=types&error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/admin/exercises')
  revalidatePath('/admin/exercises/new')
  redirect('/admin/exercises?view=types&ok=type')
}

export async function deleteTrainlyExerciseTypeAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/admin/exercises?view=types')

  const { error } = await supabase
    .from('exercise_types' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) {
    redirect(`/admin/exercises?view=types&error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/exercises')
  redirect('/admin/exercises?view=types&ok=type_deleted')
}

type SaveIntent = 'publish' | 'draft' | 'keep'

export async function createTrainlyExercisePublishedAction(formData: FormData) {
  return createTrainlyExerciseCore('publish', formData)
}

export async function createTrainlyExerciseDraftAction(formData: FormData) {
  return createTrainlyExerciseCore('draft', formData)
}

/** @deprecated prefer createTrainlyExercisePublishedAction / Draft */
export async function createTrainlyExerciseAction(formData: FormData) {
  const intent = formData.get('intent') === 'publish' ? 'publish' : 'draft'
  return createTrainlyExerciseCore(intent, formData)
}

async function createTrainlyExerciseCore(intent: 'publish' | 'draft', formData: FormData) {
  const { supabase } = await requireAdmin()

  const name = String(formData.get('name') ?? '').trim()
  const exerciseTypeId = String(formData.get('exercise_type_id') ?? '').trim()
  const sportId = String(formData.get('sport_id') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const muscleGroup = String(formData.get('muscle_group') ?? '').trim()
  const difficulty = normalizeDifficulty(String(formData.get('difficulty') ?? ''))
  const videoUrl = String(formData.get('video_url') ?? '').trim()
  const demoMediaPath = String(formData.get('demo_media_path') ?? '').trim()
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const namedNotes = parseNamedNotes(formData)
  const bridges = parseBridges(formData)

  if (!name) redirect('/admin/exercises/new?error=' + encodeURIComponent('Nom requis'))
  if (!exerciseTypeId) redirect('/admin/exercises/new?error=' + encodeURIComponent('Type requis'))
  if (!sportId) redirect('/admin/exercises/new?error=' + encodeURIComponent('Sport requis'))

  const { data: typeRow } = await supabase
    .from('exercise_types' as never)
    .select('label')
    .eq('id' as never, exerciseTypeId as never)
    .maybeSingle()

  const typeLabel = (typeRow as { label?: string } | null)?.label ?? null
  const status = intent === 'publish' ? 'published' : 'draft'

  const { data: created, error } = await supabase
    .from('exercise_library')
    .insert({
      name,
      coach_id: null,
      status,
      exercise_type_id: exerciseTypeId,
      exercise_type: typeLabel,
      sport_id: sportId,
      description: description || null,
      muscle_group: muscleGroup || null,
      difficulty,
      video_url: videoUrl || null,
      demo_media_path: demoMediaPath || null,
      named_notes: namedNotes,
      allow_duplicate: allowDuplicate,
      allow_download: false,
      replacement_exercise_id: bridges[0]?.exerciseId ?? null,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect('/admin/exercises/new?error=' + encodeURIComponent(error?.message ?? 'Création impossible'))
  }

  const id = (created as { id: string }).id
  const syncErr = await syncBridges(supabase, id, bridges)
  if (syncErr) {
    redirect(`/admin/exercises/${id}/edit?error=${encodeURIComponent(syncErr)}`)
  }

  revalidateExercise(id)
  redirect(
    intent === 'publish'
      ? `/admin/exercises?view=published&ok=published`
      : `/admin/exercises?view=draft&ok=draft`,
  )
}

export async function publishTrainlyExerciseAction(formData: FormData) {
  return updateTrainlyExerciseCore('publish', formData)
}

export async function saveDraftTrainlyExerciseAction(formData: FormData) {
  return updateTrainlyExerciseCore('draft', formData)
}

export async function updateTrainlyExerciseAction(formData: FormData) {
  return updateTrainlyExerciseCore('keep', formData)
}

async function updateTrainlyExerciseCore(intent: SaveIntent, formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/admin/exercises?error=' + encodeURIComponent('Exercice introuvable'))

  const name = String(formData.get('name') ?? '').trim()
  const exerciseTypeId = String(formData.get('exercise_type_id') ?? '').trim()
  const sportId = String(formData.get('sport_id') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const muscleGroup = String(formData.get('muscle_group') ?? '').trim()
  const difficulty = normalizeDifficulty(String(formData.get('difficulty') ?? ''))
  const videoUrl = String(formData.get('video_url') ?? '').trim()
  const demoMediaPath = String(formData.get('demo_media_path') ?? '').trim()
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const namedNotes = parseNamedNotes(formData)
  const bridges = parseBridges(formData)

  if (!name) redirect(`/admin/exercises/${id}/edit?error=` + encodeURIComponent('Nom requis'))
  if (!exerciseTypeId) redirect(`/admin/exercises/${id}/edit?error=` + encodeURIComponent('Type requis'))
  if (!sportId) redirect(`/admin/exercises/${id}/edit?error=` + encodeURIComponent('Sport requis'))

  const { data: typeRow } = await supabase
    .from('exercise_types' as never)
    .select('label')
    .eq('id' as never, exerciseTypeId as never)
    .maybeSingle()

  const typeLabel = (typeRow as { label?: string } | null)?.label ?? null

  const payload: Record<string, unknown> = {
    name,
    exercise_type_id: exerciseTypeId,
    exercise_type: typeLabel,
    sport_id: sportId,
    description: description || null,
    muscle_group: muscleGroup || null,
    difficulty,
    video_url: videoUrl || null,
    demo_media_path: demoMediaPath || null,
    named_notes: namedNotes,
    allow_duplicate: allowDuplicate,
    allow_download: false,
    updated_at: new Date().toISOString(),
  }
  if (intent === 'publish') payload.status = 'published'
  if (intent === 'draft') payload.status = 'draft'

  const { error } = await supabase
    .from('exercise_library')
    .update(payload as never)
    .eq('id', id)
    .is('coach_id', null)

  if (error) {
    redirect(`/admin/exercises/${id}/edit?error=${encodeURIComponent(error.message)}`)
  }

  const syncErr = await syncBridges(supabase, id, bridges)
  if (syncErr) {
    redirect(`/admin/exercises/${id}/edit?error=${encodeURIComponent(syncErr)}`)
  }

  revalidateExercise(id)
  if (intent === 'publish') {
    redirect(`/admin/exercises?view=published&ok=published`)
  }
  if (intent === 'draft') {
    redirect(`/admin/exercises?view=draft&ok=draft`)
  }
  redirect(`/admin/exercises/${id}/edit?ok=saved`)
}

export async function deleteTrainlyExerciseAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/admin/exercises'
  if (!id) redirect('/admin/exercises')

  const { error } = await supabase
    .from('exercise_library')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
    .is('coach_id', null)

  if (error) {
    redirect(`/admin/exercises/${id}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidateExercise(id)
  redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=deleted`)
}
