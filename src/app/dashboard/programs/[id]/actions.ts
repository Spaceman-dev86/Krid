'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  isAllowedCoverMime,
  MAX_PROGRAM_COVER_BYTES,
  programCoverBucket,
  programCoverStoragePath,
} from '../../../../lib/programCoverStorage'
import { durationLabelFromWeekCount } from '../../../../lib/formatProgramDuration'
import { createClient } from '../../../../lib/supabase/server'
import { uploadProgramCoverImage } from '../../../../lib/uploadProgramCoverImage'

export type PublishProgramState =
  | { error: string }
  | { success: true }
  | null

export type UpdateProgramCoverState =
  | { error: string }
  | { success: true; imageUrl: string }
  | null

type ProgramsPublishUpdate = {
  from: (
    table: 'programs'
  ) => {
    update: (values: {
      is_published: boolean
      image_url: string
      goal?: string | null
      level?: string | null
      duration?: string | null
      description?: string | null
    }) => {
      eq: (column: 'id', value: string) => Promise<{ error: { message?: string } | null }>
    }
  }
}

type ProgramsCoverUpdate = {
  from: (
    table: 'programs'
  ) => {
    update: (values: { image_url: string }) => {
      eq: (column: 'id', value: string) => Promise<{ error: { message?: string } | null }>
    }
  }
}

export async function deleteProgramFromEditor(formData: FormData) {
  const programId = String(formData.get('programId') ?? '').trim()
  if (!programId) {
    redirect('/dashboard/programs?error=missing_id')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as { role: string | null } | null
  const isAdmin = profile?.role === 'admin'
  const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
  const backHref = isAdmin ? '/admin' : '/dashboard'

  const { data: currentProgramData } = await supabase
    .from('programs')
    .select('id,coach_id')
    .eq('id', programId)
    .maybeSingle()

  const currentProgram = currentProgramData as { id: string; coach_id: string } | null

  if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
    redirect(`${basePath}/${programId}?error=read_only`)
  }

  const { error } = await supabase.from('programs').delete().eq('id', programId)
  if (error) {
    redirect(`${basePath}/${programId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(basePath)
  revalidatePath(`${basePath}/${programId}`)
  redirect(backHref)
}

export async function publishProgramFromEditor(
  _prev: PublishProgramState,
  formData: FormData
): Promise<PublishProgramState> {
  const programId = String(formData.get('programId') ?? '').trim()
  if (!programId) {
    return { error: 'Programme introuvable.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as { role: string | null } | null
  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) {
    return { error: 'Action réservée aux administrateurs.' }
  }

  const { data: currentProgramData } = await supabase
    .from('programs')
    .select('id,is_published,goal,level,duration,description')
    .eq('id', programId)
    .maybeSingle()

  const currentProgram = currentProgramData as {
    id: string
    is_published: boolean | null
    goal: string | null
    level: string | null
    duration: string | null
    description: string | null
  } | null
  if (!currentProgram) {
    return { error: 'Programme introuvable.' }
  }
  if (currentProgram.is_published) {
    return { error: 'Ce programme est déjà publié.' }
  }

  const coverImage = formData.get('coverImage')
  if (!(coverImage instanceof File) || coverImage.size === 0) {
    return { error: 'Ajoute une photo de couverture avant de publier.' }
  }

  const mimeType = coverImage.type || 'image/jpeg'
  if (!isAllowedCoverMime(mimeType)) {
    return { error: 'Format accepté : JPG, PNG, WebP ou GIF.' }
  }
  if (coverImage.size > MAX_PROGRAM_COVER_BYTES) {
    return { error: 'Image trop lourde (max 5 Mo).' }
  }

  const upload = await uploadProgramCoverImage(programId, coverImage)
  if (!upload.ok) {
    return { error: upload.error }
  }

  const imageUrl = upload.imageUrl
  if (!isValidProgramCoverPublicUrl(imageUrl, programId)) {
    return { error: 'URL de couverture invalide.' }
  }

  const goal =
    String(formData.get('goal') ?? '').trim() || String(currentProgram.goal ?? '').trim() || null
  const level =
    String(formData.get('level') ?? '').trim() || String(currentProgram.level ?? '').trim() || null
  const description =
    String(formData.get('description') ?? '').trim() ||
    String(currentProgram.description ?? '').trim() ||
    null

  let duration =
    String(formData.get('duration') ?? '').trim() || String(currentProgram.duration ?? '').trim() || null
  if (!duration) {
    const { count, error: weeksCountError } = await supabase
      .from('program_weeks')
      .select('*', { count: 'exact', head: true })
      .eq('program_id', programId)

    if (weeksCountError) {
      return { error: weeksCountError.message ?? 'Impossible de calculer la durée du programme.' }
    }

    duration = durationLabelFromWeekCount(count ?? 0)
  }

  if (!goal) {
    return { error: 'Ajoute un objectif dans Infos générales avant de publier.' }
  }

  const publishPatch: {
    is_published: boolean
    image_url: string
    goal: string
    level?: string | null
    duration?: string | null
    description?: string | null
  } = {
    is_published: true,
    image_url: imageUrl,
    goal,
  }
  if (level) publishPatch.level = level
  if (duration) publishPatch.duration = duration
  if (description) publishPatch.description = description

  const { error } = await (supabase as unknown as ProgramsPublishUpdate)
    .from('programs')
    .update(publishPatch)
    .eq('id', programId)

  if (error) {
    return { error: error.message ?? 'Échec de la publication.' }
  }

  revalidatePath('/programs')
  revalidatePath('/admin')
  revalidatePath(`/programme/${programId}`)
  revalidatePath(`/admin/programs/${programId}`)
  return { success: true }
}

export async function updateProgramCoverFromEditor(
  _prev: UpdateProgramCoverState,
  formData: FormData
): Promise<UpdateProgramCoverState> {
  const programId = String(formData.get('programId') ?? '').trim()
  if (!programId) {
    return { error: 'Programme introuvable.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as { role: string | null } | null
  if (profile?.role !== 'admin') {
    return { error: 'Action réservée aux administrateurs.' }
  }

  const { data: currentProgramData } = await supabase
    .from('programs')
    .select('id,is_published')
    .eq('id', programId)
    .maybeSingle()

  const currentProgram = currentProgramData as { id: string; is_published: boolean | null } | null
  if (!currentProgram) {
    return { error: 'Programme introuvable.' }
  }
  if (!currentProgram.is_published) {
    return { error: 'Seuls les programmes publiés ont une photo de couverture éditable ici.' }
  }

  const coverImage = formData.get('coverImage')
  if (!(coverImage instanceof File) || coverImage.size === 0) {
    return { error: 'Choisis une nouvelle photo de couverture.' }
  }

  const mimeType = coverImage.type || 'image/jpeg'
  if (!isAllowedCoverMime(mimeType)) {
    return { error: 'Format accepté : JPG, PNG, WebP ou GIF.' }
  }
  if (coverImage.size > MAX_PROGRAM_COVER_BYTES) {
    return { error: 'Image trop lourde (max 5 Mo).' }
  }

  const upload = await uploadProgramCoverImage(programId, coverImage)
  if (!upload.ok) {
    return { error: upload.error }
  }

  const imageUrl = upload.imageUrl
  if (!isValidProgramCoverPublicUrl(imageUrl, programId)) {
    return { error: 'URL de couverture invalide.' }
  }

  const { error } = await (supabase as unknown as ProgramsCoverUpdate)
    .from('programs')
    .update({ image_url: imageUrl })
    .eq('id', programId)

  if (error) {
    return { error: error.message ?? 'Échec de la mise à jour de la photo.' }
  }

  revalidatePath('/programs')
  revalidatePath('/admin')
  revalidatePath(`/programme/${programId}`)
  revalidatePath(`/admin/programs/${programId}`)
  return { success: true, imageUrl }
}

function isValidProgramCoverPublicUrl(imageUrl: string, programId: string): boolean {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  if (!supabaseUrl) return false

  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return false
  }

  const expectedPrefix = `${supabaseUrl}/storage/v1/object/public/${programCoverBucket()}/`
  if (!parsed.href.startsWith(expectedPrefix)) return false

  const storagePath = parsed.href.slice(expectedPrefix.length)
  const allowedPaths = new Set([
    programCoverStoragePath(programId, 'image/jpeg'),
    programCoverStoragePath(programId, 'image/png'),
    programCoverStoragePath(programId, 'image/webp'),
    programCoverStoragePath(programId, 'image/gif'),
  ])

  return allowedPaths.has(storagePath)
}
