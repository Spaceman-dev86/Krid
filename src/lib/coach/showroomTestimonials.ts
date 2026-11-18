export type ShowroomTestimonial = {
  id: string
  name: string
  quote: string
  photo_url: string | null
}

const MAX_ITEMS = 12

export function parseShowroomTestimonials(raw: unknown): ShowroomTestimonial[] {
  if (!Array.isArray(raw)) return []
  const out: ShowroomTestimonial[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = String(row.id ?? '').trim()
    const name = String(row.name ?? '').trim().slice(0, 80)
    const quote = String(row.quote ?? '').trim().slice(0, 600)
    const photo = String(row.photo_url ?? '').trim()
    if (!id || !name) continue
    out.push({
      id,
      name,
      quote,
      photo_url: photo && /^https?:\/\//i.test(photo) ? photo.slice(0, 800) : null,
    })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

export function showroomTestimonialsFromForm(formData: FormData): ShowroomTestimonial[] {
  const raw = String(formData.get('showroom_testimonials_json') ?? '').trim()
  if (!raw) return []
  try {
    return parseShowroomTestimonials(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

export function newTestimonialId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}
