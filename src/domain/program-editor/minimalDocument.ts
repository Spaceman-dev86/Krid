import type { BlockKind } from './minimalCommands'

export type EntityId = string

export type TimelineItemKind = 'exercise' | 'block'

export type WeekNode = {
  id: EntityId
  title: string
  notes: string | null
  sessionIds: EntityId[]
}

export type SessionNode = {
  id: EntityId
  weekId: EntityId
  title: string
  description: string | null
  timelineItemIds: EntityId[]
}

export type TimelineItemNode = {
  id: EntityId
  sessionId: EntityId
  kind: TimelineItemKind
  programExerciseId: EntityId | null
  sessionBlockId: EntityId | null
}

export type SessionBlockNode = {
  id: EntityId
  sessionId: EntityId
  /** Palette kind (warmup, crossfit, …); restored from DB `type` on load. */
  blockKind: BlockKind | null
  title: string | null
  notes: string | null
  blockExerciseIds: EntityId[]
}

export type BlockExerciseNode = {
  id: EntityId
  blockId: EntityId
  libraryExerciseId: EntityId | null
  exerciseName: string | null
  notes: string | null
}

export type ProgramExerciseNode = {
  id: EntityId
  libraryExerciseId: EntityId | null
  sets: number | null
  reps: number | null
  restTime: string | null
  rpe: number | null
  tempo: string | null
  load: string | null
  notes: string | null
  subtitle: string | null
}

export type MinimalProgramEntities = {
  sessions: Record<EntityId, SessionNode>
  timelineItems: Record<EntityId, TimelineItemNode>
  sessionBlocks: Record<EntityId, SessionBlockNode>
  blockExercises: Record<EntityId, BlockExerciseNode>
  programExercises: Record<EntityId, ProgramExerciseNode>
}

export type ProgramMetaNode = {
  title: string
  description: string | null
  goal: string | null
  level: string | null
  duration: string | null
  isPublished: boolean
  imageUrl: string | null
}

export type MinimalProgramDocument = {
  programId: EntityId
  program: ProgramMetaNode
  weeks: WeekNode[]
  entities: MinimalProgramEntities
}
