const BUCKET = 'coach-showroom'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export type CoachShowroomMediaKind = 'photo' | 'cover'

export function coachShowroomBucket() {
  return BUCKET
}

export function coachShowroomMediaPath(coachId: string, kind: CoachShowroomMediaKind, mimeType: string) {
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  return `${coachId}/${kind}.${ext}`
}

export function coachShowroomMediaCandidates(coachId: string, kind: CoachShowroomMediaKind) {
  return [
    `${coachId}/${kind}.jpg`,
    `${coachId}/${kind}.png`,
    `${coachId}/${kind}.webp`,
    `${coachId}/${kind}.gif`,
  ]
}

/** Photo card / fiche d’une prestation (showroom). */
export function coachPrestationPhotoPath(coachId: string, prestationId: string, mimeType: string) {
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  return `${coachId}/prestations/${prestationId}.${ext}`
}

export function coachPrestationPhotoCandidates(coachId: string, prestationId: string) {
  return [
    `${coachId}/prestations/${prestationId}.jpg`,
    `${coachId}/prestations/${prestationId}.png`,
    `${coachId}/prestations/${prestationId}.webp`,
    `${coachId}/prestations/${prestationId}.gif`,
  ]
}

/** Photo d’un témoignage showroom. */
export function coachTestimonialPhotoPath(coachId: string, testimonialId: string, mimeType: string) {
  const ext = MIME_TO_EXT[mimeType] ?? 'jpg'
  return `${coachId}/testimonials/${testimonialId}.${ext}`
}

export function coachTestimonialPhotoCandidates(coachId: string, testimonialId: string) {
  return [
    `${coachId}/testimonials/${testimonialId}.jpg`,
    `${coachId}/testimonials/${testimonialId}.png`,
    `${coachId}/testimonials/${testimonialId}.webp`,
    `${coachId}/testimonials/${testimonialId}.gif`,
  ]
}

export function isAllowedCoachShowroomMime(mimeType: string) {
  return mimeType in MIME_TO_EXT
}

export const MAX_COACH_SHOWROOM_BYTES = 5 * 1024 * 1024
