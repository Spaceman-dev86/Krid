'use client'

import { useMemo, useState } from 'react'

import { IconMinus, IconNote, IconPlus, IconStats } from './ui/icons'

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
}

export default function PublicProgramStructureReadOnlyClient(props: Props) {
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

  const [openWeekIds, setOpenWeekIds] = useState<Record<string, boolean>>({})
  const [openSessionIds, setOpenSessionIds] = useState<Record<string, boolean>>({})

  function toggleWeek(id: string) {
    setOpenWeekIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleSession(id: string) {
    setOpenSessionIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="grid gap-4">
      {weeks.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-black/10">
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
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[var(--brand)] truncate">{w.title || 'Semaine'}</div>
                  <div className="mt-1 text-xs font-semibold text-black/50">{sessions.length} séance(s)</div>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                  {weekOpen ? <IconMinus size={18} className="text-white" /> : <IconPlus size={18} className="text-white" />}
                </span>
              </button>

              {weekOpen ? (
                <div className="grid gap-3 px-5 pb-5">
                  {sessions.length === 0 ? (
                    <div className="rounded-2xl bg-[#f5f5f5] p-4 text-sm text-black/70">Aucune séance.</div>
                  ) : (
                    sessions.map((s) => {
                      const sessionOpen = openSessionIds[s.id] ?? false
                      const exercises = exercisesBySessionId[s.id] ?? []

                      return (
                        <div key={s.id} className="rounded-2xl bg-[#f5f5f5]">
                          <button
                            type="button"
                            onClick={() => toggleSession(s.id)}
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-[var(--brand)] truncate">{s.title || 'Séance'}</div>
                              {s.description ? (
                                <div className="mt-1 text-sm text-black/60 line-clamp-2">{s.description}</div>
                              ) : null}
                            </div>
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                              {sessionOpen ? (
                                <IconMinus size={18} className="text-white" />
                              ) : (
                                <IconPlus size={18} className="text-white" />
                              )}
                            </span>
                          </button>

                          {sessionOpen ? (
                            <div className="grid gap-2 px-4 pb-4">
                              {exercises.length === 0 ? (
                                <div className="text-sm text-black/60">Aucun exercice.</div>
                              ) : (
                                <ul className="grid gap-2">
                                  {exercises.map((pe) => {
                                    const displayName = pe.exercise_library?.name ?? pe.name ?? 'Exercice'
                                    const metaParts = [
                                      pe.sets != null ? `${pe.sets} séries` : null,
                                      pe.reps != null ? `${pe.reps} reps` : null,
                                      pe.rest_time ? `repos ${pe.rest_time}` : null,
                                    ].filter(Boolean)

                                    return (
                                      <li key={pe.id} className="rounded-2xl bg-white px-4 py-3">
                                        <div className="flex items-start gap-4">
                                          {pe.demo_media_url ? (
                                            <img
                                              src={pe.demo_media_url}
                                              alt={displayName}
                                              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-black/10"
                                              loading="lazy"
                                            />
                                          ) : (
                                            <div className="h-16 w-16 shrink-0 rounded-2xl bg-black/5" />
                                          )}

                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-extrabold text-[var(--brand)] truncate">{displayName}</div>
                                            {metaParts.length ? (
                                              <div className="mt-1 inline-flex items-center gap-2 text-sm text-black/60">
                                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                                                  <IconStats size={14} className="text-white" />
                                                </span>
                                                <span>{metaParts.join(' · ')}</span>
                                              </div>
                                            ) : null}

                                            {pe.notes ? (
                                              <div className="mt-2 inline-flex items-start gap-2 rounded-2xl bg-[#f5f5f5] px-3 py-2 text-sm text-black/70">
                                                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                                                  <IconNote size={14} className="text-white" />
                                                </span>
                                                <span className="min-w-0">{pe.notes}</span>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
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
