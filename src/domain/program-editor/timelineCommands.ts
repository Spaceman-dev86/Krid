import { BLOCK_TEMPLATES } from './blockTemplates'
import { libraryExerciseName } from './devExerciseLibrary'
import { DomainError } from './errors'
import type { MinimalCommand } from './minimalCommands'
import type {
  BlockExerciseNode,
  EntityId,
  MinimalProgramDocument,
  ProgramExerciseNode,
  SessionBlockNode,
} from './minimalDocument'
import {
  collectTimelineItemCascade,
  countProgramExerciseReferences,
} from './timelineCascade'
import { defaultIdGenerator } from './duplicateHelpers'

const BLOCK_TITLES = {
  warmup: 'Warm-up',
  crossfit: 'CrossFit',
  superset: 'Superset',
  neutral: 'Bloc neutre',
} as const

function emptyProgramExercise(id: EntityId, libraryExerciseId: EntityId | null): ProgramExerciseNode {
  const subtitle = libraryExerciseName(libraryExerciseId)
  return {
    id,
    libraryExerciseId,
    sets: null,
    reps: null,
    restTime: null,
    rpe: null,
    tempo: null,
    load: null,
    notes: null,
    subtitle,
  }
}

function insertTimelineItemAfter(sessionItemIds: EntityId[], afterItemId: EntityId, newItemId: EntityId): EntityId[] {
  const idx = sessionItemIds.indexOf(afterItemId)
  if (idx < 0) return [...sessionItemIds, newItemId]
  const next = [...sessionItemIds]
  next.splice(idx + 1, 0, newItemId)
  return next
}

function insertTimelineItemAt(sessionItemIds: EntityId[], index: number, newItemId: EntityId): EntityId[] {
  const clamped = Math.max(0, Math.min(sessionItemIds.length, index))
  const next = [...sessionItemIds]
  next.splice(clamped, 0, newItemId)
  return next
}

function omitKeys<T extends Record<string, unknown>>(record: T, keys: string[]): T {
  const next = { ...record }
  for (const key of keys) delete next[key]
  return next
}

function cloneBlockSubtree(
  doc: MinimalProgramDocument,
  sourceBlockId: EntityId,
  newBlockId: EntityId,
  newSessionId: EntityId,
  idGen: (prefix: string) => EntityId
): {
  block: SessionBlockNode
  blockExercises: Record<EntityId, BlockExerciseNode>
} {
  const sourceBlock = doc.entities.sessionBlocks[sourceBlockId]
  if (!sourceBlock) {
    throw new DomainError('block.not_found', `Block ${sourceBlockId} not found`)
  }

  const blockExercises: Record<EntityId, BlockExerciseNode> = {}
  const newBeIds: EntityId[] = []

  for (const oldBeId of sourceBlock.blockExerciseIds) {
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

  const block: SessionBlockNode = {
    id: newBlockId,
    sessionId: newSessionId,
    blockKind: sourceBlock.blockKind,
    title: sourceBlock.title,
    notes: sourceBlock.notes,
    blockExerciseIds: newBeIds,
  }

  return { block, blockExercises }
}

type CloneDoc = (doc: MinimalProgramDocument) => MinimalProgramDocument

export function applyTimelineExerciseAdd(
  cloneDocument: CloneDoc,
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'timeline.exercise.add' }>
): MinimalProgramDocument {
  const session = doc.entities.sessions[cmd.sessionId]
  if (!session) throw new DomainError('session.not_found', `Session ${cmd.sessionId} not found`)
  if (doc.entities.timelineItems[cmd.timelineItemId]) {
    throw new DomainError('timeline_item.already_exists', `Timeline item ${cmd.timelineItemId} already exists`)
  }
  if (doc.entities.programExercises[cmd.programExerciseId]) {
    throw new DomainError('program_exercise.already_exists', `Program exercise ${cmd.programExerciseId} already exists`)
  }

  const next = cloneDocument(doc)
  next.entities.programExercises[cmd.programExerciseId] = emptyProgramExercise(
    cmd.programExerciseId,
    cmd.libraryExerciseId
  )
  next.entities.timelineItems[cmd.timelineItemId] = {
    id: cmd.timelineItemId,
    sessionId: cmd.sessionId,
    kind: 'exercise',
    programExerciseId: cmd.programExerciseId,
    sessionBlockId: null,
  }
  next.entities.sessions[cmd.sessionId] = {
    ...session,
    timelineItemIds:
      cmd.insertIndex != null
        ? insertTimelineItemAt(session.timelineItemIds, cmd.insertIndex, cmd.timelineItemId)
        : [...session.timelineItemIds, cmd.timelineItemId],
  }
  return next
}

export function applyTimelineBlockAdd(
  cloneDocument: CloneDoc,
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'timeline.block.add' }>
): MinimalProgramDocument {
  const session = doc.entities.sessions[cmd.sessionId]
  if (!session) throw new DomainError('session.not_found', `Session ${cmd.sessionId} not found`)
  if (doc.entities.timelineItems[cmd.timelineItemId]) {
    throw new DomainError('timeline_item.already_exists', `Timeline item ${cmd.timelineItemId} already exists`)
  }
  if (doc.entities.sessionBlocks[cmd.blockId]) {
    throw new DomainError('block.already_exists', `Block ${cmd.blockId} already exists`)
  }

  const kind = cmd.blockKind ?? 'warmup'
  const title = cmd.title?.trim() || BLOCK_TITLES[kind]
  const blockExerciseIds: EntityId[] = []

  const next = cloneDocument(doc)
  for (const seed of cmd.initialBlockExercises ?? []) {
    if (next.entities.blockExercises[seed.blockExerciseId]) {
      throw new DomainError(
        'block_exercise.already_exists',
        `Block exercise ${seed.blockExerciseId} already exists`
      )
    }
    next.entities.blockExercises[seed.blockExerciseId] = {
      id: seed.blockExerciseId,
      blockId: cmd.blockId,
      libraryExerciseId: seed.libraryExerciseId,
      exerciseName: libraryExerciseName(seed.libraryExerciseId) ?? 'Exercice',
      notes: null,
    }
    blockExerciseIds.push(seed.blockExerciseId)
  }

  next.entities.sessionBlocks[cmd.blockId] = {
    id: cmd.blockId,
    sessionId: cmd.sessionId,
    blockKind: kind,
    title,
    notes: cmd.notes?.trim() || BLOCK_TEMPLATES[kind].notes.trim() || null,
    blockExerciseIds,
  }
  next.entities.timelineItems[cmd.timelineItemId] = {
    id: cmd.timelineItemId,
    sessionId: cmd.sessionId,
    kind: 'block',
    programExerciseId: null,
    sessionBlockId: cmd.blockId,
  }
  next.entities.sessions[cmd.sessionId] = {
    ...session,
    timelineItemIds:
      cmd.insertIndex != null
        ? insertTimelineItemAt(session.timelineItemIds, cmd.insertIndex, cmd.timelineItemId)
        : [...session.timelineItemIds, cmd.timelineItemId],
  }
  return next
}

export function applyTimelineItemDelete(
  cloneDocument: CloneDoc,
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'timeline.item.delete' }>
): MinimalProgramDocument {
  const item = doc.entities.timelineItems[cmd.timelineItemId]
  if (!item) {
    throw new DomainError('timeline_item.not_found', `Timeline item ${cmd.timelineItemId} not found`)
  }

  const session = doc.entities.sessions[item.sessionId]
  if (!session) {
    throw new DomainError('session.not_found', `Session ${item.sessionId} not found`)
  }

  const cascade = collectTimelineItemCascade(doc.entities, cmd.timelineItemId)
  const next = cloneDocument(doc)

  next.entities.sessions[item.sessionId] = {
    ...session,
    timelineItemIds: session.timelineItemIds.filter((id) => id !== cmd.timelineItemId),
  }
  next.entities.timelineItems = omitKeys(next.entities.timelineItems, cascade.timelineItemIds)
  next.entities.sessionBlocks = omitKeys(next.entities.sessionBlocks, cascade.blockIds)
  next.entities.blockExercises = omitKeys(next.entities.blockExercises, cascade.blockExerciseIds)

  const peIdsToDelete = cascade.programExerciseIds.filter(
    (peId) => countProgramExerciseReferences(next.entities, peId) === 0
  )
  next.entities.programExercises = omitKeys(next.entities.programExercises, peIdsToDelete)

  return next
}

export function applyTimelineExerciseDuplicate(
  cloneDocument: CloneDoc,
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'timeline.exercise.duplicate' }>
): MinimalProgramDocument {
  const source = doc.entities.timelineItems[cmd.sourceTimelineItemId]
  if (!source || source.kind !== 'exercise' || !source.programExerciseId) {
    throw new DomainError('timeline_item.not_found', `Exercise timeline item ${cmd.sourceTimelineItemId} not found`)
  }

  const session = doc.entities.sessions[source.sessionId]
  if (!session) throw new DomainError('session.not_found', `Session ${source.sessionId} not found`)

  const oldPe = doc.entities.programExercises[source.programExerciseId]
  if (!oldPe) {
    throw new DomainError('program_exercise.not_found', `Program exercise ${source.programExerciseId} not found`)
  }

  const next = cloneDocument(doc)
  next.entities.programExercises[cmd.newProgramExerciseId] = { ...oldPe, id: cmd.newProgramExerciseId }
  next.entities.timelineItems[cmd.newTimelineItemId] = {
    id: cmd.newTimelineItemId,
    sessionId: source.sessionId,
    kind: 'exercise',
    programExerciseId: cmd.newProgramExerciseId,
    sessionBlockId: null,
  }
  next.entities.sessions[source.sessionId] = {
    ...session,
    timelineItemIds: insertTimelineItemAfter(
      session.timelineItemIds,
      cmd.sourceTimelineItemId,
      cmd.newTimelineItemId
    ),
  }
  return next
}

export function applyTimelineBlockDuplicate(
  cloneDocument: CloneDoc,
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'timeline.block.duplicate' }>
): MinimalProgramDocument {
  const source = doc.entities.timelineItems[cmd.sourceTimelineItemId]
  if (!source || source.kind !== 'block' || !source.sessionBlockId) {
    throw new DomainError('timeline_item.not_found', `Block timeline item ${cmd.sourceTimelineItemId} not found`)
  }

  const session = doc.entities.sessions[source.sessionId]
  if (!session) throw new DomainError('session.not_found', `Session ${source.sessionId} not found`)

  const idGen = defaultIdGenerator
  const { block, blockExercises } = cloneBlockSubtree(
    doc,
    source.sessionBlockId,
    cmd.newBlockId,
    source.sessionId,
    idGen
  )

  const next = cloneDocument(doc)
  Object.assign(next.entities.blockExercises, blockExercises)
  next.entities.sessionBlocks[cmd.newBlockId] = block
  next.entities.timelineItems[cmd.newTimelineItemId] = {
    id: cmd.newTimelineItemId,
    sessionId: source.sessionId,
    kind: 'block',
    programExerciseId: null,
    sessionBlockId: cmd.newBlockId,
  }
  next.entities.sessions[source.sessionId] = {
    ...session,
    timelineItemIds: insertTimelineItemAfter(
      session.timelineItemIds,
      cmd.sourceTimelineItemId,
      cmd.newTimelineItemId
    ),
  }
  return next
}

export function applyBlockExerciseAdd(
  cloneDocument: CloneDoc,
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'blockExercise.add' }>
): MinimalProgramDocument {
  const block = doc.entities.sessionBlocks[cmd.blockId]
  if (!block) throw new DomainError('block.not_found', `Block ${cmd.blockId} not found`)
  if (doc.entities.blockExercises[cmd.blockExerciseId]) {
    throw new DomainError('block_exercise.already_exists', `Block exercise ${cmd.blockExerciseId} already exists`)
  }

  const next = cloneDocument(doc)
  next.entities.blockExercises[cmd.blockExerciseId] = {
    id: cmd.blockExerciseId,
    blockId: cmd.blockId,
    libraryExerciseId: cmd.libraryExerciseId,
    exerciseName:
      cmd.exerciseName?.trim() || libraryExerciseName(cmd.libraryExerciseId) || 'Exercice',
    notes: null,
  }
  next.entities.sessionBlocks[cmd.blockId] = {
    ...block,
    blockExerciseIds: [...block.blockExerciseIds, cmd.blockExerciseId],
  }
  return next
}

export function applyBlockExerciseDelete(
  cloneDocument: CloneDoc,
  doc: MinimalProgramDocument,
  cmd: Extract<MinimalCommand, { type: 'blockExercise.delete' }>
): MinimalProgramDocument {
  const row = doc.entities.blockExercises[cmd.blockExerciseId]
  if (!row) {
    throw new DomainError('block_exercise.not_found', `Block exercise ${cmd.blockExerciseId} not found`)
  }

  const block = doc.entities.sessionBlocks[row.blockId]
  if (!block) {
    throw new DomainError('block.not_found', `Block ${row.blockId} not found`)
  }

  const next = cloneDocument(doc)
  next.entities.sessionBlocks[row.blockId] = {
    ...block,
    blockExerciseIds: block.blockExerciseIds.filter((id) => id !== cmd.blockExerciseId),
  }
  next.entities.blockExercises = omitKeys(next.entities.blockExercises, [cmd.blockExerciseId])
  return next
}
