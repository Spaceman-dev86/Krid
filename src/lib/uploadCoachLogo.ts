import {
  coachBrandingBucket,
  coachLogoStoragePath,
  isAllowedCoachLogoMime,
  MAX_COACH_LOGO_BYTES,
} from './coachBrandingStorage'
import { createServiceRoleClient } from './supabase/serviceRole'

type UploadResult =
  | { ok: true; imageUrl: string; storagePath: string }
  | { ok: false; error: string }

export async function uploadCoachLogoImage(coachId: string, file: File): Promise<UploadResult> {
  const mimeType = file.type || 'image/jpeg'
  if (!isAllowedCoachLogoMime(mimeType)) {
    return { ok: false, error: 'Format accepté : JPG, PNG, WebP ou GIF.' }
  }
  if (file.size > MAX_COACH_LOGO_BYTES) {
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

  const storagePath = coachLogoStoragePath(coachId, mimeType)
  const fileBytes = new Uint8Array(await file.arrayBuffer())

  // Nettoie d’éventuelles anciennes extensions
  await service.storage.from(coachBrandingBucket()).remove([
    `${coachId}/logo.jpg`,
    `${coachId}/logo.png`,
    `${coachId}/logo.webp`,
    `${coachId}/logo.gif`,
  ])

  const { error: uploadError } = await service.storage
    .from(coachBrandingBucket())
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadError) {
    return { ok: false, error: uploadError.message ?? 'Échec du téléversement.' }
  }

  const { data: publicUrlData } = service.storage.from(coachBrandingBucket()).getPublicUrl(storagePath)
  const imageUrl = String(publicUrlData?.publicUrl ?? '').trim()
  if (!imageUrl) {
    return { ok: false, error: 'Impossible de générer l’URL publique.' }
  }

  // Cache-bust pour affichage immédiat
  const withBust = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
  return { ok: true, imageUrl: withBust, storagePath }
}
