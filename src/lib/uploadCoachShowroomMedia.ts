import {
  coachShowroomBucket,
  coachShowroomMediaCandidates,
  coachShowroomMediaPath,
  isAllowedCoachShowroomMime,
  MAX_COACH_SHOWROOM_BYTES,
  type CoachShowroomMediaKind,
} from './coachShowroomStorage'
import { createServiceRoleClient } from './supabase/serviceRole'

type UploadResult =
  | { ok: true; imageUrl: string; storagePath: string }
  | { ok: false; error: string }

export async function uploadCoachShowroomMedia(
  coachId: string,
  kind: CoachShowroomMediaKind,
  file: File
): Promise<UploadResult> {
  const mimeType = file.type || 'image/jpeg'
  if (!isAllowedCoachShowroomMime(mimeType)) {
    return { ok: false, error: 'Format accepté : JPG, PNG, WebP ou GIF.' }
  }
  if (file.size > MAX_COACH_SHOWROOM_BYTES) {
    return { ok: false, error: 'Image trop lourde (max 5 Mo).' }
  }

  const service = createServiceRoleClient()
  if (!service) {
    return {
      ok: false,
      error:
        'Upload impossible : ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local puis redémarre le serveur.',
    }
  }

  const storagePath = coachShowroomMediaPath(coachId, kind, mimeType)
  const fileBytes = new Uint8Array(await file.arrayBuffer())

  await service.storage.from(coachShowroomBucket()).remove(coachShowroomMediaCandidates(coachId, kind))

  const { error: uploadError } = await service.storage
    .from(coachShowroomBucket())
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadError) {
    return { ok: false, error: uploadError.message ?? 'Échec du téléversement.' }
  }

  const { data: publicUrlData } = service.storage.from(coachShowroomBucket()).getPublicUrl(storagePath)
  const imageUrl = String(publicUrlData?.publicUrl ?? '').trim()
  if (!imageUrl) {
    return { ok: false, error: 'Impossible de générer l’URL publique.' }
  }

  const withBust = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
  return { ok: true, imageUrl: withBust, storagePath }
}

export async function removeCoachShowroomMedia(coachId: string, kind: CoachShowroomMediaKind) {
  const service = createServiceRoleClient()
  if (!service) return
  await service.storage.from(coachShowroomBucket()).remove(coachShowroomMediaCandidates(coachId, kind))
}
