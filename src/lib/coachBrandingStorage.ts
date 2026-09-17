const BUCKET = 'coach-branding'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function coachBrandingBucket() {
  return BUCKET
}

export function coachLogoStoragePath(coachId: string, mimeType: string) {
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  return `${coachId}/logo.${ext}`
}

export function isAllowedCoachLogoMime(mimeType: string) {
  return mimeType in MIME_TO_EXT
}

export const MAX_COACH_LOGO_BYTES = 5 * 1024 * 1024
