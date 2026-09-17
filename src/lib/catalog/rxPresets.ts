/**
 * Presets Rx catalogue — une seule source pour séances / blocs.
 *
 * Les clés pointent vers `public.units.key` (coach_id null).
 * Le rendu UI vient de `value_mode` + `list_options` + `short_label`
 * (`prescriptionUi.ts`, `unitShortLabel`).
 */

/** Rx par défaut sur un exo dans un **bloc** catalogue. */
export const BLOCK_EXERCISE_RX_KEYS = ['reps', 'load_kg', 'cal'] as const

export type BlockExerciseRxKey = (typeof BLOCK_EXERCISE_RX_KEYS)[number]

/** Rx par défaut sur un exo dans une **séance** catalogue. */
export const SESSION_EXERCISE_RX_KEYS = [
  'sets',
  'reps',
  'load_kg',
  'rpe',
  'rest_s',
  'tempo',
] as const

export type SessionExerciseRxKey = (typeof SESSION_EXERCISE_RX_KEYS)[number]

/** Fallback short labels si `units.short_label` absente (pré-mig 52). */
export const UNIT_SHORT_FALLBACK: Record<string, string> = {
  sets: 'Séries',
  reps: 'Reps',
  load_kg: 'Kg',
  rpe: 'RPE',
  rest_s: 'Repos',
  tempo: 'Tempo',
  cal: 'Cal',
  rounds: 'Rounds',
  time_s: 'Temps',
  time_min: 'Min',
  distance_m: 'm',
  completed: 'OK',
  variable: 'Var',
  note: 'Note',
}

/** @deprecated use UNIT_SHORT_FALLBACK + unit.short_label */
export const SESSION_EXERCISE_RX_SHORT: Record<SessionExerciseRxKey, string> = {
  sets: 'Séries',
  reps: 'Reps',
  load_kg: 'Kg',
  rpe: 'RPE',
  rest_s: 'Repos',
  tempo: 'Tempo',
}

export function unitShortLabel(unit: {
  key?: string | null
  label?: string | null
  short_label?: string | null
} | null | undefined): string {
  if (!unit) return '—'
  const short = String(unit.short_label ?? '').trim()
  if (short) return short
  const key = String(unit.key ?? '').trim()
  if (key && UNIT_SHORT_FALLBACK[key]) return UNIT_SHORT_FALLBACK[key]
  const label = String(unit.label ?? '').trim()
  if (label) return label.split(/\s+/)[0]?.slice(0, 12) || label
  return key || '—'
}
