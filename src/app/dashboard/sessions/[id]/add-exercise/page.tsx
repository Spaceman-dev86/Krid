import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../../lib/supabase/server'
import type { Database } from '../../../../../lib/supabase/database.types'

type UntypedMutationResult = { error: { message?: string } | null }
type UntypedUpdateChain = {
  eq: (col: string, val: string | number) => Promise<UntypedMutationResult>
}

type UntypedQuery = {
  select: (columns: string) => UntypedQuery
  eq: (col: string, val: string | number) => UntypedQuery
  maybeSingle: () => Promise<{ data: unknown; error: { message?: string } | null }>
  update: (values: Record<string, unknown>) => UntypedUpdateChain
}

type UntypedListQuery = {
  select: (columns: string) => UntypedListQuery
  order: (col: string, opts?: { ascending?: boolean }) => UntypedListQuery
  limit: (n: number) => UntypedListQuery
  ilike: (col: string, pattern: string) => UntypedListQuery
  eq: (col: string, val: string | number) => UntypedListQuery
  then: never
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; muscle?: string }>
}

function normalizeFilter(value: string | undefined) {
  const v = (value ?? '').trim()
  return v.length > 0 ? v : null
}

export default async function AddExerciseToSessionPage({ params, searchParams }: PageProps) {
  const { id: sessionId } = await params
  const { q, muscle } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const typedProfile = profile as unknown as { role: string | null } | null
  const isAdmin = typedProfile?.role === 'admin'

  const { data: session } = await supabase
    .from('sessions')
    .select('id,week_id,title')
    .eq('id', sessionId)
    .maybeSingle()

  type SessionRow = { id: string; week_id: string; title: string }
  const typedSession = session as unknown as SessionRow | null

  if (!typedSession) {
    redirect('/dashboard')
  }

  const { data: week } = await supabase
    .from('program_weeks')
    .select('id,program_id,title')
    .eq('id', typedSession.week_id)
    .maybeSingle()

  type WeekRow = { id: string; program_id: string; title: string }
  const typedWeek = week as unknown as WeekRow | null

  if (!typedWeek) {
    redirect('/dashboard')
  }

  const { data: program } = await supabase
    .from('programs')
    .select('id,coach_id,title')
    .eq('id', typedWeek.program_id)
    .maybeSingle()

  type ProgramRow = { id: string; coach_id: string; title: string }
  const typedProgram = program as unknown as ProgramRow | null

  if (!typedProgram) {
    redirect('/dashboard')
  }

  if (!isAdmin && typedProgram.coach_id !== user.id) {
    redirect('/dashboard')
  }

  type SessionExerciseRow = {
    id: string
    exercise_id: string
    exercise_order: number
    sets: number | null
    reps: number | null
    rest_time: string | null
    tempo: string | null
    load: string | null
    notes: string | null
    exercise_library: { name: string } | null
  }

  const { data: sessionExercisesData } = await supabase
    .from('program_exercises')
    .select('id,exercise_id,exercise_order,sets,reps,rest_time,tempo,load,notes,exercise_library(name)')
    .eq('session_id', sessionId)
    .order('exercise_order', { ascending: true })

  const sessionExercises = (sessionExercisesData ?? []) as unknown as SessionExerciseRow[]

  type RpcClient = {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }

  async function addExercise(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const typedProfile = profile as unknown as { role: string | null } | null
    const isAdmin = typedProfile?.role === 'admin'

    const sessionId = String(formData.get('session_id') ?? '')
    const exerciseId = String(formData.get('exercise_id') ?? '')

    const sets = Number(formData.get('sets') ?? '')
    const reps = Number(formData.get('reps') ?? '')
    const restTime = String(formData.get('rest_time') ?? '').trim()
    const tempo = String(formData.get('tempo') ?? '').trim()
    const load = String(formData.get('load') ?? '').trim()
    const notes = String(formData.get('notes') ?? '').trim()

    if (!sessionId || !exerciseId) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise?error=missing_ids`)
    }

    const { error } = await (supabase as unknown as RpcClient).rpc('insert_program_exercise', {
      p_session_id: sessionId,
      p_exercise_id: exerciseId,
    })

    if (error) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise?error=${encodeURIComponent(error.message)}`)
    }

    redirect(`/dashboard/sessions/${sessionId}/add-exercise?success=1`)
  }

  async function moveExercise(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const typedProfile = profile as unknown as { role: string | null } | null
    const isAdmin = typedProfile?.role === 'admin'

    const sessionId = String(formData.get('session_id') ?? '')
    const programExerciseId = String(formData.get('program_exercise_id') ?? '')
    const direction = String(formData.get('direction') ?? '')

    if (!sessionId || !programExerciseId || (direction !== 'up' && direction !== 'down')) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise?error=invalid_move_params`)
    }

    const { data: session } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('sessions')
      .select('id,week_id')
      .eq('id', sessionId)
      .maybeSingle()

    const typedSession = session as unknown as { id: string; week_id: string } | null

    if (!typedSession) {
      redirect('/dashboard')
    }

    const { data: week } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('program_weeks')
      .select('id,program_id')
      .eq('id', typedSession.week_id)
      .maybeSingle()

    const typedWeek = week as unknown as { id: string; program_id: string } | null

    if (!typedWeek) {
      redirect('/dashboard')
    }

    const { data: program } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('programs')
      .select('id,coach_id')
      .eq('id', typedWeek.program_id)
      .maybeSingle()

    const typedProgram = program as unknown as { id: string; coach_id: string } | null

    if (!typedProgram) {
      redirect('/dashboard')
    }

    if (!isAdmin && typedProgram.coach_id !== user.id) {
      redirect('/dashboard')
    }

    const { data: current } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('program_exercises')
      .select('id,exercise_order')
      .eq('id', programExerciseId)
      .eq('session_id', sessionId)
      .maybeSingle()

    const typedCurrent = current as unknown as { id: string; exercise_order: number } | null

    if (!typedCurrent) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise?error=exercise_not_found`)
    }

    const neighborOrder = direction === 'up' ? typedCurrent.exercise_order - 1 : typedCurrent.exercise_order + 1

    const { data: neighbor } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('program_exercises')
      .select('id,exercise_order')
      .eq('session_id', sessionId)
      .eq('exercise_order', neighborOrder)
      .maybeSingle()

    const typedNeighbor = neighbor as unknown as { id: string; exercise_order: number } | null

    if (!typedNeighbor) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise`)
    }

    const tempOrder = -1

    const { error: e1 } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('program_exercises')
      .update({ exercise_order: tempOrder })
      .eq('id', typedCurrent.id)

    if (e1) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise?error=${encodeURIComponent(e1.message ?? 'unknown_error')}`)
    }

    const { error: e2 } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('program_exercises')
      .update({ exercise_order: typedCurrent.exercise_order })
      .eq('id', typedNeighbor.id)

    if (e2) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise?error=${encodeURIComponent(e2.message ?? 'unknown_error')}`)
    }

    const { error: e3 } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('program_exercises')
      .update({ exercise_order: typedNeighbor.exercise_order })
      .eq('id', typedCurrent.id)

    if (e3) {
      redirect(`/dashboard/sessions/${sessionId}/add-exercise?error=${encodeURIComponent(e3.message ?? 'unknown_error')}`)
    }

    redirect(`/dashboard/sessions/${sessionId}/add-exercise`)
  }

  const qFilter = normalizeFilter(q)
  const muscleFilter = normalizeFilter(muscle)

  let query = (supabase as unknown as { from: (t: string) => UntypedListQuery })
    .from('exercise_library')
    .select('id,name,muscle_group,difficulty')
    .order('name', { ascending: true })
    .limit(50)

  if (qFilter) {
    query = query.ilike('name', `%${qFilter}%`)
  }

  if (muscleFilter) {
    query = query.eq('muscle_group', muscleFilter)
  }

  type ExerciseRow = Pick<Database['public']['Tables']['exercise_library']['Row'], 'id' | 'name' | 'muscle_group' | 'difficulty'>
  const { data: exercisesData } = (await (query as unknown as Promise<{ data: unknown }>))
  const exercises = (exercisesData ?? []) as unknown as ExerciseRow[]

  const { data: muscleGroups } = await supabase
    .from('exercise_library')
    .select('muscle_group')
    .not('muscle_group', 'is', null)
    .order('muscle_group', { ascending: true })

  const typedMuscleGroups = muscleGroups as unknown as { muscle_group: string | null }[] | null

  const uniqueMuscles = Array.from(
    new Set((typedMuscleGroups ?? []).map((m) => m.muscle_group).filter((m): m is string => !!m))
  )

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Ajouter un exercice</h1>
          <p style={{ color: '#6b7280', marginTop: 6 }}>
            Séance : {typedSession.title} — Programme : {typedProgram.title}
          </p>
        </div>
        <Link href="/dashboard" style={{ textDecoration: 'none', color: '#111827' }}>
          Retour
        </Link>
      </div>

      {sessionExercises.length > 0 ? (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Exercices de la séance</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 8 }}>
            {sessionExercises.map((pe) => (
              <li key={pe.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <strong>
                      {pe.exercise_order}. {pe.exercise_library?.name ?? pe.exercise_id}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <form action={moveExercise}>
                      <input type="hidden" name="session_id" value={sessionId} />
                      <input type="hidden" name="program_exercise_id" value={pe.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #111827',
                          background: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        ↑
                      </button>
                    </form>

                    <form action={moveExercise}>
                      <input type="hidden" name="session_id" value={sessionId} />
                      <input type="hidden" name="program_exercise_id" value={pe.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #111827',
                          background: '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        ↓
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form
        method="get"
        style={{
          marginTop: 16,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 12,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Recherche</span>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Ex: développé couché"
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Filtrer (muscle)</span>
            <select
              name="muscle"
              defaultValue={muscle ?? ''}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            >
              <option value="">Tous</option>
              {uniqueMuscles.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          style={{
            justifySelf: 'start',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #111827',
            background: '#111827',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Rechercher
        </button>
      </form>

      {exercises && exercises.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 10 }}>
          {exercises.map((e) => (
            <li key={e.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong>{e.name}</strong>
                  <div style={{ color: '#6b7280', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>{e.muscle_group ?? ''}</span>
                    <span>{e.difficulty ?? ''}</span>
                  </div>
                </div>
              </div>

              <form action={addExercise} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <input type="hidden" name="session_id" value={sessionId} />
                <input type="hidden" name="exercise_id" value={e.id} />

                <div style={{ display: 'grid', gridTemplateColumns: '120px 120px 140px 140px 140px', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span>Séries</span>
                    <input
                      name="sets"
                      inputMode="numeric"
                      style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span>Rép</span>
                    <input
                      name="reps"
                      inputMode="numeric"
                      style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span>Repos</span>
                    <input
                      name="rest_time"
                      placeholder="Ex: 2:00"
                      style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span>Tempo</span>
                    <input
                      name="tempo"
                      placeholder="Ex: 3-1-1"
                      style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 6 }}>
                    <span>Charge</span>
                    <input
                      name="load"
                      placeholder="Ex: 40kg"
                      style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span>Notes</span>
                  <input
                    name="notes"
                    style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                  />
                </label>

                <button
                  type="submit"
                  style={{
                    justifySelf: 'start',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #111827',
                    background: '#111827',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Ajouter à la séance
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#6b7280', marginTop: 16 }}>Aucun exercice trouvé.</p>
      )}
    </main>
  )
}
