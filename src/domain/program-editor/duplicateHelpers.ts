import type {
  BlockExerciseNode,
  EntityId,
  MinimalProgramDocument,
  MinimalProgramEntities,
  ProgramExerciseNode,
  SessionBlockNode,
  SessionNode,
  TimelineItemNode,
  WeekNode,
} from './minimalDocument'
import { createTempId, type TempIdKind } from './tempIds'

export type IdGenerator = (prefix: string) => EntityId

export function defaultIdGenerator(prefix: string): EntityId {
  return createTempId(prefix as TempIdKind)
}

export function titleWithCopie(title: string | null | undefined, fallback: string): string {
  const base = String(title ?? '').trim() || fallback
  if (/\(copie\)\s*$/i.test(base)) return base
  return `${base} (copie)`
}

export type SessionDuplicateResult = {
  session: SessionNode
  timelineItems: Record<EntityId, TimelineItemNode>
  sessionBlocks: Record<EntityId, SessionBlockNode>
  blockExercises: Record<EntityId, BlockExerciseNode>
  programExercises: Record<EntityId, ProgramExerciseNode>
}

export function buildSessionDuplicate(
  doc: MinimalProgramDocument,
  sourceSessionId: EntityId,
  newSessionId: EntityId,
  targetWeekId: EntityId,
  idGen: IdGenerator = defaultIdGenerator,
  options?: { appendCopieToTitle?: boolean }
): SessionDuplicateResult {
  const appendCopieToTitle = options?.appendCopieToTitle ?? true
  const source = doc.entities.sessions[sourceSessionId]
  if (!source) {
    throw new Error(`Source session ${sourceSessionId} not found`)
  }

  const timelineItems: Record<EntityId, TimelineItemNode> = {}
  const sessionBlocks: Record<EntityId, SessionBlockNode> = {}
  const blockExercises: Record<EntityId, BlockExerciseNode> = {}
  const programExercises: Record<EntityId, ProgramExerciseNode> = {}
  const timelineItemIds: EntityId[] = []

  for (const oldItemId of source.timelineItemIds) {
    const oldItem = doc.entities.timelineItems[oldItemId]
    if (!oldItem) continue

    const newItemId = idGen('item')
    timelineItemIds.push(newItemId)

    if (oldItem.kind === 'block' && oldItem.sessionBlockId) {
      const oldBlock = doc.entities.sessionBlocks[oldItem.sessionBlockId]
      if (!oldBlock) continue

      const newBlockId = idGen('block')
      const newBeIds: EntityId[] = []

      for (const oldBeId of oldBlock.blockExerciseIds) {
        const oldBe = doc.entities.blockExercises[oldBeId]
        if (!oldBe) continue
        const newBeId = idGen('be')
        blockExercises[newBeId] = {
          id: newBeId,
          blockId: newBlockId,
          libraryExerciseId: oldBe.libraryExerciseId,
          exerciseName: oldBe.exerciseName,
          notes: oldBe.notes,
        }
        newBeIds.push(newBeId)
      }

      sessionBlocks[newBlockId] = {
        id: newBlockId,
        sessionId: newSessionId,
        blockKind: oldBlock.blockKind,
        title: oldBlock.title,
        notes: oldBlock.notes,
        blockExerciseIds: newBeIds,
      }

      timelineItems[newItemId] = {
        id: newItemId,
        sessionId: newSessionId,
        kind: 'block',
        programExerciseId: null,
        sessionBlockId: newBlockId,
      }
    } else if (oldItem.programExerciseId) {
      const oldPe = doc.entities.programExercises[oldItem.programExerciseId]
      const newPeId = idGen('pe')
      programExercises[newPeId] = oldPe
        ? { ...oldPe, id: newPeId }
        : {
            id: newPeId,
            libraryExerciseId: null,
            sets: null,
            reps: null,
            restTime: null,
            rpe: null,
            tempo: null,
            load: null,
            notes: null,
            subtitle: null,
          }
      timelineItems[newItemId] = {
        id: newItemId,
        sessionId: newSessionId,
        kind: 'exercise',
        programExerciseId: newPeId,
        sessionBlockId: null,
      }
    }
  }

  const sessionTitle = appendCopieToTitle
    ? titleWithCopie(source.title, 'Séance')
    : String(source.title ?? '').trim() || 'Séance'

  const session: SessionNode = {
    id: newSessionId,
    weekId: targetWeekId,
    title: sessionTitle,
    description: source.description,
    timelineItemIds,
  }

  return { session, timelineItems, sessionBlocks, blockExercises, programExercises }
}

export function mergeSessionDuplicateIntoEntities(
  entities: MinimalProgramEntities,
  duplicate: SessionDuplicateResult
): void {
  entities.sessions[duplicate.session.id] = duplicate.session
  Object.assign(entities.timelineItems, duplicate.timelineItems)
  Object.assign(entities.sessionBlocks, duplicate.sessionBlocks)
  Object.assign(entities.blockExercises, duplicate.blockExercises)
  Object.assign(entities.programExercises, duplicate.programExercises)
}

export function insertSessionIdAfter(
  sessionIds: EntityId[],
  sourceSessionId: EntityId,
  newSessionId: EntityId
): EntityId[] {
  const idx = sessionIds.indexOf(sourceSessionId)
  if (idx < 0) return [...sessionIds, newSessionId]
  const next = [...sessionIds]
  next.splice(idx + 1, 0, newSessionId)
  return next
}

export function buildWeekDuplicate(
  doc: MinimalProgramDocument,
  sourceWeekId: EntityId,
  newWeekId: EntityId,
  idGen: IdGenerator = defaultIdGenerator
): { week: WeekNode; entities: SessionDuplicateResult[] } {
  const sourceWeek = doc.weeks.find((w) => w.id === sourceWeekId)
  if (!sourceWeek) {
    throw new Error(`Source week ${sourceWeekId} not found`)
  }

  const sessionDuplicates: SessionDuplicateResult[] = []
  const newSessionIds: EntityId[] = []

  for (const sourceSessionId of sourceWeek.sessionIds) {
    const newSessionId = idGen('session')
    const dup = buildSessionDuplicate(doc, sourceSessionId, newSessionId, newWeekId, idGen, {
      appendCopieToTitle: false,
    })
    sessionDuplicates.push(dup)
    newSessionIds.push(newSessionId)
  }

  const week: WeekNode = {
    id: newWeekId,
    title: titleWithCopie(sourceWeek.title, 'Semaine'),
    notes: sourceWeek.notes,
    sessionIds: newSessionIds,
  }

  return { week, entities: sessionDuplicates }
}
