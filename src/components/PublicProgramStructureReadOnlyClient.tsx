'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { IconMinus, IconNote, IconOpen, IconPlus, IconStats } from './ui/icons'

type WeekRow = { id: string; title: string; week_order: number }

type SessionRow = {
  id: string
  week_id: string
  title: string
  description: string | null
  session_order: number
}

type ProgramExerciseRow = {
  id: string
  session_id: string
  exercise_id: string | null
  name: string | null
  exercise_order: number
  sets: number | null
  reps: number | null
  rest_time: string | null
  tempo: string | null
  load: string | null
  notes: string | null
  exercise_library: { name: string } | null
  demo_media_url?: string | null
}

type Props = {
  programId: string
  weeks: WeekRow[]
  sessions: SessionRow[]
  programExercises: ProgramExerciseRow[]
  exerciseDetailHrefPrefix?: string | null
  programDetailHref?: string | null
  initialOpenWeekId?: string | null
  initialOpenSessionId?: string | null
  initialOpenExerciseId?: string | null
}

export default function PublicProgramStructureReadOnlyClient(props: Props) {
  const router = useRouter()

  const weeks = props.weeks.slice().sort((a, b) => (a.week_order ?? 0) - (b.week_order ?? 0))

  const sessionsByWeekId = useMemo(() => {
    const map: Record<string, SessionRow[]> = {}
    for (const s of props.sessions) {
      if (!map[s.week_id]) map[s.week_id] = []
      map[s.week_id].push(s)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0))
    }
    return map
  }, [props.sessions])

  const exercisesBySessionId = useMemo(() => {
    const map: Record<string, ProgramExerciseRow[]> = {}
    for (const pe of props.programExercises) {
      if (!map[pe.session_id]) map[pe.session_id] = []
      map[pe.session_id].push(pe)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0))
    }
    return map
  }, [props.programExercises])

  const [openWeekIds, setOpenWeekIds] = useState<Record<string, boolean>>(() =>
    props.initialOpenWeekId ? { [props.initialOpenWeekId]: true } : {}
  )
  const [openSessionIds, setOpenSessionIds] = useState<Record<string, boolean>>(() =>
    props.initialOpenSessionId ? { [props.initialOpenSessionId]: true } : {}
  )
  const [openExerciseIds, setOpenExerciseIds] = useState<Record<string, boolean>>(() =>
    props.initialOpenExerciseId ? { [props.initialOpenExerciseId]: true } : {}
  )

  function toggleWeek(id: string) {
    setOpenWeekIds((prev) => {
      const nextOpen = !prev[id]
      return nextOpen ? { [id]: true } : {}
    })
    setOpenSessionIds({})
    setOpenExerciseIds({})
  }

  function toggleSession(id: string) {
    setOpenSessionIds((prev) => {
      const nextOpen = !prev[id]
      return nextOpen ? { [id]: true } : {}
    })
    setOpenExerciseIds({})
  }

  function toggleExercise(id: string) {
    setOpenExerciseIds((prev) => {
      const next = Object.keys(prev).reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = false
        return acc
      }, {})

      const nextOpen = !prev[id]
      next[id] = nextOpen

      if (nextOpen) {
        const pe = props.programExercises.find((x) => x.id === id)
        const sessionId = pe?.session_id ?? null
        const weekId = sessionId ? props.sessions.find((s) => s.id === sessionId)?.week_id ?? null : null
        const exerciseId = pe?.exercise_id ?? null

        if (weekId && sessionId && exerciseId && props.exerciseDetailHrefPrefix && props.programDetailHref) {
          const returnTo = `${props.programDetailHref}?openWeek=${encodeURIComponent(weekId)}&openSession=${encodeURIComponent(sessionId)}&openExercise=${encodeURIComponent(id)}`
          const href = `${props.exerciseDetailHrefPrefix}/${exerciseId}?returnTo=${encodeURIComponent(returnTo)}`
          router.prefetch(href)
        }
      }

      return next
    })
  }

  return (
    <div className="grid gap-4">
      {weeks.length === 0 ? (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
          <div className="text-sm font-semibold text-[var(--brand)]">Structure vide</div>
          <div className="mt-1 text-sm text-black/70">Le programme n’a pas encore de semaines.</div>
        </div>
      ) : (
        weeks.map((w) => {
          const weekOpen = openWeekIds[w.id] ?? false
          const sessions = sessionsByWeekId[w.id] ?? []

          return (
            <div key={w.id} className="rounded-2xl bg-white ring-1 ring-black/10">
              <button
                type="button"
                onClick={() => toggleWeek(w.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
              >
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-[var(--brand)] truncate">{w.title || 'Semaine'}</div>
                  <div className="mt-1 text-xs font-semibold text-black/50">{sessions.length} séance(s)</div>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                  {weekOpen ? <IconMinus size={18} className="text-white" /> : <IconPlus size={18} className="text-white" />}
                </span>
              </button>

              {weekOpen ? (
                <div className="grid gap-4 px-5 pb-5">
                  {sessions.length === 0 ? (
                    <div className="rounded-2xl bg-[#f5f5f5] p-4 text-sm text-black/70">Aucune séance.</div>
                  ) : (
                    sessions.map((s) => {
                      const sessionOpen = openSessionIds[s.id] ?? false
                      const exercises = exercisesBySessionId[s.id] ?? []
                      const exercisePreview = exercises
                        .map((pe) => pe.exercise_library?.name ?? pe.name ?? 'Exercice')
                        .filter((v) => String(v).trim().length > 0)
                        .join(' · ')

                      return (
                        <div key={s.id} className="overflow-hidden rounded-2xl bg-[#f5f5f5]">
                          <button
                            type="button"
                            onClick={() => toggleSession(s.id)}
                            className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-extrabold text-[var(--brand)] truncate">{s.title || 'Séance'}</div>
                              {s.description ? (
                                <div className="mt-1 text-sm text-black/60 line-clamp-2">{s.description}</div>
                              ) : null}

                              {!sessionOpen && exercisePreview ? (
                                <div className="mt-2">
                                  <div className="relative w-full min-w-0 overflow-hidden whitespace-nowrap pr-10 text-xs font-semibold text-black/50">
                                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{exercisePreview}</span>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#f5f5f5] to-transparent backdrop-blur-sm" />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                              {sessionOpen ? (
                                <IconMinus size={18} className="text-white" />
                              ) : (
                                <IconPlus size={18} className="text-white" />
                              )}
                            </span>
                          </button>

                          {sessionOpen ? (
                            <div className="grid gap-3 px-5 pb-5">
                              {exercises.length === 0 ? (
                                <div className="text-sm text-black/60">Aucun exercice.</div>
                              ) : (
                                <ul className="grid gap-2">
                                  {exercises.map((pe) => {
                                    const displayName = pe.exercise_library?.name ?? pe.name ?? 'Exercice'
                                    const exerciseOpen = openExerciseIds[pe.id] ?? false
                                    const restValue = (() => {
                                      if (!pe.rest_time) return null
                                      const raw = String(pe.rest_time).trim()
                                      if (!raw) return null
                                      if (/[a-zA-Z]/.test(raw)) return raw
                                      return `${raw} min`
                                    })()
                                    const loadValue = (() => {
                                      if (!pe.load) return null
                                      const raw = String(pe.load).trim()
                                      if (!raw) return null
                                      if (/[a-zA-Z]/.test(raw)) return raw
                                      return `${raw} Kg`
                                    })()
                                    const returnTo = props.programDetailHref
                                      ? `${props.programDetailHref}?openWeek=${encodeURIComponent(w.id)}&openSession=${encodeURIComponent(s.id)}&openExercise=${encodeURIComponent(pe.id)}`
                                      : null
                                    const baseExerciseHref =
                                      props.exerciseDetailHrefPrefix && pe.exercise_id
                                        ? `${props.exerciseDetailHrefPrefix}/${pe.exercise_id}`
                                        : null
                                    const exerciseHref = baseExerciseHref
                                      ? returnTo
                                        ? `${baseExerciseHref}?returnTo=${encodeURIComponent(returnTo)}`
                                        : baseExerciseHref
                                      : null
                                    const exerciseMetaLine = [
                                      pe.sets != null ? `${pe.sets} séries` : null,
                                      pe.reps != null ? `${pe.reps} reps` : null,
                                      restValue ? `repos ${restValue}` : null,
                                      pe.tempo ? `tempo ${pe.tempo}` : null,
                                      loadValue ? `charge ${loadValue}` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')

                                    return (
                                      <li key={pe.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
                                        {!exerciseOpen ? (
                                          <div className="flex w-full items-start gap-2 px-5 py-4">
                                            <button
                                              type="button"
                                              onClick={() => toggleExercise(pe.id)}
                                              className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
                                            >
                                              <div className="flex min-w-0 flex-1 items-start gap-4">
                                                <div className="min-w-0 flex-1">
                                                  <div className="text-base font-extrabold text-[var(--brand)] line-clamp-2">{displayName}</div>

                                                  {exerciseMetaLine ? (
                                                    <div className="mt-1 w-full min-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold text-black/50">
                                                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{exerciseMetaLine}</span>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              </div>

                                              <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                                                <IconPlus size={18} className="text-white" />
                                              </span>
                                            </button>
                                          </div>
                                        ) : null}

                                        {exerciseOpen ? (
                                          <div>
                                            {pe.demo_media_url ? (
                                              <button
                                                type="button"
                                                onClick={() => toggleExercise(pe.id)}
                                                className="relative block w-full overflow-hidden"
                                                aria-label="Fermer l'exercice"
                                              >
                                                <img
                                                  src={pe.demo_media_url}
                                                  alt={displayName}
                                                  className="block h-[28rem] w-full object-cover sm:h-[32rem]"
                                                  loading="lazy"
                                                />

                                                <span
                                                  className="absolute left-3 top-3 right-16 text-base font-extrabold text-[var(--brand)] line-clamp-2"
                                                  style={{ textShadow: '0 1px 8px rgba(255,255,255,0.85)' }}
                                                >
                                                  {displayName}
                                                </span>

                                                {exerciseHref ? (
                                                  <Link
                                                    href={exerciseHref}
                                                    onClick={(e) => e.stopPropagation()}
                                                    prefetch
                                                    className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-md ring-1 ring-black/10"
                                                    aria-label="Voir la fiche de l'exercice"
                                                  >
                                                    <IconOpen size={20} className="text-white" />
                                                  </Link>
                                                ) : null}

                                              {(exerciseMetaLine || pe.notes) ? (
                                                <div className="pointer-events-none absolute inset-x-0 bottom-0">
                                                  <div
                                                    className="pointer-events-auto px-4 pb-4 pt-3"
                                                    style={{
                                                      background:
                                                        'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.55) 58%, rgba(0,0,0,0.0) 100%)',
                                                    }}
                                                  >
                                                    <div className="grid gap-2">
                                                      {exerciseMetaLine ? (
                                                        <div className="inline-flex items-center gap-2 text-base text-white/90">
                                                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white">
                                                            <IconStats size={16} className="text-white" />
                                                          </span>
                                                          <span className="min-w-0 flex-1">{exerciseMetaLine}</span>
                                                        </div>
                                                      ) : null}

                                                      {pe.notes ? (
                                                        <div className="inline-flex items-start gap-2 rounded-2xl bg-white/10 px-3 py-2 text-base text-white/95 backdrop-blur">
                                                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                                                            <IconNote size={16} className="text-white" />
                                                          </span>
                                                          <span className="min-w-0">{pe.notes}</span>
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  </div>
                                                </div>
                                              ) : null}
                                            </button>
                                          ) : (
                                            <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3">
                                              <div className="text-base font-extrabold text-[var(--brand)]">{displayName}</div>
                                              {exerciseMetaLine ? (
                                                <div className="mt-1 text-sm font-semibold text-black/60">{exerciseMetaLine}</div>
                                              ) : null}
                                              {pe.notes ? (
                                                <div className="mt-2 inline-flex items-start gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-black/70 ring-1 ring-black/5">
                                                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                                                    <IconNote size={14} className="text-white" />
                                                  </span>
                                                  <span className="min-w-0">{pe.notes}</span>
                                                </div>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>
        )
      })
    )}
  </div>

  )
}
