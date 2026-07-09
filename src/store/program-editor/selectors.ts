import type {
  BlockExerciseNode,
  MinimalProgramDocument,
  SessionNode,
  TimelineItemNode,
} from '../../domain/program-editor'

export function selectSessions(doc: MinimalProgramDocument): SessionNode[] {
  const sessions: SessionNode[] = []
  for (const week of doc.weeks) {
    for (const sessionId of week.sessionIds) {
      const session = doc.entities.sessions[sessionId]
      if (session) sessions.push(session)
    }
  }
  return sessions
}

export function selectTimelineBySession(doc: MinimalProgramDocument, sessionId: string): TimelineItemNode[] {
  const session = doc.entities.sessions[sessionId]
  if (!session) return []

  const items: TimelineItemNode[] = []
  for (const itemId of session.timelineItemIds) {
    const item = doc.entities.timelineItems[itemId]
    if (item) items.push(item)
  }
  return items
}

export function selectBlockExercises(doc: MinimalProgramDocument): BlockExerciseNode[] {
  return Object.values(doc.entities.blockExercises)
}

export function selectBlockExercisesForBlock(
  doc: MinimalProgramDocument,
  blockId: string
): BlockExerciseNode[] {
  const block = doc.entities.sessionBlocks[blockId]
  if (!block) return []

  const exercises: BlockExerciseNode[] = []
  for (const exerciseId of block.blockExerciseIds) {
    const exercise = doc.entities.blockExercises[exerciseId]
    if (exercise) exercises.push(exercise)
  }
  return exercises
}
