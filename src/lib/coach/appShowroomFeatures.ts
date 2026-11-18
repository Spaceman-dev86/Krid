/** Points forts card app showroom (jsonb string[]). */
export function parseAppShowroomFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const t = item.trim().slice(0, 80)
    if (!t) continue
    if (out.some((u) => u.toLowerCase() === t.toLowerCase())) continue
    out.push(t)
    if (out.length >= 8) break
  }
  return out
}

export function appShowroomFeaturesFromForm(formData: FormData): string[] {
  const multi = formData
    .getAll('app_showroom_features')
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
  return parseAppShowroomFeatures(multi)
}
