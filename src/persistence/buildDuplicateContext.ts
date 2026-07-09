import type {
  BlockExerciseNode,
  MinimalCommand,
  MinimalProgramDocument,
  ProgramExerciseNode,
  SessionBlockNode,
  SessionNode,
  TimelineItemNode,
  WeekNode,
} from '../domain/program-editor'
import type { CommandAppliedListener } from '../store/program-editor/documentStore'

export type SessionDuplicateSnapshot = {
  session: SessionNode
  timelineItems: TimelineItemNode[]
  programExercises: ProgramExerciseNode[]
  sessionBlocks: SessionBlockNode[]
  blockExercises: BlockExerciseNode[]
}

export type WeekDuplicateSnapshot = {
  week: WeekNode
  sessions: SessionDuplicateSnapshot[]
}

export type BlockDuplicateSnapshot = {
  timelineItem: TimelineItemNode
  block: SessionBlockNode
  blockExercises: BlockExerciseNode[]
}

export type DuplicateContext =
  | { kind: 'session.duplicate'; snapshot: SessionDuplicateSnapshot }
  | { kind: 'week.duplicate'; snapshot: WeekDuplicateSnapshot }
  | { kind: 'timeline.block.duplicate'; snapshot: BlockDuplicateSnapshot }

function collectSessionSnapshot(
  doc: MinimalProgramDocument,
  sessionId: string
): SessionDuplicateSnapshot | null {
  const session = doc.entities.sessions[sessionId]
  if (!session) return null

  const timelineItems: TimelineItemNode[] = []
  const programExercises: ProgramExerciseNode[] = []
  const sessionBlocks: SessionBlockNode[] = []
  const blockExercises: BlockExerciseNode[] = []
  const peSeen = new Set<string>()
  const blockSeen = new Set<string>()
  const beSeen = new Set<string>()

  for (const itemId of session.timelineItemIds) {
    const item = doc.entities.timelineItems[itemId]
    if (!item) continue
    timelineItems.push(item)

    if (item.programExerciseId && !peSeen.has(item.programExerciseId)) {
      peSeen.add(item.programExerciseId)
      const pe = doc.entities.programExercises[item.programExerciseId]
      if (pe) programExercises.push(pe)
    }

    if (item.sessionBlockId && !blockSeen.has(item.sessionBlockId)) {
      blockSeen.add(item.sessionBlockId)
      const block = doc.entities.sessionBlocks[item.sessionBlockId]
      if (block) {
        sessionBlocks.push(block)
        for (const beId of block.blockExerciseIds) {
          if (beSeen.has(beId)) continue
          beSeen.add(beId)
          const be = doc.entities.blockExercises[beId]
          if (be) blockExercises.push(be)
        }
      }
    }
  }

  return { session, timelineItems, programExercises, sessionBlocks, blockExercises }
}

export function buildDuplicateContext(
  event: Parameters<CommandAppliedListener>[0]
): DuplicateContext | null {
  const { command, next } = event

  if (command.type === 'session.duplicate') {
    const snapshot = collectSessionSnapshot(next, command.newSessionId)
    return snapshot ? { kind: 'session.duplicate', snapshot } : null
  }

  if (command.type === 'week.duplicate') {
    const week = next.weeks.find((w) => w.id === command.newWeekId)
    if (!week) return null
    const sessions: SessionDuplicateSnapshot[] = []
    for (const sessionId of week.sessionIds) {
      const snap = collectSessionSnapshot(next, sessionId)
      if (snap) sessions.push(snap)
    }
    return { kind: 'week.duplicate', snapshot: { week, sessions } }
  }

  if (command.type === 'timeline.block.duplicate') {
    const block = next.entities.sessionBlocks[command.newBlockId]
    const timelineItem = next.entities.timelineItems[command.newTimelineItemId]
    if (!block || !timelineItem) return null
    const blockExercises = block.blockExerciseIds
      .map((id) => next.entities.blockExercises[id])
      .filter((be): be is BlockExerciseNode => Boolean(be))
    return {
      kind: 'timeline.block.duplicate',
      snapshot: { timelineItem, block, blockExercises },
    }
  }

  return null
}
