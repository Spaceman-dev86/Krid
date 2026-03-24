import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'
import { Card, Container } from '../../components/marketing'
import SubmitButtonWithProgressClient from '../../components/SubmitButtonWithProgressClient'

export default async function DashboardIndexPage() {
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

  const role = profile?.role

  if (role === 'admin') {
    redirect('/admin')
  }

  const { data: publicProgram4Weeks } = await supabase
    .from('programs')
    .select('id,title')
    .eq('is_published', true)
    .ilike('title', '%semaine%')
    .or('title.ilike.%4%,title.ilike.%quatre%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  async function forkPublicProgram(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const programId = String(formData.get('program_id') ?? '')
    if (!programId) {
      redirect('/dashboard?error=missing_program_id')
    }

    const { data: sourceProgram } = await supabase
      .from('programs')
      .select('id,title,description,goal,level,duration,image_url,is_published')
      .eq('id', programId)
      .maybeSingle()

    type SourceProgramRow = {
      id: string
      title: string
      description: string | null
      goal: string | null
      level: string | null
      duration: string | null
      image_url: string | null
      is_published: boolean
    }

    const typedSourceProgram = sourceProgram as unknown as SourceProgramRow | null
    if (!typedSourceProgram || !typedSourceProgram.is_published) {
      redirect('/dashboard?error=not_public')
    }

    const { data: insertedProgram, error: insertProgramError } = await supabase
      .from('programs')
      .insert({
        coach_id: user.id,
        title: `${typedSourceProgram.title} (copie)`,
        description: typedSourceProgram.description,
        goal: typedSourceProgram.goal,
        level: typedSourceProgram.level,
        duration: typedSourceProgram.duration,
        image_url: typedSourceProgram.image_url,
        is_published: false,
      })
      .select('id')
      .maybeSingle()

    if (insertProgramError || !insertedProgram?.id) {
      const msg = insertProgramError?.message ?? 'insert_program_failed'
      redirect(`/dashboard?error=${encodeURIComponent(msg)}`)
    }

    const newProgramId = insertedProgram.id as unknown as string

    const { data: sourceWeeks, error: sourceWeeksError } = await supabase
      .from('program_weeks')
      .select('id,title,week_order')
      .eq('program_id', typedSourceProgram.id)
      .order('week_order', { ascending: true })

    if (sourceWeeksError) {
      redirect(`/dashboard?error=${encodeURIComponent(sourceWeeksError.message)}`)
    }

    type SourceWeekRow = { id: string; title: string; week_order: number }
    const typedSourceWeeks = (sourceWeeks ?? []) as unknown as SourceWeekRow[]

    const { data: insertedWeeks, error: weeksInsertError } = await supabase
      .from('program_weeks')
      .insert(
        typedSourceWeeks.map((w) => ({
          program_id: newProgramId,
          title: w.title,
          week_order: w.week_order,
        }))
      )
      .select('id,week_order')

    if (weeksInsertError || !insertedWeeks || insertedWeeks.length !== typedSourceWeeks.length) {
      const msg = weeksInsertError?.message ?? 'insert_weeks_failed'
      redirect(`/dashboard?error=${encodeURIComponent(msg)}`)
    }

    const insertedWeeksTyped = insertedWeeks as unknown as { id: string; week_order: number }[]

    const weekIdMap = new Map<string, string>()
    const newWeekIdByOrder = new Map<number, string>()
    for (const w of insertedWeeksTyped) newWeekIdByOrder.set(w.week_order, w.id)
    for (const w of typedSourceWeeks) {
      const newId = newWeekIdByOrder.get(w.week_order)
      if (newId) weekIdMap.set(w.id, newId)
    }

    const sourceWeekIds = typedSourceWeeks.map((w) => w.id)
    const { data: sourceSessions, error: sourceSessionsError } = sourceWeekIds.length
      ? await supabase
          .from('sessions')
          .select('id,week_id,title,description,session_order')
          .in('week_id', sourceWeekIds)
          .order('session_order', { ascending: true })
      : { data: [], error: null }

    if (sourceSessionsError) {
      redirect(`/dashboard?error=${encodeURIComponent(sourceSessionsError.message)}`)
    }

    type SourceSessionRow = {
      id: string
      week_id: string
      title: string
      description: string | null
      session_order: number
    }
    const typedSourceSessions = (sourceSessions ?? []) as unknown as SourceSessionRow[]

    const sessionsToInsert = typedSourceSessions
      .map((s) => {
        const newWeekId = weekIdMap.get(s.week_id)
        if (!newWeekId) return null
        return {
          week_id: newWeekId,
          title: s.title,
          description: s.description,
          session_order: s.session_order,
        }
      })
      .filter((v): v is { week_id: string; title: string; description: string | null; session_order: number } => !!v)

    const { data: insertedSessions, error: sessionsInsertError } = sessionsToInsert.length
      ? await supabase.from('sessions').insert(sessionsToInsert).select('id,week_id,session_order')
      : { data: [] as { id: string; week_id: string; session_order: number }[] | null, error: null }

    if (sessionsInsertError || !insertedSessions || insertedSessions.length !== sessionsToInsert.length) {
      const msg = sessionsInsertError?.message ?? 'insert_sessions_failed'
      redirect(`/dashboard?error=${encodeURIComponent(msg)}`)
    }

    const insertedSessionsTyped = insertedSessions as unknown as { id: string; week_id: string; session_order: number }[]

    const sessionIdMap = new Map<string, string>()
    const newSessionIdByWeekAndOrder = new Map<string, Map<number, string>>()
    for (const s of insertedSessionsTyped) {
      const m = newSessionIdByWeekAndOrder.get(s.week_id) ?? new Map<number, string>()
      m.set(s.session_order, s.id)
      newSessionIdByWeekAndOrder.set(s.week_id, m)
    }
    for (const s of typedSourceSessions) {
      const newWeekId = weekIdMap.get(s.week_id)
      if (!newWeekId) continue
      const newId = newSessionIdByWeekAndOrder.get(newWeekId)?.get(s.session_order)
      if (newId) sessionIdMap.set(s.id, newId)
    }

    const sourceSessionIds = typedSourceSessions.map((s) => s.id)
    const { data: sourceExercises, error: sourceExercisesError } = sourceSessionIds.length
      ? await supabase
          .from('program_exercises')
          .select(
            'session_id,name,description,sets,reps,rest_time,tempo,load,video_url,notes,exercise_order,exercise_id'
          )
          .in('session_id', sourceSessionIds)
          .order('exercise_order', { ascending: true })
      : { data: [], error: null }

    if (sourceExercisesError) {
      redirect(`/dashboard?error=${encodeURIComponent(sourceExercisesError.message)}`)
    }

    type SourceExerciseRow = {
      session_id: string
      name: string
      description: string | null
      sets: number | null
      reps: number | null
      rest_time: string | null
      tempo: string | null
      load: string | null
      video_url: string | null
      notes: string | null
      exercise_order: number
      exercise_id: string | null
    }

    const typedSourceExercises = (sourceExercises ?? []) as unknown as SourceExerciseRow[]

    const exercisesToInsert = typedSourceExercises
      .map((ex) => {
        const newSessionId = sessionIdMap.get(ex.session_id)
        if (!newSessionId) return null
        return {
          session_id: newSessionId,
          name: ex.name,
          description: ex.description,
          sets: ex.sets,
          reps: ex.reps,
          rest_time: ex.rest_time,
          tempo: ex.tempo,
          load: ex.load,
          video_url: ex.video_url,
          notes: ex.notes,
          exercise_order: ex.exercise_order,
          exercise_id: ex.exercise_id,
        }
      })
      .filter(
        (
          v
        ): v is {
          session_id: string
          name: string
          description: string | null
          sets: number | null
          reps: number | null
          rest_time: string | null
          tempo: string | null
          load: string | null
          video_url: string | null
          notes: string | null
          exercise_order: number
          exercise_id: string | null
        } => !!v
      )

    const { error: exInsertError } = exercisesToInsert.length
      ? await supabase.from('program_exercises').insert(exercisesToInsert)
      : { error: null }

    if (exInsertError) {
      redirect(`/dashboard?error=${encodeURIComponent(exInsertError.message)}`)
    }

    redirect('/dashboard')
  }

  const { data: myPrograms } = await supabase
    .from('programs')
    .select('id,title,created_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-[#f5f5f5]">
      <Container className="py-10">
        <div className="grid gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">Dashboard</h1>
          <p className="text-sm text-black/60">Coach</p>
        </div>

        <div className="mt-6 grid gap-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[#341c44]">Programmes publics</h2>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {publicProgram4Weeks ? (
                <>
                  <Link
                    href={`/dashboard/programs/${publicProgram4Weeks.id}`}
                    className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                  >
                    {publicProgram4Weeks.title || 'Programme 4 semaines'}
                  </Link>
                  <form action={forkPublicProgram}>
                    <input type="hidden" name="program_id" value={publicProgram4Weeks.id} />
                    <SubmitButtonWithProgressClient
                      label="Dupliquer"
                      iconOnly
                      icon="⧉"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 16,
                        border: '1px solid #00000000',
                        background: '#341c44',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        flex: '0 0 auto',
                      }}
                    />
                  </form>
                </>
              ) : (
                <div className="text-sm text-black/60">Aucun programme public.</div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[#341c44]">Mes programmes</h2>
              <Link
                href="/dashboard/programs/new"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#341c44] text-lg font-black text-white shadow-sm hover:opacity-90"
                aria-label="Créer un nouveau programme"
                title="Créer un nouveau programme"
              >
                +
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {myPrograms && myPrograms.length > 0 ? (
                myPrograms.map((p) => (
                  <Link
                    key={p.id}
                    href={`/dashboard/programs/${p.id}`}
                    className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                  >
                    {p.title || 'Programme'}
                  </Link>
                ))
              ) : (
                <div className="text-sm text-black/60">Aucun programme.</div>
              )}
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
