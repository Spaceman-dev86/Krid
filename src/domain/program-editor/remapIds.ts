import type { MinimalCommand } from './minimalCommands'
import type {
  BlockExerciseNode,
  EntityId,
  MinimalProgramDocument,
  ProgramExerciseNode,
  SessionBlockNode,
  SessionNode,
  TimelineItemNode,
  WeekNode,
} from './minimalDocument'

export type IdRemap = Record<EntityId, EntityId>

function mapId(id: EntityId, remap: IdRemap): EntityId {
  return remap[id] ?? id
}

function mapIds(ids: EntityId[], remap: IdRemap): EntityId[] {
  return ids.map((id) => mapId(id, remap))
}

/** Remap temp client ids in a queued persistence command after a prior batch synced. */
export function remapMinimalCommandIds(cmd: MinimalCommand, remap: IdRemap): MinimalCommand {
  if (Object.keys(remap).length === 0) return cmd

  switch (cmd.type) {
    case 'week.add':
      return { ...cmd, weekId: mapId(cmd.weekId, remap) }
    case 'session.add':
      return { ...cmd, weekId: mapId(cmd.weekId, remap), sessionId: mapId(cmd.sessionId, remap) }
    case 'session.delete':
      return { ...cmd, sessionId: mapId(cmd.sessionId, remap) }
    case 'session.update':
      return { ...cmd, sessionId: mapId(cmd.sessionId, remap) }
    case 'week.delete':
      return { ...cmd, weekId: mapId(cmd.weekId, remap) }
    case 'week.duplicate':
      return {
        ...cmd,
        sourceWeekId: mapId(cmd.sourceWeekId, remap),
        newWeekId: mapId(cmd.newWeekId, remap),
      }
    case 'week.reorder':
      return { ...cmd, weekIds: mapIds(cmd.weekIds, remap) }
    case 'week.sessions.reorder':
      return { ...cmd, weekId: mapId(cmd.weekId, remap), sessionIds: mapIds(cmd.sessionIds, remap) }
    case 'week.update':
      return { ...cmd, weekId: mapId(cmd.weekId, remap) }
    case 'session.duplicate':
      return {
        ...cmd,
        sourceSessionId: mapId(cmd.sourceSessionId, remap),
        newSessionId: mapId(cmd.newSessionId, remap),
      }
    case 'block.update':
      return { ...cmd, blockId: mapId(cmd.blockId, remap) }
    case 'timeline.reorder':
      return {
        ...cmd,
        sessionId: mapId(cmd.sessionId, remap),
        timelineItemIds: mapIds(cmd.timelineItemIds, remap),
      }
    case 'blockExercise.reorder':
      return { ...cmd, blockId: mapId(cmd.blockId, remap), blockExerciseIds: mapIds(cmd.blockExerciseIds, remap) }
    case 'blockExercise.update':
      return { ...cmd, blockExerciseId: mapId(cmd.blockExerciseId, remap) }
    case 'programExercise.update':
      return { ...cmd, programExerciseId: mapId(cmd.programExerciseId, remap) }
    case 'timeline.exercise.add':
      return {
        ...cmd,
        sessionId: mapId(cmd.sessionId, remap),
        timelineItemId: mapId(cmd.timelineItemId, remap),
        programExerciseId: mapId(cmd.programExerciseId, remap),
      }
    case 'timeline.block.add':
      return {
        ...cmd,
        sessionId: mapId(cmd.sessionId, remap),
        timelineItemId: mapId(cmd.timelineItemId, remap),
        blockId: mapId(cmd.blockId, remap),
        initialBlockExercises: cmd.initialBlockExercises?.map((row) => ({
          ...row,
          blockExerciseId: mapId(row.blockExerciseId, remap),
        })),
      }
    case 'timeline.item.delete':
      return { ...cmd, timelineItemId: mapId(cmd.timelineItemId, remap) }
    case 'timeline.exercise.duplicate':
      return {
        ...cmd,
        sourceTimelineItemId: mapId(cmd.sourceTimelineItemId, remap),
        newTimelineItemId: mapId(cmd.newTimelineItemId, remap),
        newProgramExerciseId: mapId(cmd.newProgramExerciseId, remap),
      }
    case 'timeline.block.duplicate':
      return {
        ...cmd,
        sourceTimelineItemId: mapId(cmd.sourceTimelineItemId, remap),
        newTimelineItemId: mapId(cmd.newTimelineItemId, remap),
        newBlockId: mapId(cmd.newBlockId, remap),
      }
    case 'blockExercise.add':
      return {
        ...cmd,
        blockId: mapId(cmd.blockId, remap),
        blockExerciseId: mapId(cmd.blockExerciseId, remap),
      }
    case 'blockExercise.delete':
      return { ...cmd, blockExerciseId: mapId(cmd.blockExerciseId, remap) }
    case 'program.update':
      return cmd
    default: {
      const _exhaustive: never = cmd
      return _exhaustive
    }
  }
}

function remapRecord<T extends { id: EntityId }>(
  record: Record<EntityId, T>,
  remap: IdRemap,
  mapNode: (node: T) => T
): Record<EntityId, T> {
  const out: Record<EntityId, T> = {}
  for (const [id, node] of Object.entries(record)) {
    const next = mapNode(node)
    out[mapId(id, remap)] = next
  }
  return out
}

export function remapMinimalDocumentIds(doc: MinimalProgramDocument, remap: IdRemap): MinimalProgramDocument {
  const weeks: WeekNode[] = doc.weeks.map((w) => ({
    ...w,
    id: mapId(w.id, remap),
    sessionIds: w.sessionIds.map((sid) => mapId(sid, remap)),
  }))

  const sessions = remapRecord<SessionNode>(doc.entities.sessions, remap, (s) => ({
    ...s,
    id: mapId(s.id, remap),
    weekId: mapId(s.weekId, remap),
    timelineItemIds: s.timelineItemIds.map((tid) => mapId(tid, remap)),
  }))

  const timelineItems = remapRecord<TimelineItemNode>(doc.entities.timelineItems, remap, (it) => ({
    ...it,
    id: mapId(it.id, remap),
    sessionId: mapId(it.sessionId, remap),
    programExerciseId: it.programExerciseId ? mapId(it.programExerciseId, remap) : null,
    sessionBlockId: it.sessionBlockId ? mapId(it.sessionBlockId, remap) : null,
  }))

  const sessionBlocks = remapRecord<SessionBlockNode>(doc.entities.sessionBlocks, remap, (b) => ({
    ...b,
    id: mapId(b.id, remap),
    sessionId: mapId(b.sessionId, remap),
    blockKind: b.blockKind,
    blockExerciseIds: b.blockExerciseIds.map((beid) => mapId(beid, remap)),
  }))

  const blockExercises = remapRecord<BlockExerciseNode>(doc.entities.blockExercises, remap, (be) => ({
    ...be,
    id: mapId(be.id, remap),
    blockId: mapId(be.blockId, remap),
  }))

  const programExercises = remapRecord<ProgramExerciseNode>(doc.entities.programExercises, remap, (pe) => ({
    ...pe,
    id: mapId(pe.id, remap),
  }))

  return {
    ...doc,
    weeks,
    entities: {
      ...doc.entities,
      sessions,
      timelineItems,
      sessionBlocks,
      blockExercises,
      programExercises,
    },
  }
}

