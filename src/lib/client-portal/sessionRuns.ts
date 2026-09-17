import type {
  PreviewBlockExerciseRow,
  PreviewProgramExerciseRow,
  PreviewSessionBlockRow,
  PreviewSessionItemRow,
  PreviewSessionRow,
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

function toSnapshotExercise(pe: PreviewProgramExerciseRow): SnapshotExercise {
  return {
    id: pe.id,
    kind: 'exercise',
    name: pe.exercise_library?.name ?? pe.name ?? 'Exercice',
    exercise_id: pe.exercise_id,
    sets: pe.sets,
    reps: pe.reps,
    rest_time: pe.rest_time,
    rpe: pe.rpe,
    load: pe.load,
    tempo: pe.tempo,
    notes: pe.notes,
    demo_media_url: pe.demo_media_url ?? null,
  }
}

function toSnapshotBlock(
  block: PreviewSessionBlockRow,
  exercises: PreviewBlockExerciseRow[]
): SnapshotBlock {
  return {
    id: block.id,
    kind: 'block',
    title: block.title?.trim() || block.type || 'Bloc',
    type: block.type,
    notes: block.notes,
    objective: block.objective ?? null,
    exercises: exercises.map((be) => ({
      id: be.id,
      name: be.exercise_library?.name ?? be.exercise_name ?? 'Exercice',
      exercise_id: be.exercise_id,
      sets: be.sets,
      reps: be.reps,
      load_text: be.load_text,
      rest_seconds: be.rest_seconds,
      notes: be.notes,
      demo_media_url: be.demo_media_url ?? null,
    })),
  }
}

export function buildSessionSnapshot(
  session: PreviewSessionRow,
  structure: Pick<
    ProgramPreviewStructure,
    'sessionItems' | 'sessionBlocks' | 'blockExercises' | 'programExercises'
  >
): SessionRunSnapshot {
  const sessionItems = (structure.sessionItems as PreviewSessionItemRow[])
    .filter((i) => i.session_id === session.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const programExerciseById = new Map(
    structure.programExercises.map((pe) => [pe.id, pe] as const)
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
    for (const pe of exercises) items.push(toSnapshotExercise(pe))
  } else {
    for (const item of sessionItems) {
      if (isExerciseKind(item.kind) && item.program_exercise_id) {
        const pe = programExerciseById.get(item.program_exercise_id)
        if (pe) items.push(toSnapshotExercise(pe))
        continue
      }
      if (isBlockKind(item.kind) && item.session_block_id) {
        const block = blockById.get(item.session_block_id)
        if (block) {
          const exos = (blockExercisesByBlockId.get(block.id) ?? []).slice().sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0)
          )
          items.push(toSnapshotBlock(block, exos))
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
