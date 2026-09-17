'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  removeCoachShowroomMedia,
  uploadCoachShowroomMedia,
} from '../../lib/uploadCoachShowroomMedia'
import type { CoachShowroomMediaKind } from '../../lib/coachShowroomStorage'
import { createClient } from '../../lib/supabase/server'

export type MediaActionResult =
  | { ok: true; imageUrl: string | null }
  | { ok: false; error: string }

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

function isUploadedImage(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== 'object') return false
  const f = value as { size?: unknown; arrayBuffer?: unknown; name?: unknown }
  return (
    typeof f.size === 'number' &&
    f.size > 0 &&
    typeof f.arrayBuffer === 'function' &&
    (typeof f.name !== 'string' || f.name.length > 0)
  )
}

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function saveCoachPublicProfileAction(formData: FormData) {
  const { supabase, user } = await requireCoach()
  const returnTo = clean(formData.get('return_to')) ?? '/profile'

  const payload = {
    coach_id: user.id,
    public_name: clean(formData.get('public_name')),
    tagline: clean(formData.get('tagline')),
    bio: clean(formData.get('bio')),
    share_message: clean(formData.get('share_message')),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('coach_public_profile').upsert(payload, { onConflict: 'coach_id' })

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/profile')
  revalidatePath('/c', 'layout')
  redirect(`${returnTo}?saved=1`)
}

export async function saveCoachPublicMediaAction(formData: FormData): Promise<MediaActionResult> {
  const { supabase, user } = await requireCoach()
  const kindRaw = clean(formData.get('kind'))
  const kind: CoachShowroomMediaKind | null =
    kindRaw === 'photo' || kindRaw === 'cover' ? kindRaw : null
  const file = formData.get('file')

  if (!kind || !isUploadedImage(file)) {
    return { ok: false, error: 'Image invalide.' }
  }

  // Sécurité : refuse les payloads trop gros (client doit compresser)
  if ((file as File).size > 4.5 * 1024 * 1024) {
    return { ok: false, error: 'Image trop lourde après compression (max ~4,5 Mo).' }
  }

  const uploaded = await uploadCoachShowroomMedia(user.id, kind, file as File)
  if (!uploaded.ok) {
    return { ok: false, error: uploaded.error }
  }

  const column = kind === 'photo' ? 'photo_url' : 'cover_url'
  const { error } = await supabase.from('coach_public_profile').upsert(
    {
      coach_id: user.id,
      [column]: uploaded.imageUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id' }
  )

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/profile')
  revalidatePath('/c', 'layout')
  return { ok: true, imageUrl: uploaded.imageUrl }
}

export async function clearCoachPublicMediaAction(formData: FormData): Promise<MediaActionResult> {
  const { supabase, user } = await requireCoach()
  const kindRaw = clean(formData.get('kind'))
  const kind: CoachShowroomMediaKind | null =
    kindRaw === 'photo' || kindRaw === 'cover' ? kindRaw : null

  if (!kind) {
    return { ok: false, error: 'Média invalide.' }
  }

  const column = kind === 'photo' ? 'photo_url' : 'cover_url'
  const { error } = await supabase
    .from('coach_public_profile')
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq('coach_id', user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  await removeCoachShowroomMedia(user.id, kind)

  revalidatePath('/profile')
  revalidatePath('/c', 'layout')
  return { ok: true, imageUrl: null }
}
