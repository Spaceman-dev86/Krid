import { UNIT_SHORT_FALLBACK } from '@/src/lib/catalog/rxPresets'
import {
  formatFilledPrescriptionLines,
} from '@/src/lib/sessions/blockDetail'
import { mapFlatRx } from '@/src/lib/sessions/materializeProgramSessionSlots'

import type {
  PreviewBlockExerciseRow,
  PreviewProgramExerciseRow,
  PreviewRxRow,
  PreviewSessionBlockRow,
  PreviewSessionItemRow,
  PreviewSessionRow,
  PreviewUnitRow,
  ProgramPreviewStructure,
} from '../fetchProgramPreviewStructure'

export type SessionRunStyle = 'fait' | 'fait_edite' | 'libre' | 'pas_fait' | 'en_cours'
export type SessionRunSource = 'plan' | 'libre' | 'adapted'

export type SessionRunRow = {
  id: string
  client_id: string
  coach_id: string
  plan_id: string | null
  source_session_id: string | null
  source: SessionRunSource
  title: string | null
  scheduled_date: string | null
  actual_date: string | null
  style: SessionRunStyle
  snapshot: SessionRunSnapshot | null
  realized: SessionRunRealized | null
  comment: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

export type SnapshotExercise = {
  id: string
  kind: 'exercise'
  name: string
  exercise_id: string | null
  sets: number | string | null
  reps: number | string | null
  rest_time: string | null
  rpe: number | null
  load: string | null
  tempo: string | null
  notes: string | null
  /** Lignes Rx multi-paliers (S1 · …) — source prescriptions jsonb. */
  rx_lines?: string[]
  demo_media_url?: string | null
}

export type SnapshotBlockExercise = {
  id: string
  name: string
  exercise_id: string | null
  sets: number | string | null
  reps: number | string | null
  load_text: string | null
  rest_seconds: number | null
  notes: string | null
  rx_lines?: string[]
  demo_media_url?: string | null
}

export type SnapshotBlock = {
  id: string
  kind: 'block'
  title: string
  type: string
  notes: string | null
  /** Objectif métrique (temps|charge|reps|tonnage|…) — optionnel. */
  objective?: string | null
  exercises: SnapshotBlockExercise[]
}

export type SnapshotItem = SnapshotExercise | SnapshotBlock

export type SessionRunSnapshot = {
  version: 1
  session_id: string
  title: string
  items: SnapshotItem[]
}

export type ItemRunStatus = 'pending' | 'fait' | 'partiel' | 'non_fait'

/** Une série réalisée (préremplie depuis les consignes coach). */
export type RealizedSet = {
  reps: string | null
  load: string | null
  rpe: string | null
  note: string | null
  done: boolean
}

export type SessionRunRealizedItem = {
  status: ItemRunStatus
  note?: string | null
  /** Séries loggées (exo) — absentes = ancien format status-only. */
  sets?: RealizedSet[]
  /** Sous-items d’un bloc (exo id → status). */
  blockExercises?: Record<string, { status: ItemRunStatus }>
}

export type SessionRunRealized = {
  version: 1
  items: Record<string, SessionRunRealizedItem>
}

export function parseSetsCount(sets: number | string | null | undefined): number {
  if (sets == null || sets === '') return 0
  if (typeof sets === 'number') return Number.isFinite(sets) && sets > 0 ? Math.floor(sets) : 0
  const m = String(sets).match(/\d+/)
  if (!m) return 0
  const n = Number(m[0])
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 0
}

/** Parse "90", "90s", "1:30", "1min30", "90 sec" → seconds. */
export function parseRestSeconds(rest: string | number | null | undefined): number | null {
  if (rest == null || rest === '') return null
  if (typeof rest === 'number') return rest > 0 ? Math.floor(rest) : null
  const raw = String(rest).trim().toLowerCase()
  if (!raw) return null

  const mmss = raw.match(/^(\d+)\s*[:m]\s*(\d{1,2})\s*s?$/)
  if (mmss) {
    return Number(mmss[1]) * 60 + Number(mmss[2])
  }
  const minOnly = raw.match(/^(\d+)\s*min(?:utes?)?$/)
  if (minOnly) return Number(minOnly[1]) * 60
  const secOnly = raw.match(/^(\d+)\s*(?:s|sec|secs|secondes?)?$/)
  if (secOnly) {
    const n = Number(secOnly[1])
    return n > 0 ? n : null
  }
  return null
}

export function formatRestLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m} min`
}

export function buildEmptySetsForExercise(item: SnapshotExercise): RealizedSet[] {
  const count = parseSetsCount(item.sets)
  if (count <= 0) return []
  return Array.from({ length: count }, () => ({
    reps: item.reps != null ? String(item.reps) : null,
    load: item.load != null ? String(item.load) : null,
    rpe: item.rpe != null ? String(item.rpe) : null,
    note: null,
    done: false,
  }))
}

export function allSetsDone(sets: RealizedSet[] | undefined): boolean {
  if (!sets?.length) return false
  return sets.every((s) => s.done)
}

export function someSetsDone(sets: RealizedSet[] | undefined): boolean {
  if (!sets?.length) return false
  return sets.some((s) => s.done)
}

/** Statut exo à partir des séries loggées (ou status forcé). */
export function resolveExerciseStatusFromSets(
  sets: RealizedSet[] | undefined,
  fallback: ItemRunStatus = 'pending'
): ItemRunStatus {
  if (!sets?.length) return fallback
  if (allSetsDone(sets)) return 'fait'
  if (someSetsDone(sets)) return 'partiel'
  return fallback === 'non_fait' ? 'non_fait' : 'pending'
}

export function hasPrescriptionFields(item: SnapshotExercise): boolean {
  return (
    parseSetsCount(item.sets) > 0 ||
    (item.reps != null && String(item.reps).trim() !== '' && String(item.reps) !== '0') ||
    Boolean(item.load) ||
    item.rpe != null
  )
}

export const RUN_STYLE_LABELS: Record<SessionRunStyle, string> = {
  en_cours: 'En cours',
  fait: 'Fait',
  fait_edite: 'Fait-édité',
  libre: 'Libre',
  pas_fait: 'Pas fait',
}

function isBlockKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'block' || k === 'session_block' || k === 'bloc' || k === 'circuit' || k === 'crosstraining'
}

function isExerciseKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'exercise' || k === 'program_exercise'
}

function buildUnitMaps(units: PreviewUnitRow[] | undefined) {
  const list = units ?? []
  const unitKeyById = new Map(list.map((u) => [u.id, u.key] as const))
  const unitById = new Map(
    list.map((u) => [
      u.id,
      { key: u.key, label: u.label, short_label: u.short_label },
    ] as const),
  )
  return { unitKeyById, unitById }
}

function rxLinesFromPrescriptions(
  prescriptions: PreviewRxRow[] | null | undefined,
  unitById: Map<string, { key: string; label: string; short_label?: string | null }>,
): string[] {
  if (!prescriptions?.length || unitById.size === 0) return []
  const lines = formatFilledPrescriptionLines(prescriptions, unitById, UNIT_SHORT_FALLBACK)
  if (lines.length <= 1) return lines
  return lines.map((line, i) => `S${i + 1} · ${line}`)
}

function hydratePeFromRx(
  pe: PreviewProgramExerciseRow,
  prescriptions: PreviewRxRow[] | null | undefined,
  unitKeyById: Map<string, string>,
): PreviewProgramExerciseRow {
  const hasFlat =
    pe.sets != null ||
    (pe.reps != null && String(pe.reps).trim() !== '') ||
    pe.rpe != null ||
    Boolean(pe.load) ||
    Boolean(pe.rest_time)
  if (hasFlat || !prescriptions?.length || unitKeyById.size === 0) return pe
  const flat = mapFlatRx(prescriptions, unitKeyById)
  return {
    ...pe,
    sets: flat.sets,
    reps: flat.reps,
    rest_time: flat.rest_time,
    rpe: flat.rpe,
    tempo: flat.tempo,
    load: flat.load,
    notes: pe.notes ?? flat.notes,
  }
}

function toSnapshotExercise(
  pe: PreviewProgramExerciseRow,
  opts?: {
    prescriptions?: PreviewRxRow[] | null
    unitKeyById?: Map<string, string>
    unitById?: Map<string, { key: string; label: string; short_label?: string | null }>
  },
): SnapshotExercise {
  const hydrated = hydratePeFromRx(
    pe,
    opts?.prescriptions,
    opts?.unitKeyById ?? new Map(),
  )
  const rx_lines = rxLinesFromPrescriptions(
    opts?.prescriptions,
    opts?.unitById ?? new Map(),
  )
  return {
    id: hydrated.id,
    kind: 'exercise',
    name: hydrated.exercise_library?.name ?? hydrated.name ?? 'Exercice',
    exercise_id: hydrated.exercise_id,
    sets: hydrated.sets,
    reps: hydrated.reps,
    rest_time: hydrated.rest_time,
    rpe: hydrated.rpe,
    load: hydrated.load,
    tempo: hydrated.tempo,
    notes: hydrated.notes,
    ...(rx_lines.length ? { rx_lines } : {}),
    demo_media_url: hydrated.demo_media_url ?? null,
  }
}

function toSnapshotBlock(
  block: PreviewSessionBlockRow,
  exercises: PreviewBlockExerciseRow[],
  opts?: {
    unitKeyById?: Map<string, string>
    unitById?: Map<string, { key: string; label: string; short_label?: string | null }>
  },
): SnapshotBlock {
  const unitKeyById = opts?.unitKeyById ?? new Map()
  const unitById = opts?.unitById ?? new Map()
  return {
    id: block.id,
    kind: 'block',
    title: block.title?.trim() || block.type || 'Bloc',
    type: block.type,
    notes: block.notes,
    objective: block.objective ?? null,
    exercises: exercises.map((be) => {
      const rx = be.prescriptions ?? []
      const hasFlat =
        be.sets != null ||
        (be.reps != null && String(be.reps).trim() !== '') ||
        be.rest_seconds != null ||
        Boolean(be.load_text)
      let sets = be.sets
      let reps = be.reps
      let load_text = be.load_text
      let rest_seconds = be.rest_seconds
      if (!hasFlat && rx.length && unitKeyById.size) {
        const flat = mapFlatRx(rx, unitKeyById)
        sets = flat.sets
        reps = flat.reps
        load_text = flat.load
        const restN = flat.rest_time ? Number.parseInt(flat.rest_time, 10) : NaN
        rest_seconds = Number.isFinite(restN) ? restN : null
      }
      const rx_lines = rxLinesFromPrescriptions(rx, unitById)
      return {
        id: be.id,
        name: be.exercise_library?.name ?? be.exercise_name ?? 'Exercice',
        exercise_id: be.exercise_id,
        sets,
        reps,
        load_text,
        rest_seconds,
        notes: be.notes,
        ...(rx_lines.length ? { rx_lines } : {}),
        demo_media_url: be.demo_media_url ?? null,
      }
    }),
  }
}

export function buildSessionSnapshot(
  session: PreviewSessionRow,
  structure: Pick<
    ProgramPreviewStructure,
    'sessionItems' | 'sessionBlocks' | 'blockExercises' | 'programExercises' | 'units'
  >,
): SessionRunSnapshot {
  const sessionItems = (structure.sessionItems as PreviewSessionItemRow[])
    .filter((i) => i.session_id === session.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const { unitKeyById, unitById } = buildUnitMaps(structure.units)
  const programExerciseById = new Map(
    structure.programExercises.map((pe) => [pe.id, pe] as const),
  )
  const blockById = new Map(structure.sessionBlocks.map((b) => [b.id, b] as const))
  const blockExercisesByBlockId = new Map<string, PreviewBlockExerciseRow[]>()
  for (const be of structure.blockExercises) {
    const list = blockExercisesByBlockId.get(be.session_block_id) ?? []
    list.push(be)
    blockExercisesByBlockId.set(be.session_block_id, list)
  }

  const items: SnapshotItem[] = []

  if (sessionItems.length === 0) {
    const exercises = structure.programExercises
      .filter((pe) => pe.session_id === session.id)
      .sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0))
    for (const pe of exercises) items.push(toSnapshotExercise(pe, { unitKeyById, unitById }))
  } else {
    for (const item of sessionItems) {
      if (isExerciseKind(item.kind) && item.program_exercise_id) {
        const pe = programExerciseById.get(item.program_exercise_id)
        if (pe) {
          items.push(
            toSnapshotExercise(pe, {
              prescriptions: item.prescriptions,
              unitKeyById,
              unitById,
            }),
          )
        }
        continue
      }
      if (isBlockKind(item.kind) && item.session_block_id) {
        const block = blockById.get(item.session_block_id)
        if (block) {
          const exos = (blockExercisesByBlockId.get(block.id) ?? [])
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          items.push(toSnapshotBlock(block, exos, { unitKeyById, unitById }))
        }
      }
    }
  }

  return {
    version: 1,
    session_id: session.id,
    title: session.title?.trim() || `Séance ${(session.session_order ?? 0) + 1}`,
    items,
  }
}

export function emptyRealized(snapshot: SessionRunSnapshot): SessionRunRealized {
  const items: SessionRunRealized['items'] = {}
  for (const item of snapshot.items) {
    if (item.kind === 'exercise') {
      const sets = buildEmptySetsForExercise(item)
      items[item.id] = {
        status: 'pending',
        ...(sets.length ? { sets } : {}),
      }
    } else {
      const blockExercises: Record<string, { status: ItemRunStatus }> = {}
      for (const ex of item.exercises) {
        blockExercises[ex.id] = { status: 'pending' }
      }
      items[item.id] = { status: 'pending', blockExercises }
    }
  }
  return { version: 1, items }
}

/** Assure sets[] présents pour un exo (reprise anciennes runs). */
export function ensureExerciseSets(
  realized: SessionRunRealized,
  item: SnapshotExercise
): SessionRunRealized {
  const entry = realized.items[item.id]
  if (entry?.sets?.length) return realized
  const sets = buildEmptySetsForExercise(item)
  return {
    ...realized,
    items: {
      ...realized.items,
      [item.id]: {
        status: entry?.status ?? 'pending',
        note: entry?.note ?? null,
        ...(sets.length ? { sets } : {}),
        blockExercises: entry?.blockExercises,
      },
    },
  }
}

export function markPendingAsNonFait(realized: SessionRunRealized): SessionRunRealized {
  const next: SessionRunRealized['items'] = { ...realized.items }
  for (const [id, entry] of Object.entries(next)) {
    if (entry.status === 'pending' || entry.status === 'partiel') {
      const fromSets = resolveExerciseStatusFromSets(entry.sets, 'non_fait')
      // partiel si des séries sont faites, sinon non_fait
      next[id] = {
        ...entry,
        status: fromSets === 'fait' ? 'fait' : fromSets === 'partiel' ? 'partiel' : 'non_fait',
      }
    }
  }
  return { version: 1, items: next }
}

export function hasAnyFait(realized: SessionRunRealized | null | undefined): boolean {
  if (!realized?.items) return false
  return Object.values(realized.items).some((e) => e.status === 'fait' || e.status === 'partiel')
}

export function hasNonFaitOrPartial(realized: SessionRunRealized | null | undefined): boolean {
  if (!realized?.items) return false
  const values = Object.values(realized.items)
  if (!values.length) return false
  return values.some(
    (e) => e.status === 'non_fait' || e.status === 'pending' || e.status === 'partiel'
  )
}

export function resolveFinishStyle(realized: SessionRunRealized): SessionRunStyle {
  if (hasNonFaitOrPartial(realized) && hasAnyFait(realized)) return 'fait_edite'
  if (hasAnyFait(realized) && !hasNonFaitOrPartial(realized)) return 'fait'
  if (hasAnyFait(realized)) return 'fait_edite'
  return 'pas_fait'
}

export type RunHistorySummary = {
  total: number
  fait: number
  partiel: number
  nonFait: number
  pending: number
  setsDone: number
  setsTotal: number
}

export function summarizeRun(
  snapshot: SessionRunSnapshot | null | undefined,
  realized: SessionRunRealized | null | undefined
): RunHistorySummary {
  const items = snapshot?.items ?? []
  let fait = 0
  let partiel = 0
  let nonFait = 0
  let pending = 0
  let setsDone = 0
  let setsTotal = 0

  for (const item of items) {
    const entry = realized?.items?.[item.id]
    const status = entry?.status ?? 'pending'
    if (status === 'fait') fait++
    else if (status === 'partiel') partiel++
    else if (status === 'non_fait') nonFait++
    else pending++

    if (item.kind === 'exercise') {
      const sets = entry?.sets
      if (sets?.length) {
        setsTotal += sets.length
        setsDone += sets.filter((s) => s.done).length
      } else {
        const n = parseSetsCount(item.sets)
        setsTotal += n
        if (status === 'fait') setsDone += n
      }
    }
  }

  return {
    total: items.length,
    fait,
    partiel,
    nonFait,
    pending,
    setsDone,
    setsTotal,
  }
}

export function formatSetLine(set: RealizedSet): string {
  return [set.reps && `${set.reps} reps`, set.load, set.rpe && `RPE ${set.rpe}`]
    .filter(Boolean)
    .join(' · ')
}
