'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import type {
  PreviewBlockExerciseRow,
  PreviewProgramExerciseRow,
  PreviewSessionBlockRow,
  PreviewSessionItemRow,
  PreviewSessionRow,
  PreviewWeekRow,
} from '../lib/fetchProgramPreviewStructure'
import { useMarkProgramEditorReady } from './ProgramEditorNavigationClient'
import PreviewBlockCard from './PreviewBlockCard'
import PreviewExerciseCard from './PreviewExerciseCard'

type SessionContentItem =
  | { kind: 'exercise'; programExercise: PreviewProgramExerciseRow }
  | { kind: 'block'; block: PreviewSessionBlockRow; exercises: PreviewBlockExerciseRow[] }

type Props = {
  programId: string
  weeks: PreviewWeekRow[]
  sessions: PreviewSessionRow[]
  programExercises: PreviewProgramExerciseRow[]
  sessionItems?: PreviewSessionItemRow[]
  sessionBlocks?: PreviewSessionBlockRow[]
  blockExercises?: PreviewBlockExerciseRow[]
  exerciseDetailHrefPrefix?: string | null
  programDetailHref?: string | null
  initialOpenWeekId?: string | null
  initialOpenSessionId?: string | null
  initialOpenExerciseId?: string | null
}

function isSessionItemBlockKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'block' || k === 'session_block' || k === 'bloc' || k === 'circuit' || k === 'crosstraining'
}

function isSessionItemExerciseKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'exercise' || k === 'program_exercise'
}

function resolveDefaultWeekId(weeks: PreviewWeekRow[], initialOpenWeekId?: string | null) {
  if (initialOpenWeekId && weeks.some((w) => w.id === initialOpenWeekId)) return initialOpenWeekId
  return weeks[0]?.id ?? null
}

function resolveDefaultSessionId(
  sessions: PreviewSessionRow[],
  weekId: string | null,
  initialOpenSessionId?: string | null
) {
  const weekSessions = weekId ? sessions.filter((s) => s.week_id === weekId) : []
  if (initialOpenSessionId && weekSessions.some((s) => s.id === initialOpenSessionId)) {
    return initialOpenSessionId
  }
  return weekSessions[0]?.id ?? null
}

export default function PublicProgramStructureReadOnlyClient(props: Props) {
  useMarkProgramEditorReady()

  const router = useRouter()
  const sessionItems = props.sessionItems ?? []
  const sessionBlocks = props.sessionBlocks ?? []
  const blockExercises = props.blockExercises ?? []

  const weeks = props.weeks.slice().sort((a, b) => (a.week_order ?? 0) - (b.week_order ?? 0))

  const sessionsByWeekId = useMemo(() => {
    const map: Record<string, PreviewSessionRow[]> = {}
    for (const s of props.sessions) {
      if (!map[s.week_id]) map[s.week_id] = []
      map[s.week_id].push(s)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0))
    }
    return map
  }, [props.sessions])

  const programExerciseById = useMemo(() => {
    const map = new Map<string, PreviewProgramExerciseRow>()
    for (const pe of props.programExercises) map.set(pe.id, pe)
    return map
  }, [props.programExercises])

  const blockById = useMemo(() => {
    const map = new Map<string, PreviewSessionBlockRow>()
    for (const b of sessionBlocks) map.set(b.id, b)
    return map
  }, [sessionBlocks])

  const blockExercisesByBlockId = useMemo(() => {
    const map: Record<string, PreviewBlockExerciseRow[]> = {}
    for (const be of blockExercises) {
      const key = String(be.session_block_id)
      if (!map[key]) map[key] = []
      map[key].push(be)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return map
  }, [blockExercises])

  const sessionItemsBySessionId = useMemo(() => {
    const map: Record<string, PreviewSessionItemRow[]> = {}
    for (const item of sessionItems) {
      const sid = String(item.session_id)
      if (!map[sid]) map[sid] = []
      map[sid].push(item)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return map
  }, [sessionItems])

  const exercisesBySessionId = useMemo(() => {
    const map: Record<string, PreviewProgramExerciseRow[]> = {}
    for (const pe of props.programExercises) {
      if (!map[pe.session_id]) map[pe.session_id] = []
      map[pe.session_id].push(pe)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0))
    }
    return map
  }, [props.programExercises])

  function buildSessionContent(sessionId: string): SessionContentItem[] {
    const items = sessionItemsBySessionId[sessionId] ?? []
    if (items.length === 0) {
      return (exercisesBySessionId[sessionId] ?? []).map((pe) => ({ kind: 'exercise' as const, programExercise: pe }))
    }

    const out: SessionContentItem[] = []
    for (const item of items) {
      if (isSessionItemExerciseKind(item.kind) && item.program_exercise_id) {
        const pe = programExerciseById.get(String(item.program_exercise_id))
        if (pe) out.push({ kind: 'exercise', programExercise: pe })
        continue
      }
      if (isSessionItemBlockKind(item.kind) && item.session_block_id) {
        const blockId = String(item.session_block_id)
        const block = blockById.get(blockId)
        if (block) {
          out.push({
            kind: 'block',
            block,
            exercises: blockExercisesByBlockId[blockId] ?? [],
          })
        }
      }
    }
    return out
  }

  const defaultWeekId = resolveDefaultWeekId(weeks, props.initialOpenWeekId)
  const defaultSessionId = resolveDefaultSessionId(props.sessions, defaultWeekId, props.initialOpenSessionId)

  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(defaultWeekId)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(defaultSessionId)
  const [openPreviewKey, setOpenPreviewKey] = useState<string | null>(() =>
    props.initialOpenExerciseId ? `program:${props.initialOpenExerciseId}` : null
  )

  const openBlockExerciseId =
    openPreviewKey?.startsWith('block:') ? openPreviewKey.slice('block:'.length) : null

  const weekSessions = selectedWeekId ? sessionsByWeekId[selectedWeekId] ?? [] : []
  const selectedSession = selectedSessionId
    ? props.sessions.find((s) => s.id === selectedSessionId) ?? null
    : null
  const selectedWeek = selectedWeekId ? weeks.find((w) => w.id === selectedWeekId) ?? null : null

  useEffect(() => {
    if (!selectedWeekId && weeks.length > 0) {
      setSelectedWeekId(weeks[0].id)
    }
  }, [selectedWeekId, weeks])

  useEffect(() => {
    if (!selectedWeekId) return
    const sessionsForWeek = sessionsByWeekId[selectedWeekId] ?? []
    if (sessionsForWeek.length === 0) {
      setSelectedSessionId(null)
      return
    }
    if (!selectedSessionId || !sessionsForWeek.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(sessionsForWeek[0].id)
    }
  }, [selectedWeekId, selectedSessionId, sessionsByWeekId])

  function selectWeek(weekId: string) {
    setSelectedWeekId(weekId)
    setOpenPreviewKey(null)
    const firstSession = (sessionsByWeekId[weekId] ?? [])[0]
    setSelectedSessionId(firstSession?.id ?? null)
  }

  function selectSession(sessionId: string) {
    setSelectedSessionId(sessionId)
    setOpenPreviewKey(null)
  }

  function toggleProgramExercise(id: string) {
    const key = `program:${id}`
    setOpenPreviewKey((prev) => {
      const nextOpen = prev !== key
      if (nextOpen && selectedWeekId && selectedSessionId) {
        const pe = props.programExercises.find((x) => x.id === id)
        const exerciseId = pe?.exercise_id ?? null
        if (exerciseId && props.exerciseDetailHrefPrefix && props.programDetailHref) {
          const returnTo = `${props.programDetailHref}?openWeek=${encodeURIComponent(selectedWeekId)}&openSession=${encodeURIComponent(selectedSessionId)}&openExercise=${encodeURIComponent(id)}`
          router.prefetch(
            `${props.exerciseDetailHrefPrefix}/${exerciseId}?returnTo=${encodeURIComponent(returnTo)}`
          )
        }
      }
      return nextOpen ? key : null
    })
  }

  function toggleBlockExercise(blockExerciseId: string) {
    const key = `block:${blockExerciseId}`
    setOpenPreviewKey((prev) => (prev === key ? null : key))
  }

  function buildExerciseHref(pe: PreviewProgramExerciseRow): string | null {
    const returnTo =
      props.programDetailHref && selectedWeekId && selectedSessionId
        ? `${props.programDetailHref}?openWeek=${encodeURIComponent(selectedWeekId)}&openSession=${encodeURIComponent(selectedSessionId)}&openExercise=${encodeURIComponent(pe.id)}`
        : null
    const baseExerciseHref =
      props.exerciseDetailHrefPrefix && pe.exercise_id
        ? `${props.exerciseDetailHrefPrefix}/${pe.exercise_id}`
        : null
    if (!baseExerciseHref) return null
    return returnTo
      ? `${baseExerciseHref}?returnTo=${encodeURIComponent(returnTo)}`
      : baseExerciseHref
  }

  function renderStandaloneExercise(pe: PreviewProgramExerciseRow) {
    const displayName = pe.exercise_library?.name ?? pe.name ?? 'Exercice'
    const exerciseOpen = openPreviewKey === `program:${pe.id}`

    return (
      <PreviewExerciseCard
        key={pe.id}
        displayName={displayName}
        sets={pe.sets}
        reps={pe.reps}
        restTime={pe.rest_time}
        rpe={pe.rpe}
        tempo={pe.tempo}
        load={pe.load}
        notes={pe.notes}
        demoMediaUrl={pe.demo_media_url}
        demoMediaPath={pe.exercise_library?.demo_media_path ?? pe.demo_media_url}
        exerciseHref={buildExerciseHref(pe)}
        isOpen={exerciseOpen}
        onToggle={() => toggleProgramExercise(pe.id)}
      />
    )
  }

  function renderSingleBlockExercise(be: PreviewBlockExerciseRow) {
    const displayName = be.exercise_library?.name ?? be.exercise_name ?? 'Exercice'
    const exerciseOpen = openPreviewKey === `block:${be.id}`

    return (
      <PreviewExerciseCard
        key={be.id}
        displayName={displayName}
        sets={be.sets}
        reps={be.reps}
        restSeconds={be.rest_seconds}
        loadText={be.load_text}
        notes={be.notes}
        demoMediaUrl={be.demo_media_url}
        demoMediaPath={be.exercise_library?.demo_media_path ?? be.demo_media_url}
        isOpen={exerciseOpen}
        onToggle={() => toggleBlockExercise(be.id)}
      />
    )
  }

  const sessionContent = selectedSessionId ? buildSessionContent(selectedSessionId) : []

  if (weeks.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
        <div className="text-sm font-semibold text-[var(--brand)]">Structure vide</div>
        <div className="mt-1 text-sm text-black/70">Le programme n’a pas encore de semaines.</div>
      </div>
    )
  }

  const scrollBandClass =
    'flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="sticky top-0 z-20 flex shrink-0 flex-col gap-2">
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10">
          <div className={scrollBandClass} style={{ WebkitOverflowScrolling: 'touch' }}>
            {weeks.map((w) => {
            const active = w.id === selectedWeekId
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => selectWeek(w.id)}
                className={[
                  'shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition',
                  active
                    ? 'bg-[var(--brand)] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[var(--brand)] ring-1 ring-black/10 hover:bg-white',
                ].join(' ')}
              >
                {w.title || `Semaine ${w.week_order}`}
              </button>
            )
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10">
          {weekSessions.length > 0 ? (
            <div className={scrollBandClass} style={{ WebkitOverflowScrolling: 'touch' }}>
              {weekSessions.map((s) => {
                const active = s.id === selectedSessionId
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSession(s.id)}
                    className={[
                      'shrink-0 rounded-xl px-3 py-2 text-left transition',
                      active
                        ? 'bg-[var(--brand)] text-white shadow-sm'
                        : 'bg-[#f5f5f5] text-[var(--brand)] ring-1 ring-[var(--brand)]/25 hover:bg-white',
                    ].join(' ')}
                  >
                    <div className="max-w-[9rem] truncate text-sm font-extrabold">{s.title || 'Séance'}</div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="px-3 py-2.5 text-xs font-semibold text-black/55">
              Aucun training pour {selectedWeek?.title ?? 'cette semaine'}.
            </div>
          )}
        </section>
      </div>

      {selectedSession ? (
        <div className="min-h-0 flex-1 grid gap-2">
          {selectedSession.description ? (
            <p className="text-xs leading-snug text-black/60">{selectedSession.description}</p>
          ) : null}

          {sessionContent.length === 0 ? (
            <div className="rounded-xl bg-[#f5f5f5] px-3 py-4 text-sm text-black/60">Aucun exercice ni bloc.</div>
          ) : (
            <div className="grid gap-3">
              {sessionContent.map((item) => {
                if (item.kind === 'block') {
                  if (item.exercises.length === 1) {
                    return renderSingleBlockExercise(item.exercises[0])
                  }
                  return (
                    <PreviewBlockCard
                      key={item.block.id}
                      block={item.block}
                      exercises={item.exercises}
                      openBlockExerciseId={openBlockExerciseId}
                      onToggleBlockExercise={toggleBlockExercise}
                    />
                  )
                }
                return renderStandaloneExercise(item.programExercise)
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
