import type {
  RealizedSet,
  SessionRunRealized,
  SessionRunRow,
  SessionRunSnapshot,
  SnapshotBlock,
  SnapshotExercise,
} from './sessionRuns'

export type HistoryTargetType = 'exercise' | 'block'

export type DecodedItemId =
  | { kind: 'exercise'; targetId: string; itemId: string }
  | { kind: 'block'; targetId: string; itemId: string }

export type HistoryFavoriteKey = {
  targetType: HistoryTargetType
  targetId: string
}

export type HistoryLandRow = {
  itemId: string
  kind: HistoryTargetType
  targetId: string
  name: string
  metricPreview: string
  lastActivityAt: string
  isFavorite: boolean
  occurrenceCount: number
}

export type ItemOccurrence = {
  runId: string
  runTitle: string | null
  at: string
  status: string
  preview: string
}

export type WeeklyBucket = {
  weekKey: string
  label: string
  setsCount: number
  tonnage: number
}

export type ExerciseItemHistory = {
  kind: 'exercise'
  itemId: string
  targetId: string
  name: string
  notes: string | null
  exerciseLibraryId: string | null
  occurrences: ItemOccurrence[]
  bestSetPreview: string | null
  estimated1Rm: number | null
  maxLoad: number | null
  maxReps: number | null
  maxSessionTonnage: number | null
  maxSetsPerWeek: number | null
  weekly: WeeklyBucket[]
  aboutMediaUrl: string | null
}

export type BlockChildExercise = {
  itemId: string | null
  name: string
  exerciseLibraryId: string | null
}

export type BlockItemHistory = {
  kind: 'block'
  itemId: string
  targetId: string
  name: string
  type: string
  notes: string | null
  objective: string | null
  occurrences: ItemOccurrence[]
  completionRate: number | null
  maxSessionTonnage: number | null
  maxCompletionsPerWeek: number | null
  weekly: WeeklyBucket[]
  children: BlockChildExercise[]
}

export type ItemHistory = ExerciseItemHistory | BlockItemHistory

function slugPart(raw: string): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'x'
}

export function blockFingerprint(title: string, type: string | null | undefined): string {
  return `${slugPart(title)}__${slugPart(type || 'circuit')}`
}

export function exerciseTargetId(
  exerciseId: string | null | undefined,
  snapshotItemId: string
): string {
  if (exerciseId && String(exerciseId).trim()) return String(exerciseId)
  return `local:${snapshotItemId}`
}

export function encodeItemId(kind: HistoryTargetType, targetId: string): string {
  if (kind === 'exercise') {
    if (targetId.startsWith('local:')) return `exo-local-${targetId.slice('local:'.length)}`
    return `exo-${targetId}`
  }
  return `bloc-${targetId}`
}

export function decodeItemId(itemId: string): DecodedItemId | null {
  const raw = String(itemId ?? '').trim()
  if (!raw) return null
  if (raw.startsWith('exo-local-')) {
    const id = raw.slice('exo-local-'.length)
    if (!id) return null
    return { kind: 'exercise', targetId: `local:${id}`, itemId: raw }
  }
  if (raw.startsWith('exo-')) {
    const id = raw.slice('exo-'.length)
    if (!id) return null
    return { kind: 'exercise', targetId: id, itemId: raw }
  }
  if (raw.startsWith('bloc-')) {
    const id = raw.slice('bloc-'.length)
    if (!id) return null
    return { kind: 'block', targetId: id, itemId: raw }
  }
  return null
}

export function favoriteKeyFromItemId(itemId: string): HistoryFavoriteKey | null {
  const d = decodeItemId(itemId)
  if (!d) return null
  return { targetType: d.kind, targetId: d.targetId }
}

function runActivityAt(run: SessionRunRow): string {
  return run.finished_at || run.actual_date || run.started_at || run.created_at
}

function runDayKey(run: SessionRunRow): string | null {
  const src = run.actual_date || (run.finished_at ? run.finished_at.slice(0, 10) : null)
  return src || null
}

function parseLoadKg(load: string | null | undefined): number | null {
  if (load == null || load === '') return null
  const m = String(load).replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseRepsNum(reps: string | null | undefined): number | null {
  if (reps == null || reps === '') return null
  const m = String(reps).match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Epley: 1RM ≈ w * (1 + r/30) */
export function estimate1Rm(loadKg: number, reps: number): number | null {
  if (!(loadKg > 0) || !(reps > 0)) return null
  if (reps === 1) return Math.round(loadKg * 10) / 10
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10
}

function setTonnage(set: RealizedSet): number {
  if (!set.done) return 0
  const w = parseLoadKg(set.load)
  const r = parseRepsNum(set.reps)
  if (w == null || r == null) return 0
  return w * r
}

function formatSetPreview(set: RealizedSet): string {
  return [set.reps && `${set.reps} reps`, set.load].filter(Boolean).join(' · ') || 'Série'
}

function weekKeyFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const day = d.getUTCDay() || 7
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  monday.setUTCDate(monday.getUTCDate() - (day - 1))
  return monday.toISOString().slice(0, 10)
}

function weekLabel(weekKey: string): string {
  const d = new Date(`${weekKey}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return weekKey
  return `Sem. ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}

type FavSet = Set<string>

function favSetKey(type: HistoryTargetType, id: string) {
  return `${type}:${id}`
}

export function buildFavoriteSet(
  favorites: Array<{ target_type: string; target_id: string }>
): FavSet {
  const s = new Set<string>()
  for (const f of favorites) {
    if (f.target_type === 'exercise' || f.target_type === 'block') {
      s.add(favSetKey(f.target_type, f.target_id))
    }
  }
  return s
}

type AccExercise = {
  kind: 'exercise'
  targetId: string
  name: string
  notes: string | null
  exerciseLibraryId: string | null
  lastActivityAt: string
  occurrenceCount: number
  lastPreview: string
  aboutMediaUrl: string | null
}

type AccBlock = {
  kind: 'block'
  targetId: string
  name: string
  type: string
  notes: string | null
  objective: string | null
  lastActivityAt: string
  occurrenceCount: number
  lastPreview: string
  lastChildren: BlockChildExercise[]
}

function exercisePreviewFromRealized(
  item: SnapshotExercise,
  realized: SessionRunRealized | null | undefined
): string {
  const entry = realized?.items?.[item.id]
  const doneSets = (entry?.sets ?? []).filter((s) => s.done)
  if (doneSets.length) {
    const last = doneSets[doneSets.length - 1]
    return formatSetPreview(last)
  }
  if (entry?.status === 'fait') return 'Fait'
  if (entry?.status === 'partiel') return 'Partiel'
  if (entry?.status === 'non_fait') return 'Non fait'
  const parts = [item.sets != null && `${item.sets}×`, item.reps, item.load].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

function blockPreviewFromRealized(
  item: SnapshotBlock,
  realized: SessionRunRealized | null | undefined
): string {
  const entry = realized?.items?.[item.id]
  if (entry?.status === 'fait') return 'Bloc fait'
  if (entry?.status === 'partiel') return 'Partiel'
  if (entry?.status === 'non_fait') return 'Non fait'
  const n = item.exercises.length
  return n ? `${n} exo${n > 1 ? 's' : ''}` : 'Bloc'
}

function wasDone(status: string | undefined): boolean {
  return status === 'fait' || status === 'partiel'
}

/** Land: 1 ligne / exo standalone + 1 / bloc (pas d’exo imbriqué). */
export function buildHistoryLandRows(
  runs: SessionRunRow[],
  favorites: FavSet
): HistoryLandRow[] {
  const map = new Map<string, AccExercise | AccBlock>()

  const sorted = [...runs].sort(
    (a, b) => new Date(runActivityAt(b)).getTime() - new Date(runActivityAt(a)).getTime()
  )

  for (const run of sorted) {
    const at = runActivityAt(run)
    const snapshot = run.snapshot as SessionRunSnapshot | null
    const realized = run.realized as SessionRunRealized | null
    if (!snapshot?.items?.length) continue

    for (const item of snapshot.items) {
      if (item.kind === 'exercise') {
        const entry = realized?.items?.[item.id]
        if (!wasDone(entry?.status) && !(entry?.sets ?? []).some((s) => s.done)) continue

        const targetId = exerciseTargetId(item.exercise_id, item.id)
        const key = favSetKey('exercise', targetId)
        const existing = map.get(key) as AccExercise | undefined
        const preview = exercisePreviewFromRealized(item, realized)
        if (!existing) {
          map.set(key, {
            kind: 'exercise',
            targetId,
            name: item.name,
            notes: item.notes,
            exerciseLibraryId: item.exercise_id,
            lastActivityAt: at,
            occurrenceCount: 1,
            lastPreview: preview,
            aboutMediaUrl: item.demo_media_url ?? null,
          })
        } else {
          existing.occurrenceCount += 1
          if (new Date(at).getTime() > new Date(existing.lastActivityAt).getTime()) {
            existing.lastActivityAt = at
            existing.lastPreview = preview
            existing.name = item.name
            existing.notes = item.notes
            existing.aboutMediaUrl = item.demo_media_url ?? existing.aboutMediaUrl
          }
        }
      } else if (item.kind === 'block') {
        const entry = realized?.items?.[item.id]
        const childDone = Object.values(entry?.blockExercises ?? {}).some((c) =>
          wasDone(c.status)
        )
        if (!wasDone(entry?.status) && !childDone) continue

        const targetId = blockFingerprint(item.title, item.type)
        const key = favSetKey('block', targetId)
        const existing = map.get(key) as AccBlock | undefined
        const preview = blockPreviewFromRealized(item, realized)
        const children: BlockChildExercise[] = item.exercises.map((ex) => ({
          itemId: ex.exercise_id
            ? encodeItemId('exercise', ex.exercise_id)
            : encodeItemId('exercise', exerciseTargetId(null, ex.id)),
          name: ex.name,
          exerciseLibraryId: ex.exercise_id,
        }))
        if (!existing) {
          map.set(key, {
            kind: 'block',
            targetId,
            name: item.title,
            type: item.type,
            notes: item.notes,
            objective: item.objective ?? null,
            lastActivityAt: at,
            occurrenceCount: 1,
            lastPreview: preview,
            lastChildren: children,
          })
        } else {
          existing.occurrenceCount += 1
          if (new Date(at).getTime() > new Date(existing.lastActivityAt).getTime()) {
            existing.lastActivityAt = at
            existing.lastPreview = preview
            existing.name = item.title
            existing.type = item.type
            existing.notes = item.notes
            existing.objective = item.objective ?? existing.objective
            existing.lastChildren = children
          }
        }
      }
    }
  }

  const rows: HistoryLandRow[] = []
  for (const acc of map.values()) {
    const itemId = encodeItemId(acc.kind, acc.targetId)
    rows.push({
      itemId,
      kind: acc.kind,
      targetId: acc.targetId,
      name: acc.name,
      metricPreview: acc.lastPreview,
      lastActivityAt: acc.lastActivityAt,
      isFavorite: favorites.has(favSetKey(acc.kind, acc.targetId)),
      occurrenceCount: acc.occurrenceCount,
    })
  }

  rows.sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  )
  return rows
}

export type DayHistoryItems = {
  day: string
  items: Array<{ itemId: string; kind: HistoryTargetType; name: string }>
}

/** Calendrier pop-up : jours avec runs → blocs + exos standalone (pas d’exo imbriqué). */
export function buildHistoryCalendarDays(runs: SessionRunRow[]): DayHistoryItems[] {
  const byDay = new Map<string, Map<string, { itemId: string; kind: HistoryTargetType; name: string }>>()

  for (const run of runs) {
    const day = runDayKey(run)
    if (!day) continue
    const snapshot = run.snapshot as SessionRunSnapshot | null
    const realized = run.realized as SessionRunRealized | null
    if (!snapshot?.items?.length) continue

    let bucket = byDay.get(day)
    if (!bucket) {
      bucket = new Map()
      byDay.set(day, bucket)
    }

    for (const item of snapshot.items) {
      if (item.kind === 'exercise') {
        const entry = realized?.items?.[item.id]
        if (!wasDone(entry?.status) && !(entry?.sets ?? []).some((s) => s.done)) continue
        const targetId = exerciseTargetId(item.exercise_id, item.id)
        const itemId = encodeItemId('exercise', targetId)
        bucket.set(itemId, { itemId, kind: 'exercise', name: item.name })
      } else if (item.kind === 'block') {
        const entry = realized?.items?.[item.id]
        const childDone = Object.values(entry?.blockExercises ?? {}).some((c) =>
          wasDone(c.status)
        )
        if (!wasDone(entry?.status) && !childDone) continue
        const targetId = blockFingerprint(item.title, item.type)
        const itemId = encodeItemId('block', targetId)
        bucket.set(itemId, { itemId, kind: 'block', name: item.title })
      }
    }
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, map]) => ({ day, items: Array.from(map.values()) }))
}

function matchExerciseItem(
  item: SnapshotExercise,
  targetId: string
): boolean {
  return exerciseTargetId(item.exercise_id, item.id) === targetId
}

function matchBlockItem(item: SnapshotBlock, targetId: string): boolean {
  return blockFingerprint(item.title, item.type) === targetId
}

function collectExerciseSetsFromRun(
  run: SessionRunRow,
  targetId: string
): { sets: RealizedSet[]; name: string; notes: string | null; media: string | null; libraryId: string | null; status: string } | null {
  const snapshot = run.snapshot as SessionRunSnapshot | null
  const realized = run.realized as SessionRunRealized | null
  if (!snapshot?.items) return null

  let name = 'Exercice'
  let notes: string | null = null
  let media: string | null = null
  let libraryId: string | null = null
  let status = 'pending'
  const sets: RealizedSet[] = []

  for (const item of snapshot.items) {
    if (item.kind === 'exercise' && matchExerciseItem(item, targetId)) {
      const entry = realized?.items?.[item.id]
      name = item.name
      notes = item.notes
      media = item.demo_media_url ?? null
      libraryId = item.exercise_id
      status = entry?.status ?? 'pending'
      for (const s of entry?.sets ?? []) if (s.done) sets.push(s)
      return { sets, name, notes, media, libraryId, status }
    }
    if (item.kind === 'block') {
      for (const ex of item.exercises) {
        const exTarget = exerciseTargetId(ex.exercise_id, ex.id)
        if (exTarget !== targetId) continue
        // Nested: no sets in V1 blockExercises — count as fait if parent/child status
        const parent = realized?.items?.[item.id]
        const child = parent?.blockExercises?.[ex.id]
        name = ex.name
        notes = ex.notes
        media = ex.demo_media_url ?? null
        libraryId = ex.exercise_id
        status = child?.status ?? parent?.status ?? 'pending'
        return { sets, name, notes, media, libraryId, status }
      }
    }
  }
  return null
}

export function buildItemHistory(itemId: string, runs: SessionRunRow[]): ItemHistory | null {
  const decoded = decodeItemId(itemId)
  if (!decoded) return null

  if (decoded.kind === 'exercise') {
    return buildExerciseHistory(decoded.itemId, decoded.targetId, runs)
  }
  return buildBlockHistory(decoded.itemId, decoded.targetId, runs)
}

function buildExerciseHistory(
  itemId: string,
  targetId: string,
  runs: SessionRunRow[]
): ExerciseItemHistory | null {
  const occurrences: ItemOccurrence[] = []
  const weeklyMap = new Map<string, WeeklyBucket>()
  let name = 'Exercice'
  let notes: string | null = null
  let libraryId: string | null = null
  let media: string | null = null
  let bestSet: RealizedSet | null = null
  let best1Rm: number | null = null
  let maxLoad: number | null = null
  let maxReps: number | null = null
  let maxSessionTonnage: number | null = null

  const sorted = [...runs].sort(
    (a, b) => new Date(runActivityAt(b)).getTime() - new Date(runActivityAt(a)).getTime()
  )

  for (const run of sorted) {
    const hit = collectExerciseSetsFromRun(run, targetId)
    if (!hit) continue
    if (!wasDone(hit.status) && !hit.sets.length) continue

    name = hit.name
    notes = hit.notes
    libraryId = hit.libraryId
    media = hit.media ?? media

    const at = runActivityAt(run)
    let sessionTonnage = 0
    let setsCount = 0
    for (const s of hit.sets) {
      setsCount += 1
      sessionTonnage += setTonnage(s)
      const w = parseLoadKg(s.load)
      const r = parseRepsNum(s.reps)
      if (w != null && (maxLoad == null || w > maxLoad)) maxLoad = w
      if (r != null && (maxReps == null || r > maxReps)) maxReps = r
      if (w != null && r != null) {
        const e = estimate1Rm(w, r)
        if (e != null && (best1Rm == null || e > best1Rm)) best1Rm = e
        if (
          !bestSet ||
          (e != null &&
            estimate1Rm(parseLoadKg(bestSet.load) ?? 0, parseRepsNum(bestSet.reps) ?? 0) != null &&
            e >
              (estimate1Rm(parseLoadKg(bestSet.load) ?? 0, parseRepsNum(bestSet.reps) ?? 0) ?? 0))
        ) {
          bestSet = s
        }
      }
    }
    if (maxSessionTonnage == null || sessionTonnage > maxSessionTonnage) {
      maxSessionTonnage = sessionTonnage
    }

    const wk = weekKeyFromIso(at)
    const bucket = weeklyMap.get(wk) ?? {
      weekKey: wk,
      label: weekLabel(wk),
      setsCount: 0,
      tonnage: 0,
    }
    bucket.setsCount += setsCount || (wasDone(hit.status) ? 1 : 0)
    bucket.tonnage += sessionTonnage
    weeklyMap.set(wk, bucket)

    occurrences.push({
      runId: run.id,
      runTitle: run.title,
      at,
      status: hit.status,
      preview:
        hit.sets.length > 0
          ? hit.sets.map(formatSetPreview).join(' · ')
          : hit.status === 'fait'
            ? 'Fait'
            : hit.status,
    })
  }

  if (!occurrences.length) return null

  const weekly = Array.from(weeklyMap.values()).sort((a, b) =>
    b.weekKey.localeCompare(a.weekKey)
  )
  const maxSetsPerWeek = weekly.reduce((m, w) => Math.max(m, w.setsCount), 0) || null

  return {
    kind: 'exercise',
    itemId,
    targetId,
    name,
    notes,
    exerciseLibraryId: libraryId,
    occurrences,
    bestSetPreview: bestSet ? formatSetPreview(bestSet) : null,
    estimated1Rm: best1Rm,
    maxLoad,
    maxReps,
    maxSessionTonnage: maxSessionTonnage && maxSessionTonnage > 0 ? maxSessionTonnage : null,
    maxSetsPerWeek,
    weekly,
    aboutMediaUrl: media,
  }
}

function buildBlockHistory(
  itemId: string,
  targetId: string,
  runs: SessionRunRow[]
): BlockItemHistory | null {
  const occurrences: ItemOccurrence[] = []
  const weeklyMap = new Map<string, WeeklyBucket>()
  let name = 'Bloc'
  let type = 'circuit'
  let notes: string | null = null
  let objective: string | null = null
  let children: BlockChildExercise[] = []
  let doneCount = 0
  let totalCount = 0
  let maxSessionTonnage: number | null = null

  const sorted = [...runs].sort(
    (a, b) => new Date(runActivityAt(b)).getTime() - new Date(runActivityAt(a)).getTime()
  )

  for (const run of sorted) {
    const snapshot = run.snapshot as SessionRunSnapshot | null
    const realized = run.realized as SessionRunRealized | null
    if (!snapshot?.items) continue

    for (const item of snapshot.items) {
      if (item.kind !== 'block' || !matchBlockItem(item, targetId)) continue
      const entry = realized?.items?.[item.id]
      const childDone = Object.values(entry?.blockExercises ?? {}).some((c) => wasDone(c.status))
      if (!wasDone(entry?.status) && !childDone) continue

      totalCount += 1
      const isComplete = entry?.status === 'fait'
      if (isComplete) doneCount += 1

      name = item.title
      type = item.type
      notes = item.notes
      objective = item.objective ?? objective
      children = item.exercises.map((ex) => ({
        itemId: encodeItemId('exercise', exerciseTargetId(ex.exercise_id, ex.id)),
        name: ex.name,
        exerciseLibraryId: ex.exercise_id,
      }))

      // Approx tonnage from nested — no sets V1 → 0
      const sessionTonnage = 0
      if (maxSessionTonnage == null || sessionTonnage > maxSessionTonnage) {
        maxSessionTonnage = sessionTonnage
      }

      const at = runActivityAt(run)
      const wk = weekKeyFromIso(at)
      const bucket = weeklyMap.get(wk) ?? {
        weekKey: wk,
        label: weekLabel(wk),
        setsCount: 0,
        tonnage: 0,
      }
      if (isComplete) bucket.setsCount += 1
      weeklyMap.set(wk, bucket)

      occurrences.push({
        runId: run.id,
        runTitle: run.title,
        at,
        status: entry?.status ?? 'pending',
        preview: blockPreviewFromRealized(item, realized),
      })
    }
  }

  if (!occurrences.length) return null

  const weekly = Array.from(weeklyMap.values()).sort((a, b) =>
    b.weekKey.localeCompare(a.weekKey)
  )
  const maxCompletionsPerWeek = weekly.reduce((m, w) => Math.max(m, w.setsCount), 0) || null

  return {
    kind: 'block',
    itemId,
    targetId,
    name,
    type,
    notes,
    objective,
    occurrences,
    completionRate: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : null,
    maxSessionTonnage: maxSessionTonnage && maxSessionTonnage > 0 ? maxSessionTonnage : null,
    maxCompletionsPerWeek,
    weekly,
    children,
  }
}
