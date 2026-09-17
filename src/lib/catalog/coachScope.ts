/** Helpers requête catalogue admin — scope Trainly vs Coach via profil. */

export type CoachProfileEmbed = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

export function normalizeProfileEmbed(
  raw: CoachProfileEmbed | CoachProfileEmbed[] | null | undefined,
): CoachProfileEmbed | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

export function coachDisplayName(p: CoachProfileEmbed | null | undefined): string {
  if (!p) return 'Coach'
  return p.full_name?.trim() || p.email || p.id.slice(0, 8)
}
