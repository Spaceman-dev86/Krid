'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { chatDb } from '../../lib/chat/chat'
import { createClient } from '../../lib/supabase/server'

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

export async function createCoachExerciseAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const name = str(formData, 'name')
  const exerciseType = str(formData, 'exercise_type') || null
  const asDraft = str(formData, 'as_draft') === '1'
  const description = str(formData, 'description') || null
  const muscleGroup = str(formData, 'muscle_group') || null
  const difficulty = str(formData, 'difficulty') || null
  const videoUrl = str(formData, 'video_url') || null

  if (!name) redirect('/exercises/new?error=' + encodeURIComponent('Nom requis'))

  const db = chatDb(supabase)
  const { data, error } = await db
    .from('exercise_library')
    .insert({
      coach_id: userId,
      name,
      exercise_type: exerciseType,
      description,
      muscle_group: muscleGroup,
      difficulty,
      video_url: videoUrl,
      status: asDraft ? 'draft' : 'published',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    redirect('/exercises/new?error=' + encodeURIComponent(error?.message || 'Création impossible'))
  }

  revalidatePath('/exercises')
  revalidatePath('/exercises/mine')
  revalidatePath('/exercises/brouillon')
  redirect(asDraft ? `/exercises/brouillon/${data.id}` : `/exercises/mine/${data.id}?saved=1`)
}

export async function saveCoachExerciseAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  const name = str(formData, 'name')
  const exerciseType = str(formData, 'exercise_type') || null
  const description = str(formData, 'description') || null
  const muscleGroup = str(formData, 'muscle_group') || null
  const difficulty = str(formData, 'difficulty') || null
  const videoUrl = str(formData, 'video_url') || null
  const publish = str(formData, 'publish') === '1'
  const keepDraft = str(formData, 'keep_draft') === '1'

  if (!id || !name) redirect('/exercises/mine?error=' + encodeURIComponent('Données invalides'))

  const patch: Record<string, unknown> = {
    name,
    exercise_type: exerciseType,
    description,
    muscle_group: muscleGroup,
    difficulty,
    video_url: videoUrl,
    updated_at: new Date().toISOString(),
  }
  if (publish) patch.status = 'published'
  if (keepDraft) patch.status = 'draft'

  const db = chatDb(supabase)
  const { error } = await db
    .from('exercise_library')
    .update(patch)
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(`/exercises/mine/${id}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/exercises')
  revalidatePath('/exercises/mine')
  revalidatePath('/exercises/brouillon')
  const dest = publish || !keepDraft ? 'mine' : 'brouillon'
  redirect(`/exercises/${dest}/${id}?saved=1`)
}

export async function softDeleteCoachExerciseAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises/mine')

  const db = chatDb(supabase)
  await db
    .from('exercise_library')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', userId)

  revalidatePath('/exercises')
  revalidatePath('/exercises/mine')
  revalidatePath('/exercises/brouillon')
  redirect('/exercises/mine?deleted=1')
}

/** Copie détachée Trainly → Ma biblio (published). */
export async function transferTrainlyExerciseAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = str(formData, 'id')
  if (!id) redirect('/exercises')

  const db = chatDb(supabase)
  const { data: src, error: srcErr } = await db
    .from('exercise_library')
    .select(
      'name, description, muscle_group, difficulty, video_url, demo_media_path, exercise_type, status, allow_duplicate',
    )
    .eq('id', id)
    .is('coach_id', null)
    .is('deleted_at', null)
    .maybeSingle()

  if (srcErr || !src) {
    redirect('/exercises?error=' + encodeURIComponent(srcErr?.message || 'Exercice introuvable'))
  }

  const srcRow = src as {
    name: string
    description: string | null
    muscle_group: string | null
    difficulty: string | null
    video_url: string | null
    demo_media_path: string | null
    exercise_type: string | null
    status?: string | null
    allow_duplicate?: boolean | null
  }

  if (srcRow.status && srcRow.status !== 'published') {
    redirect('/exercises?error=' + encodeURIComponent('Exercice non publié'))
  }
  if (srcRow.allow_duplicate === false) {
    redirect('/exercises?error=' + encodeURIComponent('Duplication non autorisée'))
  }

  const { data, error } = await db
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
      status: 'published',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    redirect('/exercises?error=' + encodeURIComponent(error?.message || 'Transfert impossible'))
  }

  revalidatePath('/exercises/mine')
  redirect(`/exercises/mine/${data.id}?transferred=1`)
}
