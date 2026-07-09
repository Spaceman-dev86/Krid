import {
  buildSessionDuplicate,
  buildWeekDuplicate,
  insertSessionIdAfter,
  mergeSessionDuplicateIntoEntities,
} from './duplicateHelpers'
import { DomainError } from './errors'
import type { MinimalCommand } from './minimalCommands'
import type {
  BlockExerciseNode,
  MinimalProgramDocument,
  MinimalProgramEntities,
  ProgramExerciseNode,
  SessionNode,
  WeekNode,
} from './minimalDocument'
import {
  applyBlockExerciseAdd,
  applyBlockExerciseDelete,
  applyTimelineBlockAdd,
  applyTimelineBlockDuplicate,
  applyTimelineExerciseAdd,
  applyTimelineExerciseDuplicate,
  applyTimelineItemDelete,
} from './timelineCommands'
import { collectSessionCascadeIds } from './timelineCascade'
import { assertValidMinimalDocument } from './validators'

function cloneDocument(doc: MinimalProgramDocument): MinimalProgramDocument {
  return {
    programId: doc.programId,
    program: { ...doc.program },
    weeks: doc.weeks.map((w) => ({ ...w, sessionIds: [...w.sessionIds] })),
    entities: {
      sessions: { ...doc.entities.sessions },
      timelineItems: { ...doc.entities.timelineItems },
      sessionBlocks: { ...doc.entities.sessionBlocks },
      blockExercises: { ...doc.entities.blockExercises },
      programExercises: { ...doc.entities.programExercises },
    },
  }
}

function applyWeekAdd(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'week.add' }>
): MinimalProgramDocument {
  if (doc.weeks.some((w) => w.id === cmd.weekId)) {
    throw new DomainError('week.already_exists', `Week ${cmd.weekId} already exists`)
  }

  const next = cloneDocument(doc)
  const week: WeekNode = {
    id: cmd.weekId,
    title: cmd.title?.trim() || 'Semaine',
    notes: null,
    sessionIds: [],
  }
  next.weeks = [...next.weeks, week]
  return next
}

function applySessionAdd(doc: MinimalProgramDocument, cmd: Extract<MinimalCommand, { type: 'session.add' }>): MinimalProgramDocument {
  const weekIndex = doc.weeks.findIndex((w) => w.id === cmd.weekId)
  if (weekIndex < 0) {
    throw new DomainError('week.not_found', `Week ${cmd.weekId} not found`)
  }
  if (doc.entities.sessions[cmd.sessionId]) {
    throw new DomainError('session.already_exists', `Session ${cmd.sessionId} already exists`)
  }

  const next = cloneDocument(doc)
  const session: SessionNode = {
    id: cmd.sessionId,
    weekId: cmd.weekId,
    title: cmd.title?.trim() || 'Séance',
    description: null,
    timelineItemIds: [],
  }

  next.entities.sessions[cmd.sessionId] = session
  next.weeks[weekIndex] = {
    ...next.weeks[weekIndex],
    sessionIds: [...next.weeks[weekIndex].sessionIds, cmd.sessionId],
  }

  return next
}

function omitKeys<T extends Record<string, unknown>>(record: T, keys: string[]): T {
  const next = { ...record }
  for (const key of keys) {
    delete next[key]
  }
  return next
}

function applySessionDelete(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'session.delete' }>
): MinimalProgramDocument {
  const session = doc.entities.sessions[cmd.sessionId]
  if (!session) {
    throw new DomainError('session.not_found', `Session ${cmd.sessionId} not found`)
  }

  const { timelineItemIds, blockIds, blockExerciseIds, programExerciseIds } = collectSessionCascadeIds(
    doc.entities,
    cmd.sessionId
  )
  const next = cloneDocument(doc)

  next.weeks = next.weeks.map((week) =>
    week.id === session.weekId
      ? { ...week, sessionIds: week.sessionIds.filter((id) => id !== cmd.sessionId) }
      : week
  )

  next.entities.sessions = omitKeys(next.entities.sessions, [cmd.sessionId])
  next.entities.timelineItems = omitKeys(next.entities.timelineItems, timelineItemIds)
  next.entities.sessionBlocks = omitKeys(next.entities.sessionBlocks, blockIds)
  next.entities.blockExercises = omitKeys(next.entities.blockExercises, blockExerciseIds)
  next.entities.programExercises = omitKeys(next.entities.programExercises, programExerciseIds)

  return next
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  if (setA.size !== a.length) return false
  for (const id of b) {
    if (!setA.has(id)) return false
  }
  return true
}

function applyTimelineReorder(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'timeline.reorder' }>
): MinimalProgramDocument {
  const session = doc.entities.sessions[cmd.sessionId]
  if (!session) {
    throw new DomainError('session.not_found', `Session ${cmd.sessionId} not found`)
  }

  if (!sameIdSet(session.timelineItemIds, cmd.timelineItemIds)) {
    throw new DomainError(
      'timeline.reorder_mismatch',
      `timelineItemIds must be a permutation of the current session timeline (${session.id})`
    )
  }

  if (new Set(cmd.timelineItemIds).size !== cmd.timelineItemIds.length) {
    throw new DomainError('timeline.duplicate_ids', 'timelineItemIds must not contain duplicates')
  }

  const next = cloneDocument(doc)
  next.entities.sessions[cmd.sessionId] = {
    ...session,
    timelineItemIds: [...cmd.timelineItemIds],
  }

  return next
}

function applySessionUpdate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'session.update' }>
): MinimalProgramDocument {
  const session = doc.entities.sessions[cmd.sessionId]
  if (!session) {
    throw new DomainError('session.not_found', `Session ${cmd.sessionId} not found`)
  }

  const next = cloneDocument(doc)
  const updated: SessionNode = { ...session }

  if ('title' in cmd.patch) {
    const title = String(cmd.patch.title ?? '').trim()
    if (!title) throw new DomainError('session.empty_title', 'Session title cannot be empty')
    updated.title = title
  }
  if ('description' in cmd.patch) {
    updated.description = cmd.patch.description ?? null
  }

  next.entities.sessions[cmd.sessionId] = updated
  return next
}

function applyWeekUpdate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'week.update' }>
): MinimalProgramDocument {
  const weekIndex = doc.weeks.findIndex((w) => w.id === cmd.weekId)
  if (weekIndex < 0) {
    throw new DomainError('week.not_found', `Week ${cmd.weekId} not found`)
  }

  const week = doc.weeks[weekIndex]
  const next = cloneDocument(doc)
  const updated = { ...week }

  if ('title' in cmd.patch) {
    const title = String(cmd.patch.title ?? '').trim()
    if (!title) throw new DomainError('week.empty_title', 'Week title cannot be empty')
    updated.title = title
  }
  if ('notes' in cmd.patch) {
    updated.notes = cmd.patch.notes ?? null
  }

  next.weeks = [...next.weeks]
  next.weeks[weekIndex] = updated
  return next
}

function applyBlockUpdate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'block.update' }>
): MinimalProgramDocument {
  const block = doc.entities.sessionBlocks[cmd.blockId]
  if (!block) {
    throw new DomainError('block.not_found', `Block ${cmd.blockId} not found`)
  }

  const next = cloneDocument(doc)
  const updated = { ...block }

  if ('title' in cmd.patch) {
    updated.title = cmd.patch.title ?? null
  }
  if ('notes' in cmd.patch) {
    updated.notes = cmd.patch.notes ?? null
  }

  next.entities.sessionBlocks[cmd.blockId] = updated
  return next
}

function applyProgramUpdate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'program.update' }>
): MinimalProgramDocument {
  const next = cloneDocument(doc)
  const updated = { ...doc.program }

  if ('title' in cmd.patch) {
    const title = String(cmd.patch.title ?? '').trim()
    if (!title) throw new DomainError('program.empty_title', 'Program title cannot be empty')
    updated.title = title
  }
  if ('description' in cmd.patch) updated.description = cmd.patch.description ?? null
  if ('goal' in cmd.patch) updated.goal = cmd.patch.goal ?? null
  if ('level' in cmd.patch) updated.level = cmd.patch.level ?? null
  if ('duration' in cmd.patch) updated.duration = cmd.patch.duration ?? null

  next.program = updated
  return next
}

function applyWeekDelete(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'week.delete' }>
): MinimalProgramDocument {
  const week = doc.weeks.find((w) => w.id === cmd.weekId)
  if (!week) {
    throw new DomainError('week.not_found', `Week ${cmd.weekId} not found`)
  }

  let next = doc
  for (const sessionId of [...week.sessionIds]) {
    next = applySessionDelete(next, { type: 'session.delete', sessionId })
  }

  const cloned = cloneDocument(next)
  cloned.weeks = cloned.weeks.filter((w) => w.id !== cmd.weekId)
  return cloned
}

function applyBlockExerciseReorder(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'blockExercise.reorder' }>
): MinimalProgramDocument {
  const block = doc.entities.sessionBlocks[cmd.blockId]
  if (!block) {
    throw new DomainError('block.not_found', `Block ${cmd.blockId} not found`)
  }

  if (!sameIdSet(block.blockExerciseIds, cmd.blockExerciseIds)) {
    throw new DomainError(
      'block_exercise.reorder_mismatch',
      `blockExerciseIds must be a permutation of the current block exercises (${block.id})`
    )
  }

  if (new Set(cmd.blockExerciseIds).size !== cmd.blockExerciseIds.length) {
    throw new DomainError('block_exercise.duplicate_ids', 'blockExerciseIds must not contain duplicates')
  }

  const next = cloneDocument(doc)
  next.entities.sessionBlocks[cmd.blockId] = {
    ...block,
    blockExerciseIds: [...cmd.blockExerciseIds],
  }
  return next
}

function applySessionDuplicate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'session.duplicate' }>
): MinimalProgramDocument {
  const source = doc.entities.sessions[cmd.sourceSessionId]
  if (!source) {
    throw new DomainError('session.not_found', `Session ${cmd.sourceSessionId} not found`)
  }
  if (doc.entities.sessions[cmd.newSessionId]) {
    throw new DomainError('session.already_exists', `Session ${cmd.newSessionId} already exists`)
  }

  const duplicate = buildSessionDuplicate(doc, cmd.sourceSessionId, cmd.newSessionId, source.weekId)
  const next = cloneDocument(doc)
  mergeSessionDuplicateIntoEntities(next.entities, duplicate)

  const weekIndex = next.weeks.findIndex((w) => w.id === source.weekId)
  if (weekIndex < 0) {
    throw new DomainError('week.not_found', `Week ${source.weekId} not found`)
  }

  next.weeks[weekIndex] = {
    ...next.weeks[weekIndex],
    sessionIds: insertSessionIdAfter(next.weeks[weekIndex].sessionIds, cmd.sourceSessionId, cmd.newSessionId),
  }

  return next
}

function applyWeekDuplicate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'week.duplicate' }>
): MinimalProgramDocument {
  if (doc.weeks.some((w) => w.id === cmd.newWeekId)) {
    throw new DomainError('week.already_exists', `Week ${cmd.newWeekId} already exists`)
  }

  const { week, entities: sessionDups } = buildWeekDuplicate(doc, cmd.sourceWeekId, cmd.newWeekId)
  const sourceIndex = doc.weeks.findIndex((w) => w.id === cmd.sourceWeekId)
  if (sourceIndex < 0) {
    throw new DomainError('week.not_found', `Week ${cmd.sourceWeekId} not found`)
  }

  const next = cloneDocument(doc)
  for (const dup of sessionDups) {
    mergeSessionDuplicateIntoEntities(next.entities, dup)
  }

  const weeks = [...next.weeks]
  weeks.splice(sourceIndex + 1, 0, week)
  next.weeks = weeks

  return next
}

function applyWeekReorder(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'week.reorder' }>
): MinimalProgramDocument {
  const currentIds = doc.weeks.map((w) => w.id)
  if (!sameIdSet(currentIds, cmd.weekIds)) {
    throw new DomainError(
      'week.reorder_mismatch',
      'weekIds must be a permutation of the current weeks'
    )
  }

  if (new Set(cmd.weekIds).size !== cmd.weekIds.length) {
    throw new DomainError('week.duplicate_week_ids', 'weekIds must not contain duplicates')
  }

  const byId = new Map(doc.weeks.map((w) => [w.id, w]))
  const next = cloneDocument(doc)
  next.weeks = cmd.weekIds.map((id) => {
    const week = byId.get(id)
    if (!week) {
      throw new DomainError('week.not_found', `Week ${id} not found`)
    }
    return week
  })
  return next
}

function applyWeekSessionsReorder(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'week.sessions.reorder' }>
): MinimalProgramDocument {
  const weekIndex = doc.weeks.findIndex((w) => w.id === cmd.weekId)
  if (weekIndex < 0) {
    throw new DomainError('week.not_found', `Week ${cmd.weekId} not found`)
  }

  const week = doc.weeks[weekIndex]
  if (!sameIdSet(week.sessionIds, cmd.sessionIds)) {
    throw new DomainError(
      'week.sessions_reorder_mismatch',
      `sessionIds must be a permutation of the current week sessions (${week.id})`
    )
  }

  if (new Set(cmd.sessionIds).size !== cmd.sessionIds.length) {
    throw new DomainError('week.duplicate_session_ids', 'sessionIds must not contain duplicates')
  }

  const next = cloneDocument(doc)
  next.weeks[weekIndex] = { ...week, sessionIds: [...cmd.sessionIds] }
  return next
}

function applyProgramExerciseUpdate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'programExercise.update' }>
): MinimalProgramDocument {
  const current = doc.entities.programExercises[cmd.programExerciseId]
  if (!current) {
    throw new DomainError(
      'program_exercise.not_found',
      `Program exercise ${cmd.programExerciseId} not found`
    )
  }

  const next = cloneDocument(doc)
  const updated: ProgramExerciseNode = { ...current }

  if ('sets' in cmd.patch) updated.sets = cmd.patch.sets ?? null
  if ('reps' in cmd.patch) updated.reps = cmd.patch.reps ?? null
  if ('restTime' in cmd.patch) updated.restTime = cmd.patch.restTime ?? null
  if ('rpe' in cmd.patch) updated.rpe = cmd.patch.rpe ?? null
  if ('tempo' in cmd.patch) updated.tempo = cmd.patch.tempo ?? null
  if ('load' in cmd.patch) updated.load = cmd.patch.load ?? null
  if ('notes' in cmd.patch) updated.notes = cmd.patch.notes ?? null
  if ('subtitle' in cmd.patch) updated.subtitle = cmd.patch.subtitle ?? null

  next.entities.programExercises[cmd.programExerciseId] = updated
  return next
}

function applyBlockExerciseUpdate(
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'blockExercise.update' }>
): MinimalProgramDocument {
  const current = doc.entities.blockExercises[cmd.blockExerciseId]
  if (!current) {
    throw new DomainError('block_exercise.not_found', `Block exercise ${cmd.blockExerciseId} not found`)
  }

  const next = cloneDocument(doc)
  const updated: BlockExerciseNode = { ...current }

  if ('notes' in cmd.patch) {
    updated.notes = cmd.patch.notes ?? null
  }
  if ('exerciseName' in cmd.patch) {
    updated.exerciseName = cmd.patch.exerciseName ?? null
  }

  next.entities.blockExercises[cmd.blockExerciseId] = updated
  return next
}

export function applyMinimalCommand(doc: MinimalProgramDocument, cmd: MinimalCommand): MinimalProgramDocument {
  let next: MinimalProgramDocument

  switch (cmd.type) {
    case 'session.add':
      next = applySessionAdd(doc, cmd)
      break
    case 'session.delete':
      next = applySessionDelete(doc, cmd)
      break
    case 'session.update':
      next = applySessionUpdate(doc, cmd)
      break
    case 'session.duplicate':
      next = applySessionDuplicate(doc, cmd)
      break
    case 'week.add':
      next = applyWeekAdd(doc, cmd)
      break
    case 'week.delete':
      next = applyWeekDelete(doc, cmd)
      break
    case 'week.duplicate':
      next = applyWeekDuplicate(doc, cmd)
      break
    case 'week.reorder':
      next = applyWeekReorder(doc, cmd)
      break
    case 'week.sessions.reorder':
      next = applyWeekSessionsReorder(doc, cmd)
      break
    case 'week.update':
      next = applyWeekUpdate(doc, cmd)
      break
    case 'block.update':
      next = applyBlockUpdate(doc, cmd)
      break
    case 'program.update':
      next = applyProgramUpdate(doc, cmd)
      break
    case 'timeline.reorder':
      next = applyTimelineReorder(doc, cmd)
      break
    case 'blockExercise.reorder':
      next = applyBlockExerciseReorder(doc, cmd)
      break
    case 'blockExercise.update':
      next = applyBlockExerciseUpdate(doc, cmd)
      break
    case 'programExercise.update':
      next = applyProgramExerciseUpdate(doc, cmd)
      break
    case 'timeline.exercise.add':
      next = applyTimelineExerciseAdd(cloneDocument, doc, cmd)
      break
    case 'timeline.block.add':
      next = applyTimelineBlockAdd(cloneDocument, doc, cmd)
      break
    case 'timeline.item.delete':
      next = applyTimelineItemDelete(cloneDocument, doc, cmd)
      break
    case 'timeline.exercise.duplicate':
      next = applyTimelineExerciseDuplicate(cloneDocument, doc, cmd)
      break
    case 'timeline.block.duplicate':
      next = applyTimelineBlockDuplicate(cloneDocument, doc, cmd)
      break
    case 'blockExercise.add':
      next = applyBlockExerciseAdd(cloneDocument, doc, cmd)
      break
    case 'blockExercise.delete':
      next = applyBlockExerciseDelete(cloneDocument, doc, cmd)
      break
    default: {
      const exhaustive: never = cmd
      throw new DomainError('command.unknown', `Unknown command type: ${(exhaustive as MinimalCommand).type}`)
    }
  }

  assertValidMinimalDocument(next)
  return next
}
