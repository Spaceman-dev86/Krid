/**
 * Normes UI des unités Rx (séances / catalogue).
 *
 * - hybrid : texte OU chiffre libre + steppers +/- (ancien program builder)
 * - time   : mm:ss, steppers ±15s
 * - text   : texte forcé (tempo, note…)
 * - list   : select (options unit.list_options, ou 1–10 pour rpe legacy)
 */
export type PrescriptionUiKind = 'hybrid' | 'time' | 'text' | 'list'

export function prescriptionUiKind(
  unitKey: string | undefined | null,
  valueMode?: string | null,
): PrescriptionUiKind {
  if (valueMode === 'list' || unitKey === 'rpe') return 'list'
  if (valueMode === 'time') return 'time'
  if (valueMode === 'text') return 'text'
  if (valueMode === 'number') return 'hybrid'

  switch (unitKey) {
    case 'tempo':
    case 'note':
    case 'variable':
    case 'completed':
      return 'text'
    case 'rest_s':
    case 'time_s':
    case 'time_min':
      return 'time'
    case 'rpe':
      return 'list'
    case 'sets':
    case 'reps':
    case 'load_kg':
    case 'cal':
    default:
      return 'hybrid'
  }
}

/** Mode stocké par défaut quand on ajoute une unité. */
export function defaultInputModeForUnitKey(
  unitKey: string | undefined | null,
  valueMode?: string | null,
): 'number' | 'time' | 'text' | null {
  const kind = prescriptionUiKind(unitKey, valueMode)
  if (kind === 'text') return 'text'
  if (kind === 'time') return 'time'
  if (kind === 'list') return 'number'
  return null
}

export function valueControlMode(
  kind: PrescriptionUiKind,
): 'hybrid' | 'time' | 'text' {
  if (kind === 'time') return 'time'
  if (kind === 'text') return 'text'
  return 'hybrid'
}

export function listOptionsForUnit(unit: {
  key?: string | null
  list_options?: string[] | null
} | null | undefined): string[] {
  if (unit?.list_options?.length) return unit.list_options
  if (unit?.key === 'rpe') {
    return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  }
  return []
}
