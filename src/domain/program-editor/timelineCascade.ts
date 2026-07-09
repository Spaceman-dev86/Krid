import type { EntityId, MinimalProgramEntities, TimelineItemNode } from './minimalDocument'

export type TimelineItemCascade = {
  timelineItemIds: EntityId[]
  blockIds: EntityId[]
  blockExerciseIds: EntityId[]
  programExerciseIds: EntityId[]
}

export function collectTimelineItemCascade(
  entities: MinimalProgramEntities,
  timelineItemId: EntityId
): TimelineItemCascade {
  const empty: TimelineItemCascade = {
    timelineItemIds: [],
    blockIds: [],
    blockExerciseIds: [],
    programExerciseIds: [],
  }

  const item = entities.timelineItems[timelineItemId]
  if (!item) return empty

  const timelineItemIds = [timelineItemId]
  const blockIds: EntityId[] = []
  const blockExerciseIds: EntityId[] = []
  const programExerciseIds: EntityId[] = []

  if (item.kind === 'exercise' && item.programExerciseId) {
    programExerciseIds.push(item.programExerciseId)
  } else if (item.kind === 'block' && item.sessionBlockId) {
    blockIds.push(item.sessionBlockId)
    const block = entities.sessionBlocks[item.sessionBlockId]
    if (block) blockExerciseIds.push(...block.blockExerciseIds)
  }

  return { timelineItemIds, blockIds, blockExerciseIds, programExerciseIds }
}

export function collectSessionCascadeIds(
  entities: MinimalProgramEntities,
  sessionId: EntityId
): TimelineItemCascade {
  const session = entities.sessions[sessionId]
  if (!session) {
    return { timelineItemIds: [], blockIds: [], blockExerciseIds: [], programExerciseIds: [] }
  }

  const merged: TimelineItemCascade = {
    timelineItemIds: [],
    blockIds: [],
    blockExerciseIds: [],
    programExerciseIds: [],
  }

  for (const itemId of session.timelineItemIds) {
    const part = collectTimelineItemCascade(entities, itemId)
    merged.timelineItemIds.push(...part.timelineItemIds)
    merged.blockIds.push(...part.blockIds)
    merged.blockExerciseIds.push(...part.blockExerciseIds)
    merged.programExerciseIds.push(...part.programExerciseIds)
  }

  return merged
}

export function countProgramExerciseReferences(
  entities: MinimalProgramEntities,
  programExerciseId: EntityId,
  excludingTimelineItemId?: EntityId
): number {
  let count = 0
  for (const item of Object.values(entities.timelineItems) as TimelineItemNode[]) {
    if (excludingTimelineItemId && item.id === excludingTimelineItemId) continue
    if (item.kind === 'exercise' && item.programExerciseId === programExerciseId) count += 1
  }
  return count
}
