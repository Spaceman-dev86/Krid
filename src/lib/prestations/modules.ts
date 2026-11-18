/** Modules d’accès d’une prestation (FIGÉ produit). */
export const PRESTATION_MODULES = [
  { id: 'fitness', label: 'Fitness' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'drive', label: 'Drive' },
  { id: 'messaging', label: 'Messagerie' },
  { id: 'on_demand', label: 'À la demande' },
  { id: 'habits', label: 'Habitudes' },
] as const

export type PrestationModuleId = (typeof PRESTATION_MODULES)[number]['id']

export function parseModules(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

export function modulesFromForm(formData: FormData): string[] {
  return PRESTATION_MODULES.map((m) => m.id).filter((id) => formData.get(`module_${id}`) === 'on')
}

/** Modules d’accès dérivés du contenu lié (plus de cases à cocher coach). */
export function modulesFromContentLinks(opts: {
  programTemplateId?: string | null
  nutritionTemplateId?: string | null
  driveFolderId?: string | null
  programTemplateIds?: string[] | null
  nutritionTemplateIds?: string[] | null
  driveFolderIds?: string[] | null
}): string[] {
  const mods: string[] = []
  const hasProgram =
    Boolean(opts.programTemplateId) || Boolean(opts.programTemplateIds?.length)
  const hasNutrition =
    Boolean(opts.nutritionTemplateId) || Boolean(opts.nutritionTemplateIds?.length)
  const hasDrive = Boolean(opts.driveFolderId) || Boolean(opts.driveFolderIds?.length)
  if (hasProgram) mods.push('fitness')
  if (hasNutrition) mods.push('nutrition')
  if (hasDrive) mods.push('drive')
  return mods
}

/** Tags showroom (jsonb string[]) — max 6, 40 car. */
export function parseShowroomTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Pastilles showroom (jsonb) — max 8, 32 car. · multi via field[] ou `${field}_text`. */
export function showroomTagsFromForm(
  formData: FormData,
  field: string = 'showroom_tags',
): string[] {
  const multi = formData
    .getAll(field)
    .flatMap((v) => String(v ?? '').split(/[,\n·|]/))
    .map((s) => s.trim())
    .filter(Boolean)
  const raw = String(formData.get(`${field}_text`) ?? '')
  const fromText = raw
    .split(/[,\n·|]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const parts = multi.length ? multi : fromText
  const uniq: string[] = []
  for (const p of parts) {
    if (uniq.length >= 8) break
    const clipped = p.slice(0, 32)
    if (!uniq.some((u) => u.toLowerCase() === clipped.toLowerCase())) uniq.push(clipped)
  }
  return uniq
}

export function formatPriceCents(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
