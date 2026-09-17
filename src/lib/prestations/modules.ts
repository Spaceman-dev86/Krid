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

export function formatPriceCents(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
