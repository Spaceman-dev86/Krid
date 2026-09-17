/** Constantes catalogue blocs (admin). */

export const BLOCK_CONSTRAINT_FIELD_LABELS: Record<string, string> = {
  duration_seconds: 'Durée',
  work_seconds: 'Travail',
  rest_seconds: 'Repos',
  rounds: 'Tours',
  distance_m: 'Distance (m)',
}

export const CONSTRAINT_PICKER_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'work_seconds', label: 'Démarre toutes les / Travail' },
  { key: 'duration_seconds', label: 'Durée / timecap' },
  { key: 'rest_seconds', label: 'Repos' },
  { key: 'rounds', label: 'Tours' },
  { key: 'distance_m', label: 'Distance (m)' },
  { key: 'free', label: 'Contrainte libre…' },
]

/** Labels UI selon format (overrides). */
export function constraintFieldLabel(formatKey: string | null | undefined, field: string): string {
  if (formatKey === 'emom' && field === 'work_seconds') return 'Démarre toutes les'
  if (formatKey === 'emom' && field === 'duration_seconds') return 'Durée'
  if (field === 'work_seconds') return 'Travail'
  if (field === 'rest_seconds') return 'Repos'
  if (field === 'duration_seconds') return 'Durée / timecap'
  return BLOCK_CONSTRAINT_FIELD_LABELS[field] ?? field
}

export const TIME_CONSTRAINT_FIELDS = new Set(['duration_seconds', 'work_seconds', 'rest_seconds'])

export type FreeConstraint = { label: string; value: string }

export type ExercisePrescription = {
  unit_id: string
  value: string
  /** Override UI : number | time | text (Variable = note). */
  input_mode?: UnitValueMode | null
  varies?: boolean
}

export type UnitValueMode = 'number' | 'time' | 'text' | 'list'

export type UnitRow = {
  id: string
  label: string
  key: string
  short_label?: string | null
  value_mode?: UnitValueMode | null
  dimension?: string | null
  list_options?: string[] | null
}

export function unitValueMode(u: UnitRow | null | undefined): UnitValueMode {
  if (
    u?.value_mode === 'number' ||
    u?.value_mode === 'time' ||
    u?.value_mode === 'text' ||
    u?.value_mode === 'list'
  ) {
    return u.value_mode
  }
  if (u?.key === 'variable' || u?.key === 'completed' || u?.key === 'note' || u?.key === 'tempo') {
    return 'text'
  }
  if (u?.key === 'rpe') return 'list'
  if (u?.key === 'time_s' || u?.key === 'time_min' || u?.key === 'rest_s') return 'time'
  return 'number'
}

/** Unités texte natives (Note, Tempo…) : pas de bascule chiffre/texte. */
export function unitIsTextLocked(u: UnitRow | null | undefined): boolean {
  if (!u) return false
  if (u.key === 'note' || u.key === 'variable' || u.key === 'completed' || u.key === 'tempo') {
    return true
  }
  return unitValueMode(u) === 'text'
}

/** Mode effectif d’une ligne de prescription (override > unité). */
export function prescriptionInputMode(
  row: { unit_id: string; input_mode?: UnitValueMode | null },
  units: UnitRow[],
): UnitValueMode {
  if (row.input_mode === 'number' || row.input_mode === 'time' || row.input_mode === 'text') {
    return row.input_mode
  }
  return unitValueMode(units.find((u) => u.id === row.unit_id))
}

export function parseOptionalPositiveInt(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

export function parseOptionalNonNegInt(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}

/** Accepts integer seconds or mm:ss. */
export function parseSecondsField(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (s.includes(':')) {
    const parts = s.split(':')
    if (parts.length !== 2) return null
    const mm = Number.parseInt(parts[0] || '0', 10)
    const ss = Number.parseInt(parts[1] || '0', 10)
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0) return null
    return mm * 60 + ss
  }
  return parseOptionalNonNegInt(raw)
}

export function parseFreeConstraints(formData: FormData): FreeConstraint[] {
  const labels = formData.getAll('free_constraint_labels').map((v) => String(v ?? '').trim())
  const values = formData.getAll('free_constraint_values').map((v) => String(v ?? '').trim())
  const len = Math.max(labels.length, values.length)
  const out: FreeConstraint[] = []
  for (let i = 0; i < len; i++) {
    const label = labels[i] ?? ''
    const value = values[i] ?? ''
    if (!label && !value) continue
    out.push({ label: label || 'Contrainte', value })
  }
  return out
}

/** Parallel arrays: exercise_ids[i] + rx JSON in exercise_prescriptions[i] */
export function parseExerciseSlots(formData: FormData): {
  exerciseIds: string[]
  prescriptions: ExercisePrescription[][]
} {
  const exerciseIds = formData
    .getAll('exercise_ids')
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
  const rawRx = formData.getAll('exercise_prescriptions').map((v) => String(v ?? '').trim())
  const prescriptions = exerciseIds.map((_, i) => {
    const raw = rawRx[i] ?? '[]'
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((row) => {
          const r = row as {
            unit_id?: string
            value?: string
            varies?: boolean
            input_mode?: string
          }
          const unit_id = String(r.unit_id ?? '').trim()
          if (!unit_id) return null
          const input_mode =
            r.input_mode === 'number' || r.input_mode === 'time' || r.input_mode === 'text'
              ? r.input_mode
              : r.varies
                ? 'text'
                : null
          return {
            unit_id,
            value: String(r.value ?? '').trim(),
            input_mode,
            varies: Boolean(r.varies) || input_mode === 'text',
          }
        })
        .filter(Boolean) as ExercisePrescription[]
    } catch {
      return []
    }
  })
  return { exerciseIds, prescriptions }
}
