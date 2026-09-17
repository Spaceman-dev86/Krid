const COVER_BUCKET = 'home_page'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function programCoverStoragePath(programId: string, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  // Program cover images are stored under the programs section folder in Supabase Storage.
  return `3-programs/${programId}.${ext}`
}

export function programCoverBucket(): string {
  return COVER_BUCKET
}

export function isAllowedCoverMime(mimeType: string): boolean {
  return mimeType in MIME_TO_EXT
}

export const MAX_PROGRAM_COVER_BYTES = 5 * 1024 * 1024
