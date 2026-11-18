import type { SupabaseClient } from '@supabase/supabase-js'

import {
  type ItemRunStatus,
  type SessionRunRealized,
  type SessionRunSnapshot,
  type SessionRunStyle,
  type SnapshotBlock,
  type SnapshotExercise,
  type SnapshotItem,
  buildSessionSnapshot,
} from '@/src/lib/client-portal/sessionRuns'
import { fetchProgramPreviewStructure } from '@/src/lib/fetchProgramPreviewStructure'

export type ComplianceLevel = 'conforme' | 'adapte' | 'non_fait' | 'neutre'

export type PlanFicheDemandLine = {
  text: string
  coachNote?: string | null
}

/** Une ligne réalisée : métrique série ou note (même format S#) */
export type PlanFicheRealizedRow = {
  kind: 'set' | 'note' | 'status'
  text: string
}

export type PlanFicheRealizedLine = {
  /** Résumé si pas de sets (Fait / Non fait…) */
  summary: string | null
  rows: PlanFicheRealizedRow[]
  level: ComplianceLevel
  /** true si le coach n’avait rien prescrit (RX vide). */
  noDemand: boolean
}

export type PlanFicheExerciseView = {
  id: string
  kind: 'exercise'
  name: string
  demand: PlanFicheDemandLine
  realized: PlanFicheRealizedLine
}

export type PlanFicheBlockExerciseView = {
  id: string
  name: string
  demand: PlanFicheDemandLine
  realized: PlanFicheRealizedLine
}

export type PlanFicheBlockView = {
  id: string
  kind: 'block'
  title: string
  type: string
  coachNotes: string | null
  level: ComplianceLevel
  exercises: PlanFicheBlockExerciseView[]
  blockNote: string | null
}

export type PlanFicheItemView = PlanFicheExerciseView | PlanFicheBlockView

export type PlanFicheSessionView = {
  key: string
  sessionId: string | null
  runId: string | null
  title: string
  scheduledDate: string | null
  actualDate: string | null
  style: SessionRunStyle | null
  level: ComplianceLevel
  isFuture: boolean
  sessionComment: string | null
  coachComments: PlanFicheCoachComment[]
  items: PlanFicheItemView[]
}

export type PlanFicheCoachComment = {
  id: string
  text: string
  createdAt: string
}

export type PlanFicheWeekView = {
  weekIndex: number
  label: string
  sessions: PlanFicheSessionView[]
}

export type PlanFicheData = {
  planId: string
  /** Instance client (éditable) — ou template legacy. */
  programId: string | null
  /** Template hub d’origine (si photocopie). */
  templateProgramId: string | null
  programTitle: string
  clientId: string
  clientLabel: string
  status: string
  startLabel: string
  weeks: PlanFicheWeekView[]
}

function displayName(c: {
  first_name: string | null
  last_name: string | null
  email: string
}) {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || c.email
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDemandExercise(item: SnapshotExercise): string {
  if (item.rx_lines?.length) return item.rx_lines.join('\n')
  const rx =
    item.sets != null && item.sets !== '' && item.reps != null && item.reps !== ''
      ? `${item.sets}×${item.reps}`
      : [item.sets != null && item.sets !== '' ? `${item.sets} sér.` : null, item.reps != null && item.reps !== '' ? `${item.reps} reps` : null]
          .filter(Boolean)
          .join(' ')
  return [rx || null, item.load || null, item.rpe != null ? `RPE ${item.rpe}` : null, item.rest_time ? `repos ${item.rest_time}` : null, item.tempo ? `tempo ${item.tempo}` : null]
    .filter(Boolean)
    .join(' · ')
}

function formatDemandBlockEx(ex: SnapshotBlock['exercises'][number]): string {
  if (ex.rx_lines?.length) return ex.rx_lines.join('\n')
  const rx =
    ex.sets != null && ex.sets !== '' && ex.reps != null && ex.reps !== ''
      ? `${ex.sets}×${ex.reps}`
      : [ex.sets != null && ex.sets !== '' ? `${ex.sets} sér.` : null, ex.reps != null && ex.reps !== '' ? `${ex.reps} reps` : null]
          .filter(Boolean)
          .join(' ')
  return [rx || null, ex.load_text || null, ex.rest_seconds != null ? `repos ${ex.rest_seconds}s` : null]
    .filter(Boolean)
    .join(' · ')
}

function hasDemandText(text: string) {
  return Boolean(text && text !== '—' && text !== 'Non programmé')
}

function statusToLevel(
  status: ItemRunStatus | undefined,
  isFuture: boolean,
  hasDemand: boolean,
): ComplianceLevel {
  if (isFuture || !status || status === 'pending') return 'neutre'
  if (status === 'non_fait') return 'non_fait'
  if (status === 'partiel') return 'adapte'
  // fait : « conforme » seulement s’il y avait une prescription à suivre
  if (status === 'fait') return hasDemand ? 'conforme' : 'neutre'
  return 'neutre'
}

function styleToLevel(style: SessionRunStyle | null, isFuture: boolean): ComplianceLevel {
  if (isFuture || !style) return 'neutre'
  if (style === 'fait') return 'conforme'
  if (style === 'fait_edite' || style === 'libre' || style === 'en_cours') return 'adapte'
  if (style === 'pas_fait') return 'non_fait'
  return 'neutre'
}

function formatSetMetric(s: { reps: string | null; load: string | null; rpe: string | null; done: boolean }) {
  const parts = [
    s.reps ? `${s.reps} reps` : null,
    s.load || null,
    s.rpe ? `RPE ${s.rpe}` : null,
  ].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return s.done ? 'OK' : '—'
}

function realizedExerciseLine(
  item: SnapshotExercise,
  realized: SessionRunRealized | null,
  isFuture: boolean,
): PlanFicheRealizedLine {
  const entry = realized?.items?.[item.id]
  const demand = formatDemandExercise(item)
  const noDemand = !hasDemandText(demand)
  const level = statusToLevel(entry?.status, isFuture, !noDemand)
  const rows: PlanFicheRealizedRow[] = []

  const sets = entry?.sets ?? []
  const usefulSets = sets.filter((s) => s.done || s.reps || s.load || s.note || s.rpe)
  if (usefulSets.length) {
    usefulSets.forEach((s, i) => {
      const n = i + 1
      rows.push({ kind: 'set', text: `S${n} · ${formatSetMetric(s)}` })
      if (s.note?.trim()) {
        rows.push({ kind: 'note', text: s.note.trim() })
      }
    })
    // Écart sets vs RX → adapté
    let finalLevel = level
    if (!noDemand && entry?.status === 'fait') {
      const edited = usefulSets.some((s) => {
        const demandReps = item.reps != null ? String(item.reps) : null
        const demandLoad = item.load != null ? String(item.load) : null
        return (
          (demandReps && s.reps && s.reps !== demandReps) ||
          (demandLoad && s.load && s.load !== demandLoad)
        )
      })
      if (edited) finalLevel = 'adapte'
    }
    if (entry?.note?.trim()) {
      rows.push({ kind: 'note', text: entry.note.trim() })
    }
    return { summary: null, rows, level: finalLevel, noDemand }
  }

  if (entry?.note?.trim()) {
    rows.push({ kind: 'note', text: entry.note.trim() })
  }

  if (isFuture || !entry || entry.status === 'pending') {
    return { summary: null, rows, level: 'neutre', noDemand }
  }
  if (entry.status === 'non_fait') {
    return { summary: 'Non fait', rows, level: 'non_fait', noDemand }
  }
  if (entry.status === 'fait') {
    return {
      summary: noDemand ? 'Fait (rien de prescrit)' : 'Fait',
      rows,
      level,
      noDemand,
    }
  }
  return { summary: 'Partiel', rows, level: 'adapte', noDemand }
}

function mapSnapshotItems(
  snapshot: SessionRunSnapshot | null,
  realized: SessionRunRealized | null,
  isFuture: boolean,
): PlanFicheItemView[] {
  if (!snapshot?.items?.length) return []

  return snapshot.items.map((item: SnapshotItem) => {
    if (item.kind === 'exercise') {
      const demandText = formatDemandExercise(item)
      return {
        id: item.id,
        kind: 'exercise' as const,
        name: item.name,
        demand: {
          text: demandText || 'Non programmé',
          coachNote: item.notes,
        },
        realized: realizedExerciseLine(item, realized, isFuture),
      }
    }

    const block = item as SnapshotBlock
    const entry = realized?.items?.[block.id]
    const exercises = block.exercises.map((ex) => {
      const demandText = formatDemandBlockEx(ex)
      const noDemand = !hasDemandText(demandText || 'Non programmé')
      const st = entry?.blockExercises?.[ex.id]?.status
      const level = statusToLevel(st, isFuture, !noDemand)
      let summary: string | null = null
      if (!isFuture && st === 'fait') summary = noDemand ? 'Fait (rien de prescrit)' : 'Fait'
      else if (!isFuture && st === 'partiel') summary = 'Partiel'
      else if (!isFuture && st === 'non_fait') summary = 'Non fait'
      return {
        id: ex.id,
        name: ex.name,
        demand: {
          text: demandText || 'Non programmé',
          coachNote: ex.notes,
        },
        realized: {
          summary,
          rows: [] as PlanFicheRealizedRow[],
          level,
          noDemand,
        },
      }
    })

    const levels = exercises.map((e) => e.realized.level)
    const blockHasDemand = exercises.some((e) => !e.realized.noDemand)
    let blockLevel: ComplianceLevel = statusToLevel(entry?.status, isFuture, blockHasDemand)
    if (blockLevel === 'neutre' && !isFuture && levels.length) {
      if (levels.every((l) => l === 'conforme')) blockLevel = 'conforme'
      else if (levels.some((l) => l === 'non_fait') && levels.every((l) => l === 'non_fait' || l === 'neutre'))
        blockLevel = 'non_fait'
      else if (levels.some((l) => l === 'adapte' || l === 'conforme' || l === 'non_fait'))
        blockLevel = 'adapte'
    }

    return {
      id: block.id,
      kind: 'block' as const,
      title: block.title,
      type: block.type,
      coachNotes: block.notes,
      level: blockLevel,
      exercises,
      blockNote: entry?.note?.trim() || null,
    }
  })
}

type RunRow = {
  id: string
  source_session_id: string | null
  title: string | null
  scheduled_date: string | null
  actual_date: string | null
  style: string
  snapshot: SessionRunSnapshot | null
  realized: SessionRunRealized | null
  comment: string | null
  coach_comments: unknown
}

function parseCoachComments(raw: unknown): PlanFicheCoachComment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null
      const o = c as Record<string, unknown>
      const text = typeof o.text === 'string' ? o.text.trim() : ''
      const createdAt = typeof o.created_at === 'string' ? o.created_at : ''
      const id = typeof o.id === 'string' ? o.id : createdAt || text
      if (!text) return null
      return { id, text, createdAt }
    })
    .filter(Boolean) as PlanFicheCoachComment[]
}

/** Fiche plan client — données réelles (runs + structure programme). */
export async function loadPlanFiche(
  supabase: SupabaseClient,
  coachId: string,
  planId: string,
): Promise<PlanFicheData | null> {
  let planQ = await supabase
    .from('client_fitness_plans')
    .select(
      'id, status, start_date, created_at, source_program_id, template_program_id, client_id, programs!client_fitness_plans_source_program_id_fkey(title), clients(first_name, last_name, email)',
    )
    .eq('id', planId)
    .eq('coach_id', coachId)
    .maybeSingle()

  if (
    planQ.error &&
    /template_program_id|more than one relationship|Could not embed/i.test(
      planQ.error.message,
    )
  ) {
    planQ = await supabase
      .from('client_fitness_plans')
      .select(
        'id, status, start_date, created_at, source_program_id, client_id, programs!client_fitness_plans_source_program_id_fkey(title), clients(first_name, last_name, email)',
      )
      .eq('id', planId)
      .eq('coach_id', coachId)
      .maybeSingle()
  }

  if (planQ.error) throw new Error(planQ.error.message)
  const plan = planQ.data
  if (!plan) return null

  const program = plan.programs as unknown as { title: string | null } | null
  const client = plan.clients as unknown as {
    first_name: string | null
    last_name: string | null
    email: string
  } | null

  const { data: runs, error: rErr } = await supabase
    .from('session_runs')
    .select(
      'id, source_session_id, title, scheduled_date, actual_date, style, snapshot, realized, comment, coach_comments',
    )
    .eq('plan_id', planId)
    .eq('coach_id', coachId)
    .order('scheduled_date', { ascending: true })

  if (rErr) throw new Error(rErr.message)

  const runRows = (runs ?? []) as unknown as RunRow[]
  const runBySession = new Map<string, RunRow>()
  for (const r of runRows) {
    if (r.source_session_id) runBySession.set(r.source_session_id, r)
  }

  let weeks: PlanFicheWeekView[] = []
  let structure: Awaited<ReturnType<typeof fetchProgramPreviewStructure>> | null = null

  if (plan.source_program_id) {
    try {
      structure = await fetchProgramPreviewStructure(supabase, plan.source_program_id)
    } catch {
      structure = null
    }

    const { data: weekRows, error: wErr } = await supabase
      .from('program_weeks')
      .select('id, week_order, title, sessions(id, title, session_order)')
      .eq('program_id', plan.source_program_id)
      .order('week_order', { ascending: true })

    if (wErr) throw new Error(wErr.message)

    const previewSessions = structure?.sessions ?? []

    weeks = (weekRows ?? []).map((w, wi) => {
      const sessionsRaw = (w.sessions ?? []) as {
        id: string
        title: string | null
        session_order: number | null
      }[]
      const sessions = [...sessionsRaw]
        .sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0))
        .map((s) => {
          const run = runBySession.get(s.id)
          const isFuture = !run
          let snapshot = (run?.snapshot as SessionRunSnapshot | null) ?? null
          if (!snapshot && structure) {
            const preview = previewSessions.find((ps) => ps.id === s.id)
            if (preview) snapshot = buildSessionSnapshot(preview, structure)
          }
          const realized = (run?.realized as SessionRunRealized | null) ?? null
          const style = (run?.style as SessionRunStyle | null) ?? null
          return {
            key: run?.id ?? s.id,
            sessionId: s.id,
            runId: run?.id ?? null,
            title: run?.title?.trim() || s.title?.trim() || 'Séance',
            scheduledDate: run?.scheduled_date ?? null,
            actualDate: run?.actual_date ?? null,
            style,
            level: styleToLevel(style, isFuture),
            isFuture,
            sessionComment: run?.comment ?? null,
            coachComments: parseCoachComments(run?.coach_comments),
            items: mapSnapshotItems(snapshot, realized, isFuture),
          } satisfies PlanFicheSessionView
        })

      return {
        weekIndex: wi,
        label: w.title?.trim() || `S${(w.week_order ?? wi) + 1}`,
        sessions,
      }
    })
  }

  // Fallback : uniquement les runs (si pas de structure programme)
  if (!weeks.length && runRows.length) {
    weeks = [
      {
        weekIndex: 0,
        label: 'S1',
        sessions: runRows.map((run) => {
          const isFuture = false
          const style = run.style as SessionRunStyle
          return {
            key: run.id,
            sessionId: run.source_session_id,
            runId: run.id,
            title: run.title?.trim() || 'Séance',
            scheduledDate: run.scheduled_date,
            actualDate: run.actual_date,
            style,
            level: styleToLevel(style, isFuture),
            isFuture,
            sessionComment: run.comment,
            coachComments: parseCoachComments(run.coach_comments),
            items: mapSnapshotItems(run.snapshot, run.realized, isFuture),
          }
        }),
      },
    ]
  }

  // Runs orphelins (session plus dans le programme) → collés en fin de S1 ou nouvelle semaine
  const knownSessionIds = new Set(
    weeks.flatMap((w) => w.sessions.map((s) => s.sessionId).filter(Boolean) as string[]),
  )
  const orphans = runRows.filter(
    (r) => r.source_session_id && !knownSessionIds.has(r.source_session_id),
  )
  if (orphans.length) {
    if (!weeks.length) {
      weeks.push({ weekIndex: 0, label: 'S1', sessions: [] })
    }
    for (const run of orphans) {
      weeks[0].sessions.push({
        key: run.id,
        sessionId: run.source_session_id,
        runId: run.id,
        title: run.title?.trim() || 'Séance',
        scheduledDate: run.scheduled_date,
        actualDate: run.actual_date,
        style: run.style as SessionRunStyle,
        level: styleToLevel(run.style as SessionRunStyle, false),
        isFuture: false,
        sessionComment: run.comment,
        coachComments: parseCoachComments(run.coach_comments),
        items: mapSnapshotItems(run.snapshot, run.realized, false),
      })
    }
  }

  const startIso = plan.start_date ?? plan.created_at

  const templateProgramId =
    ((plan as { template_program_id?: string | null }).template_program_id as
      | string
      | null) || null

  return {
    planId: plan.id,
    programId: plan.source_program_id,
    templateProgramId,
    programTitle: program?.title?.trim() || 'Programme',
    clientId: plan.client_id,
    clientLabel: client ? displayName(client) : 'Client',
    status: plan.status,
    startLabel: formatDate(startIso),
    weeks,
  }
}

export function complianceLabel(level: ComplianceLevel): string {
  if (level === 'conforme') return 'conforme'
  if (level === 'adapte') return 'adapté'
  if (level === 'non_fait') return 'non fait'
  return ''
}

/** Pastilles conformité — tokens DA (--status-* = feedback success/warning/danger). */
export function complianceDotClass(level: ComplianceLevel): string {
  if (level === 'conforme') return 'bg-[var(--status-ok)]'
  if (level === 'adapte') return 'bg-[var(--status-warn)]'
  if (level === 'non_fait') return 'bg-[var(--status-bad)]'
  return 'bg-transparent'
}

export function complianceTextClass(level: ComplianceLevel): string {
  if (level === 'conforme') return 'text-[var(--status-ok)]'
  if (level === 'adapte') return 'text-[var(--status-warn)]'
  if (level === 'non_fait') return 'text-[var(--status-bad)]'
  return 'text-[color:var(--muted)]'
}
