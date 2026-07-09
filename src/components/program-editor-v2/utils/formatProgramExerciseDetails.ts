import type { ProgramExerciseNode } from '../../../domain/program-editor'

function formatLoad(load: string | null): string | null {
  if (!load?.trim()) return null
  const raw = load.trim()
  if (/kg$/i.test(raw)) return raw
  return `${raw} Kg`
}

export function formatProgramExerciseDetails(pe: ProgramExerciseNode): string {
  return [
    pe.sets != null ? `${pe.sets} séries` : null,
    pe.reps != null ? `${pe.reps} reps` : null,
    pe.restTime ? `repos ${pe.restTime}` : null,
    pe.rpe != null ? `RPE ${pe.rpe}` : null,
    pe.tempo ? `tempo ${pe.tempo}` : null,
    formatLoad(pe.load),
  ]
    .filter(Boolean)
    .join(' · ')
}

export function hasProgramExerciseDetails(pe: ProgramExerciseNode): boolean {
  return Boolean(formatProgramExerciseDetails(pe) || pe.notes?.trim())
}
