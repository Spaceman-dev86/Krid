'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp, isPlatformAdmin } from '@/src/lib/auth/roles'
import { durationLabelFromWeekCount } from '@/src/lib/formatProgramDuration'
import { createClient } from '@/src/lib/supabase/server'
import { uploadProgramCoverImage } from '@/src/lib/uploadProgramCoverImage'

const LEVELS = new Set(['débutant', 'intermédiaire', 'avancé'])

function normalizeLevel(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (v === 'debutant') return 'débutant'
  if (v === 'confirme' || v === 'confirmé') return 'avancé'
  if (LEVELS.has(v)) return v
  return null
}

function parseWeekCount(raw: string): number | null {
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1 || n > 52) return null
  return n
}

export async function createTrainlyProgramAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin((profile as { role?: string | null } | null)?.role)) redirect('/home')

  const returnTo = '/admin/programs'
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const goal = String(formData.get('goal') ?? '').trim()
  const level = normalizeLevel(String(formData.get('level') ?? ''))
  const weekCount = parseWeekCount(String(formData.get('duration_weeks') ?? ''))
  const isCalendar = String(formData.get('is_calendar') ?? '1') === '1'
  const cover = formData.get('coverImage')

  if (!title) {
    redirect(`${returnTo}?error=${encodeURIComponent('Nom requis')}`)
  }
  if (!level) {
    redirect(`${returnTo}?error=${encodeURIComponent('Niveau requis')}`)
  }
  if (!weekCount) {
    redirect(`${returnTo}?error=${encodeURIComponent('Durée : 1 à 52 semaines')}`)
  }

  const { data: created, error } = await supabase
    .from('programs')
    .insert({
      coach_id: user.id,
      title,
      description: description || null,
      goal: goal || null,
      level,
      duration: durationLabelFromWeekCount(weekCount),
      is_calendar: isCalendar,
      is_template: true,
      is_published: false,
      is_trainly_catalog: true,
      catalog_status: 'draft',
      allow_duplicate: true,
      allow_download: false,
      status: 'draft',
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(`${returnTo}?error=${encodeURIComponent(error?.message ?? 'Création impossible')}`)
  }

  const programId = (created as { id: string }).id

  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    program_id: programId,
    week_order: i,
    title: `Semaine ${i + 1}`,
  }))

  const { error: weeksError } = await supabase.from('program_weeks').insert(weeks as never)
  if (weeksError) {
    redirect(
      `${returnTo}?error=${encodeURIComponent(weeksError.message ?? 'Semaines impossibles')}`,
    )
  }

  if (cover instanceof File && cover.size > 0) {
    const upload = await uploadProgramCoverImage(programId, cover)
    if (upload.ok) {
      await supabase
        .from('programs')
        .update({ image_url: upload.imageUrl } as never)
        .eq('id' as never, programId as never)
    }
  }

  revalidatePath('/admin/programs')
  revalidatePath(`/admin/programs/${programId}`)
  redirect(`/admin/programs/${programId}`)
}

export type ProgramInfosPatch = {
  title: string
  description: string | null
  goal: string | null
  level: string
  image_url: string | null
}

/** Met à jour les infos générales (titre, description, objectif, niveau, cover). */
export async function updateTrainlyProgramInfosQuietAction(
  formData: FormData,
): Promise<
  | { ok: true; flash: string; patch: ProgramInfosPatch }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile as { role?: string | null } | null)?.role
  const isAdmin = isPlatformAdmin(role)
  if (!isAdmin && !canAccessCoachApp(role)) {
    return { ok: false, error: 'Non autorisé' }
  }

  const programId = String(formData.get('program_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const goal = String(formData.get('goal') ?? '').trim() || null
  const level = normalizeLevel(String(formData.get('level') ?? ''))
  const cover = formData.get('coverImage')

  if (!programId) return { ok: false, error: 'Programme manquant' }
  if (!title) return { ok: false, error: 'Nom requis' }
  if (!level) return { ok: false, error: 'Niveau requis' }

  const { data: prog } = await supabase
    .from('programs')
    .select('id,image_url,is_trainly_catalog,coach_id,deleted_at')
    .eq('id', programId)
    .maybeSingle()
  const row = prog as {
    id: string
    image_url: string | null
    is_trainly_catalog: boolean | null
    coach_id: string | null
    deleted_at: string | null
  } | null
  const canEdit =
    row &&
    !row.deleted_at &&
    ((isAdmin && row.is_trainly_catalog === true) || row.coach_id === user.id)
  if (!canEdit) {
    return { ok: false, error: 'Programme introuvable' }
  }

  let imageUrl = row.image_url
  if (cover instanceof File && cover.size > 0) {
    const upload = await uploadProgramCoverImage(programId, cover)
    if (!upload.ok) return { ok: false, error: upload.error || 'Upload image impossible' }
    imageUrl = upload.imageUrl
  }

  const { error } = await supabase
    .from('programs')
    .update({
      title,
      description,
      goal,
      level,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)
  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    flash: 'Infos enregistrées',
    patch: {
      title,
      description,
      goal,
      level,
      image_url: imageUrl,
    },
  }
}
