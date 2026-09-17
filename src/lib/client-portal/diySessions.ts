import { randomUUID } from 'crypto'

import type {
  SessionRunSnapshot,
  SnapshotExercise,
  SnapshotItem,
} from './sessionRuns'
import { emptyRealized } from './sessionRuns'

export type DiyExerciseInput = {
  exerciseId: string | null
  name: string
  sets?: string | null
  reps?: string | null
  restTime?: string | null
  load?: string | null
  notes?: string | null
  demoMediaUrl?: string | null
}

export function buildDiySnapshot(
  title: string,
  exercises: DiyExerciseInput[],
  sessionKey?: string
): SessionRunSnapshot {
  const items: SnapshotItem[] = exercises.map((ex) => {
    const item: SnapshotExercise = {
      id: randomUUID(),
      kind: 'exercise',
      name: ex.name.trim() || 'Exercice',
      exercise_id: ex.exerciseId,
      sets: ex.sets?.trim() || null,
      reps: ex.reps?.trim() || null,
      rest_time: ex.restTime?.trim() || null,
      rpe: null,
      load: ex.load?.trim() || null,
      tempo: null,
      notes: ex.notes?.trim() || null,
      demo_media_url: ex.demoMediaUrl ?? null,
    }
    return item
  })

  return {
    version: 1,
    session_id: sessionKey || randomUUID(),
    title: title.trim() || 'Séance libre',
    items,
  }
}

export function diyEmptyRealized(snapshot: SessionRunSnapshot) {
  return emptyRealized(snapshot)
}

/** Finish style for libre runs: clean → libre · écarts → fait_edite · rien → pas_fait */
export function resolveLibreFinishStyle(
  styleFromRealized: 'fait' | 'fait_edite' | 'pas_fait'
): 'libre' | 'fait_edite' | 'pas_fait' {
  if (styleFromRealized === 'pas_fait') return 'pas_fait'
  if (styleFromRealized === 'fait') return 'libre'
  return 'fait_edite'
}
