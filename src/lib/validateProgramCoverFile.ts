import { isAllowedCoverMime, MAX_PROGRAM_COVER_BYTES } from './programCoverStorage'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function isProgramCoverFileType(mimeType: string): boolean {
  return ACCEPTED_TYPES.has(mimeType)
}

export function validateProgramCoverFile(file: File): { ok: true } | { ok: false; error: string } {
  const mimeType = file.type || 'image/jpeg'
  if (!isAllowedCoverMime(mimeType) && !ACCEPTED_TYPES.has(mimeType)) {
    return { ok: false, error: 'Format accepté : JPG, PNG, WebP ou GIF.' }
  }
  if (file.size > MAX_PROGRAM_COVER_BYTES) {
    return { ok: false, error: 'Image trop lourde (max 5 Mo).' }
  }
  return { ok: true }
}

export function fileFromDataTransfer(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer?.files?.length) return null
  const file = dataTransfer.files[0]
  if (!file || !String(file.type ?? '').startsWith('image/')) return null
  return file
}
