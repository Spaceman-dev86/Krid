'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  removeCoachShowroomMedia,
  uploadCoachShowroomMedia,
} from '../../lib/uploadCoachShowroomMedia'
import { uploadCoachTestimonialPhoto } from '../../lib/uploadCoachTestimonialPhoto'
import type { CoachShowroomMediaKind } from '../../lib/coachShowroomStorage'
import { appShowroomFeaturesFromForm } from '../../lib/coach/appShowroomFeatures'
import { showroomTestimonialsFromForm } from '../../lib/coach/showroomTestimonials'
import { mediaLibraryPublicUrl } from '../../lib/mediaLibrary'
import { showroomTagsFromForm } from '../../lib/prestations/modules'
import { safeInternalPath } from '../../lib/navigation/safeReturnTo'
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

export type ProfileSaveResult = { ok: true } | { ok: false; error: string }

async function persistCoachPublicProfile(formData: FormData): Promise<ProfileSaveResult> {
  const { supabase, user } = await requireCoach()

  const videoUrlRaw = clean(formData.get('video_url'))
  const video_url =
    videoUrlRaw && /^https?:\/\//i.test(videoUrlRaw) ? videoUrlRaw.slice(0, 500) : null

  const payload: Record<string, unknown> = {
    coach_id: user.id,
    public_name: clean(formData.get('public_name')),
    tagline: clean(formData.get('tagline')),
    bio: clean(formData.get('bio')),
    // Plus de pastilles « sous l’app » — on vide l’ancien champ
    showroom_tags: [],
    updated_at: new Date().toISOString(),
  }
  // Tranche 88 — tags du header
  const headerTags = showroomTagsFromForm(formData, 'showroom_header_tags')
  // Ne pas écraser share_message si le champ n’est plus dans le form
  if (formData.has('share_message')) {
    payload.share_message = clean(formData.get('share_message'))
  }

  const { error } = await supabase.from('coach_public_profile').upsert(payload as never, {
    onConflict: 'coach_id',
  })

  if (error) return { ok: false, error: error.message }

  // Colonne tranche 85 — update séparée ; ignore si SQL pas encore run
  const { error: videoError } = await supabase
    .from('coach_public_profile')
    .update({ video_url, updated_at: new Date().toISOString() } as never)
    .eq('coach_id', user.id)
  if (videoError && !/video_url|schema cache/i.test(videoError.message)) {
    return { ok: false, error: videoError.message }
  }

  // Colonne tranche 88 — pastilles header
  const { error: headerTagsError } = await supabase
    .from('coach_public_profile')
    .update({
      showroom_header_tags: headerTags,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('coach_id', user.id)
  if (
    headerTagsError &&
    !/showroom_header_tags|schema cache/i.test(headerTagsError.message)
  ) {
    return { ok: false, error: headerTagsError.message }
  }

  // Colonne tranche 87 — témoignages
  if (formData.has('showroom_testimonials_json')) {
    const testimonials = showroomTestimonialsFromForm(formData)
    const { error: testiError } = await supabase
      .from('coach_public_profile')
      .update({
        showroom_testimonials: testimonials,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('coach_id', user.id)
    if (testiError && !/showroom_testimonials|schema cache/i.test(testiError.message)) {
      return { ok: false, error: testiError.message }
    }
  }

  // Pitch card app (le nom vient de Mon app / coach_branding.app_name — pas édité ici)
  const appShowroomPitchRaw = clean(formData.get('app_showroom_pitch'))
  const appShowroomPitch = appShowroomPitchRaw ? appShowroomPitchRaw.slice(0, 600) : null

  const interestTitleRaw = clean(formData.get('interest_discuss_title'))
  const interestBodyRaw = clean(formData.get('interest_discuss_body'))
  const interestDiscussTitle = interestTitleRaw ? interestTitleRaw.slice(0, 120) : null
  const interestDiscussBody = interestBodyRaw ? interestBodyRaw.slice(0, 600) : null

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('coach_id', user.id)
    .maybeSingle()

  const appFeatures = appShowroomFeaturesFromForm(formData)

  if (branding) {
    const brandPayload: Record<string, unknown> = {
      app_showroom_pitch: appShowroomPitch,
      updated_at: new Date().toISOString(),
    }
    const { error: brandError } = await supabase
      .from('coach_branding')
      .update(brandPayload as never)
      .eq('coach_id', user.id)
    if (brandError) return { ok: false, error: brandError.message }

    // Tranche 90 — points forts ✓ (ignore si colonne absente)
    const { error: featuresError } = await supabase
      .from('coach_branding')
      .update({
        app_showroom_features: appFeatures,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('coach_id', user.id)
    if (
      featuresError &&
      !/app_showroom_features|schema cache/i.test(featuresError.message)
    ) {
      return { ok: false, error: featuresError.message }
    }

    // Tranche 93 — textes Je suis intéressé (ignore si colonnes absentes)
    if (formData.has('interest_discuss_title') || formData.has('interest_discuss_body')) {
      const { error: interestError } = await supabase
        .from('coach_branding')
        .update({
          interest_discuss_title: interestDiscussTitle,
          interest_discuss_body: interestDiscussBody,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('coach_id', user.id)
      if (
        interestError &&
        !/interest_discuss|schema cache/i.test(interestError.message)
      ) {
        return { ok: false, error: interestError.message }
      }
    }
  }

  revalidatePath('/profile')
  revalidatePath('/profile/rendu')
  revalidatePath('/c', 'layout')
  return { ok: true }
}

export async function saveCoachPublicProfileAction(formData: FormData) {
  const returnTo = safeInternalPath(formData.get('return_to'), '/profile')
  const result = await persistCoachPublicProfile(formData)
  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`)
  }
  redirect(`${returnTo}?saved=1`)
}

/** Autosave silencieux présentation showroom (pas de redirect). */
export async function autosaveCoachPublicProfileAction(
  formData: FormData,
): Promise<ProfileSaveResult> {
  return persistCoachPublicProfile(formData)
}

/** Réordonne les cartes presta visibles showroom (depuis le mockup). */
export async function reorderShowroomPrestationsAction(
  orderedIds: string[],
): Promise<ProfileSaveResult> {
  const { supabase, user } = await requireCoach()
  const ids = orderedIds.map((id) => String(id ?? '').trim()).filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Liste vide.' }
  if (ids.length > 80) return { ok: false, error: 'Trop d’offres.' }

  const { data: owned, error: ownedError } = await supabase
    .from('prestations')
    .select('id')
    .eq('coach_id', user.id)
    .in('id', ids)
    .is('deleted_at', null)

  if (ownedError) return { ok: false, error: ownedError.message }
  const ownedSet = new Set((owned ?? []).map((r) => (r as { id: string }).id))
  if (ids.some((id) => !ownedSet.has(id))) {
    return { ok: false, error: 'Offre invalide.' }
  }

  const now = new Date().toISOString()
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('prestations')
      .update({
        showroom_sort_order: i,
        updated_at: now,
      } as never)
      .eq('id', ids[i]!)
      .eq('coach_id', user.id)
    if (error) {
      if (/showroom_sort_order|schema cache/i.test(error.message)) {
        return {
          ok: false,
          error: 'Colonne showroom_sort_order absente — lance la tranche SQL 91.',
        }
      }
      return { ok: false, error: error.message }
    }
  }

  revalidatePath('/profile')
  revalidatePath('/c', 'layout')
  return { ok: true }
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

/** Cover depuis la banque (référence URL — pas de copie Storage coach). */
export async function setCoachShowroomCoverFromLibraryAction(
  formData: FormData,
): Promise<MediaActionResult> {
  const { supabase, user } = await requireCoach()
  const itemId = clean(formData.get('library_id'))
  if (!itemId) return { ok: false, error: 'Image catalogue invalide.' }

  const { data: row, error: loadError } = await supabase
    .from('media_library')
    .select('storage_path, active, kind')
    .eq('id', itemId)
    .maybeSingle()

  if (loadError) {
    if (/media_library|schema cache/i.test(loadError.message)) {
      return { ok: false, error: 'Banque images pas encore activée (SQL 89).' }
    }
    return { ok: false, error: loadError.message }
  }

  const path = (row as { storage_path?: string; active?: boolean; kind?: string } | null)
    ?.storage_path
  const active = (row as { active?: boolean } | null)?.active
  const kind = (row as { kind?: string } | null)?.kind
  if (!path || !active || kind !== 'cover') {
    return { ok: false, error: 'Image catalogue introuvable.' }
  }

  const imageUrl = mediaLibraryPublicUrl(path)
  if (!imageUrl) return { ok: false, error: 'URL catalogue invalide.' }

  const { error } = await supabase.from('coach_public_profile').upsert(
    {
      coach_id: user.id,
      cover_url: imageUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'coach_id' },
  )
  if (error) return { ok: false, error: error.message }

  // Retire l’ancienne cover uploadée coach (si existait)
  await removeCoachShowroomMedia(user.id, 'cover')

  revalidatePath('/profile')
  revalidatePath('/c', 'layout')
  return { ok: true, imageUrl }
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

export async function saveCoachTestimonialPhotoAction(
  formData: FormData,
): Promise<MediaActionResult> {
  const { user } = await requireCoach()
  const testimonialId = clean(formData.get('testimonial_id'))
  const file = formData.get('file')

  if (!testimonialId || !isUploadedImage(file)) {
    return { ok: false, error: 'Photo invalide.' }
  }
  if ((file as File).size > 4.5 * 1024 * 1024) {
    return { ok: false, error: 'Image trop lourde (max ~4,5 Mo).' }
  }

  const uploaded = await uploadCoachTestimonialPhoto(user.id, testimonialId, file as File)
  if (!uploaded.ok) {
    return { ok: false, error: uploaded.error }
  }

  revalidatePath('/profile')
  revalidatePath('/c', 'layout')
  return { ok: true, imageUrl: uploaded.imageUrl }
}
