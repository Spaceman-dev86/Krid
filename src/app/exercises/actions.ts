'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { chatDb } from '../../lib/chat/chat'
import { readExerciseFicheFields, type BridgeRow } from '../../lib/exercises/ficheFormParse'
import { createClient } from '../../lib/supabase/server'
import { ensureCoachTagCopies, remapId } from '../../lib/tags/seedCoachTags'

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

function revalidateExercises(id?: string) {
  revalidatePath('/exercises')
  revalidatePath('/exercises/catalogue')
  revalidatePath('/exercises/mine')
  revalidatePath('/exercises/brouillon')
  revalidatePath('/exercises/new')
  if (id) {
    revalidatePath(`/exercises/mine/${id}`)
    revalidatePath(`/exercises/brouillon/${id}`)
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

  await supabase
    .from('exercise_library')
    .update({
      replacement_exercise_id: cleaned[0]?.exerciseId ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', exerciseId)

  return null
}

async function resolveTypeLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  exerciseTypeId: string,
) {
  const { data: typeRow } = await supabase
    .from('exercise_types' as never)
    .select('label')
    .eq('id' as never, exerciseTypeId as never)
    .maybeSingle()
  return (typeRow as { label?: string } | null)?.label ?? null
}

export async function createCoachExercisePublishedAction(formData: FormData) {
  return createCoachExerciseCore('publish', formData)
}

export async function createCoachExerciseDraftAction(formData: FormData) {
  return createCoachExerciseCore('draft', formData)
}

async function createCoachExerciseCore(intent: 'publish' | 'draft', formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const f = readExerciseFicheFields(formData)

  if (!f.name) redirect('/exercises/new?error=' + encodeURIComponent('Nom requis'))
  if (!f.exerciseTypeId) redirect('/exercises/new?error=' + encodeURIComponent('Type requis'))
  if (!f.sportId) redirect('/exercises/new?error=' + encodeURIComponent('Sport requis'))

  const typeLabel = await resolveTypeLabel(supabase, f.exerciseTypeId)
  const status = intent === 'publish' ? 'published' : 'draft'

  const { data: created, error } = await supabase
    .from('exercise_library')
    .insert({
      coach_id: userId,
      name: f.name,
      status,
      exercise_type_id: f.exerciseTypeId,
      exercise_type: typeLabel,
      sport_id: f.sportId,
      description: f.description || null,
      muscle_group: f.muscleGroup || null,
      difficulty: f.difficulty,
      video_url: f.videoUrl || null,
      demo_media_path: f.demoMediaPath || null,
      named_notes: f.namedNotes,
      allow_duplicate: false,
      allow_download: false,
      source_kind: 'own',
      source_exercise_id: null,
      replacement_exercise_id: f.bridges[0]?.exerciseId ?? null,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect('/exercises/new?error=' + encodeURIComponent(error?.message ?? 'Création impossible'))
  }

  const id = (created as { id: string }).id
  const syncErr = await syncBridges(supabase, id, f.bridges)
  if (syncErr) {
    redirect(`/exercises/brouillon/${id}?error=` + encodeURIComponent(syncErr))
  }

  revalidateExercises(id)
  redirect(intent === 'publish' ? '/exercises/mine' : '/exercises/brouillon')
}

/** @deprecated — préférer createCoachExercisePublishedAction / Draft */
export async function createCoachExerciseAction(formData: FormData) {
  const asDraft = str(formData, 'as_draft') === '1'
  return createCoachExerciseCore(asDraft ? 'draft' : 'publish', formData)
}

/** Wrappers sans `name` sur le bouton (incompatible avec formAction React). */
export async function saveAndPublishCoachExerciseAction(formData: FormData) {
  formData.set('publish', '1')
  formData.delete('keep_draft')
  return saveCoachExerciseAction(formData)
}

export async function saveKeepDraftCoachExerciseAction(formData: FormData) {
  formData.set('keep_draft', '1')
  formData.delete('publish')
  return saveCoachExerciseAction(formData)
}

export async function saveCoachExerciseAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  const publish = str(formData, 'publish') === '1'
  const keepDraft = str(formData, 'keep_draft') === '1'
  const f = readExerciseFicheFields(formData)

  if (!id || !f.name) redirect('/exercises/mine?error=' + encodeURIComponent('Données invalides'))
  if (!f.exerciseTypeId) {
    redirect(`/exercises/mine/${id}?error=` + encodeURIComponent('Type requis'))
  }
  if (!f.sportId) {
    redirect(`/exercises/mine/${id}?error=` + encodeURIComponent('Sport requis'))
  }

  const typeLabel = await resolveTypeLabel(supabase, f.exerciseTypeId)
  const patch: Record<string, unknown> = {
    name: f.name,
    exercise_type_id: f.exerciseTypeId,
    exercise_type: typeLabel,
    sport_id: f.sportId,
    description: f.description || null,
    muscle_group: f.muscleGroup || null,
    difficulty: f.difficulty,
    video_url: f.videoUrl || null,
    demo_media_path: f.demoMediaPath || null,
    named_notes: f.namedNotes,
    updated_at: new Date().toISOString(),
  }
  if (publish) patch.status = 'published'
  if (keepDraft) patch.status = 'draft'

  const { error } = await supabase
    .from('exercise_library')
    .update(patch as never)
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(`/exercises/mine/${id}?error=` + encodeURIComponent(error.message))
  }

  const syncErr = await syncBridges(supabase, id, f.bridges)
  if (syncErr) {
    redirect(`/exercises/mine/${id}?error=` + encodeURIComponent(syncErr))
  }

  revalidateExercises(id)
  if (publish) redirect('/exercises/mine')
  if (keepDraft) redirect('/exercises/brouillon')
  redirect(`/exercises/mine/${id}`)
}

export async function moveCoachExerciseToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises/mine')

  const { error } = await supabase
    .from('exercise_library')
    .update({ status: 'draft', updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect('/exercises/mine?error=' + encodeURIComponent(error.message))
  }

  revalidateExercises(id)
  redirect(`/exercises/brouillon/${id}`)
}

export async function publishCoachExerciseAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises/brouillon')

  const { error } = await supabase
    .from('exercise_library')
    .update({ status: 'published', updated_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect('/exercises/brouillon?error=' + encodeURIComponent(error.message))
  }

  revalidateExercises(id)
  redirect('/exercises/mine')
}

export async function softDeleteCoachExerciseAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  const from = str(formData, 'from') || 'mine'
  const dest = from === 'brouillon' ? '/exercises/brouillon' : '/exercises/mine'
  if (!id) redirect(dest)

  const { loadExerciseTemplateUsages } = await import('@/src/lib/exercises/templateUsage')
  const usages = await loadExerciseTemplateUsages(supabase, userId, [id])
  const templates = usages.get(id)?.templates ?? []
  if (templates.length) {
    const n = templates.length
    redirect(
      `${dest}?error=` +
        encodeURIComponent(
          `Impossible d’archiver : utilisé dans ${n} modèle${n > 1 ? 's' : ''} (bloc/séance). Ouvre le compteur Utilisé pour retirer ou remplacer.`,
        ),
    )
  }

  await supabase
    .from('exercise_library')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', id)
    .eq('coach_id', userId)

  revalidateExercises()
  redirect(`${dest}?deleted=1`)
}

export async function forkKridExerciseToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises/catalogue')

  const { data: src, error: srcErr } = await supabase
    .from('exercise_library')
    .select(
      'name, description, muscle_group, difficulty, video_url, demo_media_path, exercise_type, exercise_type_id, sport_id, named_notes, status, allow_duplicate',
    )
    .eq('id', id)
    .is('coach_id', null)
    .is('deleted_at', null)
    .maybeSingle()

  if (srcErr || !src) {
    redirect(
      '/exercises/catalogue?error=' + encodeURIComponent(srcErr?.message || 'Exercice introuvable'),
    )
  }

  const srcRow = src as {
    name: string
    description: string | null
    muscle_group: string | null
    difficulty: string | null
    video_url: string | null
    demo_media_path: string | null
    exercise_type: string | null
    exercise_type_id?: string | null
    sport_id?: string | null
    named_notes?: unknown
    status?: string | null
    allow_duplicate?: boolean | null
  }

  if (srcRow.status && srcRow.status !== 'published') {
    redirect('/exercises/catalogue?error=' + encodeURIComponent('Exercice non publié'))
  }
  if (srcRow.allow_duplicate === false) {
    redirect('/exercises/catalogue?error=' + encodeURIComponent('Duplication non autorisée'))
  }

  const maps = await ensureCoachTagCopies(supabase, userId)

  const { data, error } = await supabase
    .from('exercise_library')
    .insert({
      coach_id: userId,
      name: srcRow.name,
      description: srcRow.description,
      muscle_group: srcRow.muscle_group,
      difficulty: srcRow.difficulty,
      video_url: srcRow.video_url,
      demo_media_path: srcRow.demo_media_path,
      exercise_type: srcRow.exercise_type,
      exercise_type_id: remapId(maps.types, srcRow.exercise_type_id ?? null),
      sport_id: remapId(maps.sports, srcRow.sport_id ?? null),
      named_notes: srcRow.named_notes ?? [],
      status: 'draft',
      source_kind: 'krid',
      source_exercise_id: id,
      allow_duplicate: false,
      allow_download: false,
    } as never)
    .select('id')
    .single()

  if (error || !data?.id) {
    redirect(
      '/exercises/catalogue?error=' + encodeURIComponent(error?.message || 'Copie impossible'),
    )
  }

  revalidateExercises(data.id)
  redirect(`/exercises/brouillon/${data.id}?forked=1`)
}

export async function transferTrainlyExerciseAction(formData: FormData) {
  return forkKridExerciseToDraftAction(formData)
}
