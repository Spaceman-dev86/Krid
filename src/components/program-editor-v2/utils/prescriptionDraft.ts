import type { ProgramExerciseNode, ProgramExerciseUpdatePatch } from '../../../domain/program-editor'
import { parseOptionalInt } from './prescriptionHelpers'

export type PrescriptionDraft = {
  sets: string
  reps: string
  restTime: string
  rpe: string
  tempo: string
  load: string
  notes: string
}

export function programExerciseToDraft(pe: ProgramExerciseNode): PrescriptionDraft {
  return {
    sets: pe.sets != null ? String(pe.sets) : '',
    reps: pe.reps != null ? String(pe.reps) : '',
    restTime: pe.restTime ?? '',
    rpe: pe.rpe != null ? String(pe.rpe) : '',
    tempo: pe.tempo ?? '',
    load: pe.load ?? '',
    notes: pe.notes ?? '',
  }
}

export function draftToProgramExercisePatch(
  draft: PrescriptionDraft,
  committed: ProgramExerciseNode
): ProgramExerciseUpdatePatch | null {
  const patch: ProgramExerciseUpdatePatch = {}

  const sets = parseOptionalInt(draft.sets)
  if (sets !== committed.sets) patch.sets = sets

  const reps = parseOptionalInt(draft.reps)
  if (reps !== committed.reps) patch.reps = reps

  const restTime = draft.restTime.trim() || null
  if (restTime !== committed.restTime) patch.restTime = restTime

  const rpe = parseOptionalInt(draft.rpe)
  if (rpe !== committed.rpe) patch.rpe = rpe

  const tempo = draft.tempo.trim() || null
  if (tempo !== committed.tempo) patch.tempo = tempo

  const load = draft.load.trim() || null
  if (load !== committed.load) patch.load = load

  const notes = draft.notes || null
  if (notes !== committed.notes) patch.notes = notes

  return Object.keys(patch).length > 0 ? patch : null
}
