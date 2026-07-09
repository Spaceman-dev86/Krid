import type { EntityId } from './minimalDocument'

export type BlockExerciseUpdatePatch = {
  notes?: string | null
  exerciseName?: string | null
}

export type WeekUpdatePatch = {
  title?: string
  notes?: string | null
}

export type SessionUpdatePatch = {
  title?: string
  description?: string | null
}

export type BlockUpdatePatch = {
  title?: string | null
  notes?: string | null
}

export type ProgramExerciseUpdatePatch = {
  sets?: number | null
  reps?: number | null
  restTime?: string | null
  rpe?: number | null
  tempo?: string | null
  load?: string | null
  notes?: string | null
  subtitle?: string | null
}

export type ProgramUpdatePatch = {
  title?: string
  description?: string | null
  goal?: string | null
  level?: string | null
  duration?: string | null
}

export type BlockKind = 'warmup' | 'crossfit' | 'superset' | 'neutral'

export type MinimalCommand =
  | { type: 'week.add'; weekId: EntityId; title?: string }
  | { type: 'session.add'; weekId: EntityId; sessionId: EntityId; title?: string }
  | { type: 'session.delete'; sessionId: EntityId }
  | { type: 'session.update'; sessionId: EntityId; patch: SessionUpdatePatch }
  | { type: 'week.delete'; weekId: EntityId }
  | { type: 'week.duplicate'; sourceWeekId: EntityId; newWeekId: EntityId }
  | { type: 'week.reorder'; weekIds: EntityId[] }
  | { type: 'week.sessions.reorder'; weekId: EntityId; sessionIds: EntityId[] }
  | { type: 'week.update'; weekId: EntityId; patch: WeekUpdatePatch }
  | { type: 'session.duplicate'; sourceSessionId: EntityId; newSessionId: EntityId }
  | { type: 'block.update'; blockId: EntityId; patch: BlockUpdatePatch }
  | { type: 'program.update'; patch: ProgramUpdatePatch }
  | { type: 'timeline.reorder'; sessionId: EntityId; timelineItemIds: EntityId[] }
  | { type: 'blockExercise.reorder'; blockId: EntityId; blockExerciseIds: EntityId[] }
  | { type: 'blockExercise.update'; blockExerciseId: EntityId; patch: BlockExerciseUpdatePatch }
  | { type: 'programExercise.update'; programExerciseId: EntityId; patch: ProgramExerciseUpdatePatch }
  | {
      type: 'timeline.exercise.add'
      sessionId: EntityId
      timelineItemId: EntityId
      programExerciseId: EntityId
      libraryExerciseId: EntityId
      insertIndex?: number
    }
  | {
      type: 'timeline.block.add'
      sessionId: EntityId
      timelineItemId: EntityId
      blockId: EntityId
      blockKind?: BlockKind
      title?: string
      notes?: string | null
      insertIndex?: number
      initialBlockExercises?: Array<{
        blockExerciseId: EntityId
        libraryExerciseId: EntityId
      }>
    }
  | { type: 'timeline.item.delete'; timelineItemId: EntityId }
  | {
      type: 'timeline.exercise.duplicate'
      sourceTimelineItemId: EntityId
      newTimelineItemId: EntityId
      newProgramExerciseId: EntityId
    }
  | {
      type: 'timeline.block.duplicate'
      sourceTimelineItemId: EntityId
      newTimelineItemId: EntityId
      newBlockId: EntityId
    }
  | {
      type: 'blockExercise.add'
      blockId: EntityId
      blockExerciseId: EntityId
      libraryExerciseId: EntityId
      exerciseName?: string | null
    }
  | { type: 'blockExercise.delete'; blockExerciseId: EntityId }
