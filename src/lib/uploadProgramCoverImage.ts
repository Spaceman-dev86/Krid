import {
  isAllowedCoverMime,
  MAX_PROGRAM_COVER_BYTES,
  programCoverBucket,
  programCoverStoragePath,
} from './programCoverStorage'
import { createServiceRoleClient } from './supabase/serviceRole'

type UploadResult =
  | { ok: true; imageUrl: string; storagePath: string }
  | { ok: false; error: string }

export async function uploadProgramCoverImage(
  programId: string,
  file: File
): Promise<UploadResult> {
  const mimeType = file.type || 'image/jpeg'
  if (!isAllowedCoverMime(mimeType)) {
    return { ok: false, error: 'Format accepté : JPG, PNG, WebP ou GIF.' }
  }
  if (file.size > MAX_PROGRAM_COVER_BYTES) {
    return { ok: false, error: 'Image trop lourde (max 5 Mo).' }
  }

  const service = createServiceRoleClient()
  if (!service) {
    return {
      ok: false,
      error:
        'Upload impossible : ajoute SUPABASE_SERVICE_ROLE_KEY dans .env.local (Settings → API → service_role) puis redémarre le serveur.',
    }
  }

  const storagePath = programCoverStoragePath(programId, mimeType)
  const fileBytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await service.storage
    .from(programCoverBucket())
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: true,
    })

  if (uploadError) {
    return { ok: false, error: uploadError.message ?? 'Échec du téléversement de l’image.' }
  }

  const { data: publicUrlData } = service.storage.from(programCoverBucket()).getPublicUrl(storagePath)
  const imageUrl = String(publicUrlData?.publicUrl ?? '').trim()
  if (!imageUrl) {
    return { ok: false, error: 'Impossible de générer l’URL publique de l’image.' }
  }

  return { ok: true, imageUrl, storagePath }
}
