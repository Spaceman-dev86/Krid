import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'
import { Card, Container } from '../../components/marketing'
import SubmitButtonWithProgressClient from '../../components/SubmitButtonWithProgressClient'
import ProgramLimitPopupClient from '../../components/ProgramLimitPopupClient'

 type PostgrestErrorLike = { message?: string }

 type UntypedResult = { data: unknown; error: PostgrestErrorLike | null }

 type UntypedQuery = PromiseLike<UntypedResult> & {
   select: (columns: string) => UntypedQuery
   insert: (values: unknown) => UntypedQuery
   eq: (column: string, value: unknown) => UntypedQuery
   ilike: (column: string, pattern: string) => UntypedQuery
   or: (filters: string) => UntypedQuery
   in: (column: string, values: unknown[]) => UntypedQuery
   order: (column: string, opts: { ascending: boolean }) => UntypedQuery
   limit: (count: number) => UntypedQuery
   maybeSingle: () => Promise<UntypedResult>
 }

 type UntypedSupabase = {
   from: (table: string) => UntypedQuery
 }

export default async function DashboardIndexPage({
  searchParams,
}: {
  searchParams?: { error?: string | string[] }
}) {
  const supabase = await createClient()
  const supabaseUntyped = supabase as unknown as UntypedSupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: publicProgram4Weeks } = await supabaseUntyped
    .from('programs')
    .select('id,title')
    .eq('is_published', true)
    .ilike('title', '%semaine%')
    .or('title.ilike.%4%,title.ilike.%quatre%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const publicProgram4WeeksTyped = publicProgram4Weeks as unknown as { id: string; title: string | null } | null

  const { data: duoPhoneImage } = supabase.storage.from('home_page').getPublicUrl('duo_phone.png')
  const duoPhoneUrl = (duoPhoneImage as unknown as { publicUrl?: string } | null)?.publicUrl ?? null

  async function forkPublicProgram(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const supabaseUntyped = supabase as unknown as UntypedSupabase
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: existingPrograms } = await supabaseUntyped
      .from('programs')
      .select('id')
      .eq('coach_id', user.id)
      .limit(2)

    const typedExistingPrograms = (existingPrograms ?? []) as unknown as { id: string }[]
    if (typedExistingPrograms.length >= 1) {
      redirect('/dashboard?error=program_limit')
    }

    const programId = String(formData.get('program_id') ?? '')
    if (!programId) {
      redirect('/dashboard?error=missing_program_id')
    }

    const { data: sourceProgram } = await supabaseUntyped
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

    const { data: insertedProgram, error: insertProgramError } = await supabaseUntyped
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

    const insertedProgramTyped = insertedProgram as unknown as { id?: string } | null

    if (insertProgramError || !insertedProgramTyped?.id) {
      const msg = insertProgramError?.message ?? 'insert_program_failed'
      redirect(`/dashboard?error=${encodeURIComponent(msg)}`)
    }

    const newProgramId = String(insertedProgramTyped.id)

    const { data: sourceWeeks, error: sourceWeeksError } = await supabaseUntyped
      .from('program_weeks')
      .select('id,title,week_order')
      .eq('program_id', typedSourceProgram.id)
      .order('week_order', { ascending: true })

    if (sourceWeeksError) {
      redirect(`/dashboard?error=${encodeURIComponent(sourceWeeksError.message ?? 'source_weeks_failed')}`)
    }

    type SourceWeekRow = { id: string; title: string; week_order: number }
    const typedSourceWeeks = (sourceWeeks ?? []) as unknown as SourceWeekRow[]

    const { data: insertedWeeks, error: weeksInsertError } = await supabaseUntyped
      .from('program_weeks')
      .insert(
        typedSourceWeeks.map((w) => ({
          program_id: newProgramId,
          title: w.title,
          week_order: w.week_order,
        }))
      )
      .select('id,week_order')

    const insertedWeeksTyped = (insertedWeeks ?? []) as unknown as { id: string; week_order: number }[]

    if (weeksInsertError || insertedWeeksTyped.length !== typedSourceWeeks.length) {
      const msg = weeksInsertError?.message ?? 'insert_weeks_failed'
      redirect(`/dashboard?error=${encodeURIComponent(msg)}`)
    }

    const weekIdMap = new Map<string, string>()
    const newWeekIdByOrder = new Map<number, string>()
    for (const w of insertedWeeksTyped) newWeekIdByOrder.set(w.week_order, w.id)
    for (const w of typedSourceWeeks) {
      const newId = newWeekIdByOrder.get(w.week_order)
      if (newId) weekIdMap.set(w.id, newId)
    }

    const sourceWeekIds = typedSourceWeeks.map((w) => w.id)
    const { data: sourceSessions, error: sourceSessionsError } = sourceWeekIds.length
      ? await supabaseUntyped
          .from('sessions')
          .select('id,week_id,title,description,session_order')
          .in('week_id', sourceWeekIds)
          .order('session_order', { ascending: true })
      : { data: [], error: null }

    if (sourceSessionsError) {
      redirect(`/dashboard?error=${encodeURIComponent(sourceSessionsError.message ?? 'source_sessions_failed')}`)
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
      ? await supabaseUntyped.from('sessions').insert(sessionsToInsert).select('id,week_id,session_order')
      : { data: [] as { id: string; week_id: string; session_order: number }[] | null, error: null }

    const insertedSessionsTyped = (insertedSessions ?? []) as unknown as { id: string; week_id: string; session_order: number }[]

    if (sessionsInsertError || insertedSessionsTyped.length !== sessionsToInsert.length) {
      const msg = sessionsInsertError?.message ?? 'insert_sessions_failed'
      redirect(`/dashboard?error=${encodeURIComponent(msg)}`)
    }

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
      ? await supabaseUntyped
          .from('program_exercises')
          .select(
            'session_id,name,description,sets,reps,rest_time,tempo,load,video_url,notes,exercise_order,exercise_id'
          )
          .in('session_id', sourceSessionIds)
          .order('exercise_order', { ascending: true })
      : { data: [], error: null }

    if (sourceExercisesError) {
      redirect(`/dashboard?error=${encodeURIComponent(sourceExercisesError.message ?? 'source_exercises_failed')}`)
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
      ? await supabaseUntyped.from('program_exercises').insert(exercisesToInsert)
      : { error: null }

    if (exInsertError) {
      redirect(`/dashboard?error=${encodeURIComponent(exInsertError.message ?? 'unknown_error')}`)
    }

    redirect('/dashboard')
  }

  const { data: myPrograms } = await supabaseUntyped
    .from('programs')
    .select('id,title,created_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  type MyProgramRow = { id: string; title: string | null }
  const myProgramsTyped = (myPrograms ?? []) as unknown as MyProgramRow[]

  const errorParam = searchParams?.error
  const errorValue = Array.isArray(errorParam) ? errorParam[0] : errorParam
  const showProgramLimitError = errorValue === 'program_limit'

  return (
    <main className="min-h-screen bg-[#f5f5f5]">
      <Container className="py-10">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_420px] md:items-start md:gap-8">
          <div>
            {showProgramLimitError ? (
              <div className="mb-4 rounded-2xl bg-white p-4 text-sm font-semibold text-[#341c44] ring-1 ring-black/10">
                Limite atteinte : tu ne peux avoir qu’un seul programme.
              </div>
            ) : null}

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">
                  Voici un exemple de Dashboard fonctionnel qu&apos;on pourrait créeer enssemble
                </h1>
                <p className="text-sm text-black/60">Coach</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-extrabold text-[#341c44]">Programmes publics</h2>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {publicProgram4WeeksTyped ? (
                    <>
                      <Link
                        href={`/dashboard/programs/${publicProgram4WeeksTyped.id}`}
                        className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                      >
                        {publicProgram4WeeksTyped.title || 'Programme 4 semaines'}
                      </Link>
                      {myProgramsTyped.length >= 1 ? (
                        <ProgramLimitPopupClient
                          title="Limite atteinte"
                          message="Tu ne peux pas dupliquer un programme si tu en as déjà un en édition."
                          triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#341c44] text-white shadow-sm opacity-60"
                          triggerAriaLabel="Dupliquer"
                          triggerTitle="Dupliquer"
                          trigger={
                            <svg
                              viewBox="0 0 24 24"
                              width={22}
                              height={22}
                              aria-hidden
                              style={{ display: 'block', overflow: 'visible' }}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          }
                        />
                      ) : (
                        <form action={forkPublicProgram}>
                          <input type="hidden" name="program_id" value={publicProgram4WeeksTyped.id} />
                          <SubmitButtonWithProgressClient
                            label="Dupliquer"
                            iconOnly
                            icon={
                              <svg
                                viewBox="0 0 24 24"
                                width={22}
                                height={22}
                                aria-hidden
                                style={{ display: 'block', overflow: 'visible' }}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="9" y="9" width="11" height="11" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            }
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
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-black/60">Aucun programme public.</div>
                  )}
                </div>
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-extrabold text-[#341c44]">Mes programmes</h2>
                  {myProgramsTyped.length >= 1 ? (
                    <ProgramLimitPopupClient
                      title="Limite atteinte"
                      message="Tu ne peux pas créer un nouveau programme tant que tu en as déjà un."
                      triggerClassName="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#341c44] text-lg font-black text-white opacity-60"
                      triggerAriaLabel="Créer un nouveau programme"
                      triggerTitle="Créer un nouveau programme"
                      trigger={<span aria-hidden>+</span>}
                    />
                  ) : (
                    <Link
                      href="/dashboard/programs/new"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#341c44] text-lg font-black text-white shadow-sm hover:opacity-90"
                      aria-label="Créer un nouveau programme"
                      title="Créer un nouveau programme"
                    >
                      +
                    </Link>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {myProgramsTyped.length > 0 ? (
                    myProgramsTyped.map((p) => (
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

              <Link href="/dashboard/exercises" className="block" aria-label="Ouvrir la bibliothèque d'exercices">
                <Card className="hover:bg-[#f5f5f5]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-extrabold text-[#341c44]">Bibliotheque d&apos;exercice</h2>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#341c44]">
                    Accéder à tes exercices, variantes, médias et tags.
                  </div>
                </Card>
              </Link>

              <Link href="/dashboard/nutrition" className="block" aria-label="Ouvrir le plan nutritionnel">
                <Card className="hover:bg-[#f5f5f5]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-extrabold text-[#341c44]">Plan nutritionel</h2>
                  </div>
                  <div className="mt-2 text-sm text-black/60">Créer et suivre des plans nutritionnels pour tes clients.</div>
                </Card>
              </Link>

              <Link href="/dashboard/chat" className="block" aria-label="Ouvrir le chat client">
                <Card className="hover:bg-[#f5f5f5]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-extrabold text-[#341c44]">Chat client</h2>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#341c44]">
                    Échanger avec tes clients et centraliser leurs retours.
                  </div>
                </Card>
              </Link>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-extrabold text-[#341c44]">Calendrier</h2>
                </div>
                <Link
                  href="/dashboard/calendar"
                  className="mt-2 inline-flex text-sm font-semibold text-[#341c44]"
                  aria-label="Ouvrir le calendrier"
                >
                  Planifier les séances, bilans et rendez-vous.
                </Link>
              </Card>

              <div className="flex justify-center pt-2">
                <Link
                  href="/contact"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#341c44] px-6 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
                >
                  commander mon app
                </Link>
              </div>
            </div>
          </div>

          <aside className="hidden md:block">
            <div className="sticky top-24">
              <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/10">
                {duoPhoneUrl ? (
                  <img src={duoPhoneUrl} alt="" className="h-auto w-full" loading="lazy" />
                ) : (
                  <div className="grid aspect-[4/5] place-items-center bg-[#f5f5f5] text-sm font-semibold text-black/60">
                    Image indisponible
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  )
}
