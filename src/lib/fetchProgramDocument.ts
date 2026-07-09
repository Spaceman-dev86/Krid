import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  MinimalProgramDocument,
  MinimalProgramEntities,
  ProgramMetaNode,
  SessionBlockNode,
  SessionNode,
  TimelineItemNode,
  WeekNode,
} from '../domain/program-editor'
import { assertValidMinimalDocument } from '../domain/program-editor'
import {
  dbTypeToBlockKind,
  defaultBlockTitle,
  inferBlockKindFromTitle,
} from '../domain/program-editor/blockDbTypes'

type ProgramRow = {
  id: string
  title: string | null
  description: string | null
  goal: string | null
  level: string | null
  duration: string | null
  is_published: boolean | null
  image_url: string | null
}

type WeekRow = { id: string; program_id: string; title: string; week_order: number }

type SessionRow = {
  id: string
  week_id: string
  title: string
  description: string | null
  session_order: number
}

type SessionItemRow = {
  id: string
  session_id: string
  position: number
  kind: 'exercise' | 'block' | string
  program_exercise_id: string | null
  session_block_id: string | null
}

type SessionBlockRow = {
  id: string
  program_session_id: string
  position: number | null
  type: string | null
  title: string | null
  notes: string | null
}

type ProgramExerciseRow = {
  id: string
  session_id: string
  exercise_id: string | null
  name: string | null
  exercise_order: number | null
  sets: number | null
  reps: number | null
  rest_time: string | null
  rpe: number | null
  tempo: string | null
  load: string | null
  notes: string | null
  exercise_library?: { name: string } | { name: string }[] | null
}

type BlockExerciseRow = {
  id: string
  session_block_id: string
  exercise_id: string | null
  exercise_name: string | null
  notes: string | null
  position: number
  exercise_library?: { name: string } | { name: string }[] | null
}

function libraryNameFromJoin(lib: BlockExerciseRow['exercise_library']): string | null {
  if (!lib) return null
  if (Array.isArray(lib)) return lib[0]?.name?.trim() || null
  return lib.name?.trim() || null
}

function programExerciseDisplayName(pe: ProgramExerciseRow): string | null {
  const lib = pe.exercise_library
  const fromLib = Array.isArray(lib) ? lib[0]?.name?.trim() : lib?.name?.trim()
  return pe.name?.trim() || fromLib || null
}

function isSessionItemBlockKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'block' || k === 'session_block' || k === 'bloc' || k === 'circuit' || k === 'crosstraining'
}

function legacyExerciseTimelineItemId(programExerciseId: string): string {
  return `legacy-ex-${programExerciseId}`
}

export async function fetchProgramDocument(
  supabase: SupabaseClient,
  programId: string
): Promise<MinimalProgramDocument> {
  const [{ data: program, error: programError }, { data: weeks, error: weeksError }] = await Promise.all([
    supabase.from('programs').select('id,title,description,goal,level,duration,is_published,image_url').eq('id', programId).maybeSingle(),
    supabase
      .from('program_weeks')
      .select('id,program_id,title,week_order')
      .eq('program_id', programId)
      .order('week_order', { ascending: true }),
  ])
  if (programError) throw programError
  if (!program) throw new Error(`Program ${programId} not found`)
  if (weeksError) throw weeksError

  const weekIds = (weeks ?? []).map((w) => w.id)

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id,week_id,title,description,session_order')
    .in('week_id', weekIds.length ? weekIds : ['00000000-0000-0000-0000-000000000000'])
    .order('session_order', { ascending: true })
  if (sessionsError) throw sessionsError

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const emptyId = '00000000-0000-0000-0000-000000000000'

  const [
    { data: sessionItems, error: itemsError },
    { data: sessionBlocks, error: blocksError },
    peResult,
  ] = await Promise.all([
    supabase
      .from('session_items')
      .select('id,session_id,position,kind,program_exercise_id,session_block_id')
      .in('session_id', sessionIds.length ? sessionIds : [emptyId])
      .order('position', { ascending: true }),
    supabase
      .from('session_blocks')
      .select('id,program_session_id,position,type,title,notes')
      .in('program_session_id', sessionIds.length ? sessionIds : [emptyId])
      .order('position', { ascending: true }),
    supabase
      .from('program_exercises')
      .select(
        'id,session_id,exercise_id,name,exercise_order,sets,reps,rest_time,rpe,tempo,load,notes,exercise_library(name)'
      )
      .in('session_id', sessionIds.length ? sessionIds : [emptyId])
      .order('exercise_order', { ascending: true }),
  ])

  if (itemsError) throw itemsError
  if (blocksError) throw blocksError

  let programExercises = peResult.data
  let peError = peResult.error
  if (peError) {
    const retry = await supabase
      .from('program_exercises')
      .select('id,session_id,exercise_id,name,exercise_order,sets,reps,rest_time,rpe,tempo,load,notes')
      .in('session_id', sessionIds.length ? sessionIds : [emptyId])
      .order('exercise_order', { ascending: true })
    programExercises = retry.data as typeof programExercises
    peError = retry.error
  }
  if (peError) throw peError

  const programExerciseRows = (programExercises ?? []) as ProgramExerciseRow[]

  const blockIds = (sessionBlocks ?? []).map((b) => b.id)
  let blockExercisesRaw: BlockExerciseRow[] | null = null
  let beError: { message: string } | null = null
  const beWithJoin = await supabase
    .from('block_exercises')
    .select('id,session_block_id,exercise_id,exercise_name,notes,position,exercise_library(name)')
    .in('session_block_id', blockIds.length ? blockIds : [emptyId])
    .order('position', { ascending: true })
  blockExercisesRaw = beWithJoin.data as BlockExerciseRow[] | null
  beError = beWithJoin.error
  if (beError) {
    const beRetry = await supabase
      .from('block_exercises')
      .select('id,session_block_id,exercise_id,exercise_name,notes,position')
      .in('session_block_id', blockIds.length ? blockIds : [emptyId])
      .order('position', { ascending: true })
    blockExercisesRaw = beRetry.data as BlockExerciseRow[] | null
    beError = beRetry.error
  }
  if (beError) throw beError

  const programMeta: ProgramMetaNode = {
    title: String((program as ProgramRow).title ?? '').trim() || 'Programme',
    description: (program as ProgramRow).description ?? null,
    goal: (program as ProgramRow).goal ?? null,
    level: (program as ProgramRow).level ?? null,
    duration: (program as ProgramRow).duration ?? null,
    isPublished: Boolean((program as ProgramRow).is_published),
    imageUrl: (program as ProgramRow).image_url ?? null,
  }

  const entities: MinimalProgramEntities = {
    sessions: {},
    timelineItems: {},
    sessionBlocks: {},
    blockExercises: {},
    programExercises: {},
  }

  const weeksOut: WeekNode[] = (weeks as WeekRow[]).map((w) => ({
    id: w.id,
    title: w.title,
    notes: null,
    sessionIds: [],
  }))
  const weekById = new Map(weeksOut.map((w) => [w.id, w]))

  const itemsBySession = new Map<string, SessionItemRow[]>()
  for (const row of (sessionItems ?? []) as SessionItemRow[]) {
    const list = itemsBySession.get(row.session_id) ?? []
    list.push(row)
    itemsBySession.set(row.session_id, list)
  }
  for (const list of itemsBySession.values()) {
    list.sort((a, b) => a.position - b.position)
  }

  const pesBySession = new Map<string, ProgramExerciseRow[]>()
  for (const pe of programExerciseRows) {
    const list = pesBySession.get(pe.session_id) ?? []
    list.push(pe)
    pesBySession.set(pe.session_id, list)
  }

  const blocksBySession = new Map<string, SessionBlockRow[]>()
  for (const b of (sessionBlocks ?? []) as SessionBlockRow[]) {
    const list = blocksBySession.get(b.program_session_id) ?? []
    list.push(b)
    blocksBySession.set(b.program_session_id, list)
  }

  const blockById = new Map((sessionBlocks ?? []).map((b) => [b.id, b as SessionBlockRow]))
  const peById = new Map(programExerciseRows.map((pe) => [pe.id, pe]))
  const beByBlockId = new Map<string, BlockExerciseRow[]>()
  for (const be of (blockExercisesRaw ?? []) as BlockExerciseRow[]) {
    const list = beByBlockId.get(be.session_block_id) ?? []
    list.push(be)
    beByBlockId.set(be.session_block_id, list)
  }

  const referencedProgramExerciseIds = new Set<string>()
  const referencedBlockIds = new Set<string>()

  function addProgramExercise(pe: ProgramExerciseRow) {
    referencedProgramExerciseIds.add(pe.id)
    const displayName = programExerciseDisplayName(pe)
    entities.programExercises[pe.id] = {
      id: pe.id,
      libraryExerciseId: pe.exercise_id,
      sets: pe.sets,
      reps: pe.reps,
      restTime: pe.rest_time,
      rpe: pe.rpe,
      tempo: pe.tempo,
      load: pe.load,
      notes: pe.notes,
      subtitle: displayName,
    }
  }

  function addSessionBlock(block: SessionBlockRow) {
    referencedBlockIds.add(block.id)
    if (entities.sessionBlocks[block.id]) return
    let blockKind = dbTypeToBlockKind(block.type)
    if (!blockKind || blockKind === 'neutral') {
      blockKind = inferBlockKindFromTitle(block.title) ?? blockKind
    }
    entities.sessionBlocks[block.id] = {
      id: block.id,
      sessionId: block.program_session_id,
      blockKind,
      title: defaultBlockTitle(blockKind, block.title),
      notes: block.notes,
      blockExerciseIds: [],
    }
    for (const be of beByBlockId.get(block.id) ?? []) {
      const displayName =
        libraryNameFromJoin(be.exercise_library) ||
        be.exercise_name?.trim() ||
        null
      entities.blockExercises[be.id] = {
        id: be.id,
        blockId: be.session_block_id,
        libraryExerciseId: be.exercise_id?.trim() || null,
        exerciseName: displayName,
        notes: be.notes,
      }
      entities.sessionBlocks[block.id].blockExerciseIds.push(be.id)
    }
  }

  function addTimelineItem(item: TimelineItemNode) {
    entities.timelineItems[item.id] = item
    const session = entities.sessions[item.sessionId]
    if (session) session.timelineItemIds.push(item.id)
  }

  for (const s of (sessions ?? []) as SessionRow[]) {
    entities.sessions[s.id] = {
      id: s.id,
      weekId: s.week_id,
      title: s.title,
      description: s.description,
      timelineItemIds: [],
    }
    const week = weekById.get(s.week_id)
    if (week) week.sessionIds.push(s.id)

    const dbItems = itemsBySession.get(s.id) ?? []

    if (dbItems.length > 0) {
      for (const it of dbItems) {
        if (isSessionItemBlockKind(it.kind) && it.session_block_id) {
          const block = blockById.get(it.session_block_id)
          if (block) addSessionBlock(block)
          addTimelineItem({
            id: it.id,
            sessionId: s.id,
            kind: 'block',
            programExerciseId: null,
            sessionBlockId: it.session_block_id,
          })
          continue
        }

        if (it.program_exercise_id) {
          const pe = peById.get(it.program_exercise_id)
          if (pe) addProgramExercise(pe)
        }
        addTimelineItem({
          id: it.id,
          sessionId: s.id,
          kind: 'exercise',
          programExerciseId: it.program_exercise_id,
          sessionBlockId: null,
        })
      }
      continue
    }

    // Legacy séance : program_exercises + session_blocks sans session_items (comme V1).
    for (const pe of pesBySession.get(s.id) ?? []) {
      addProgramExercise(pe)
      addTimelineItem({
        id: legacyExerciseTimelineItemId(pe.id),
        sessionId: s.id,
        kind: 'exercise',
        programExerciseId: pe.id,
        sessionBlockId: null,
      })
    }

    for (const block of blocksBySession.get(s.id) ?? []) {
      addSessionBlock(block)
      addTimelineItem({
        id: block.id,
        sessionId: s.id,
        kind: 'block',
        programExerciseId: null,
        sessionBlockId: block.id,
      })
    }
  }

  const doc: MinimalProgramDocument = {
    programId,
    program: programMeta,
    weeks: weeksOut,
    entities,
  }

  assertValidMinimalDocument(doc)
  return doc
}
