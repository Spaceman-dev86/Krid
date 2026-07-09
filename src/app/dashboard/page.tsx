import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'
import { Card, Container } from '../../components/marketing'
import SubmitButtonWithProgressClient from '../../components/SubmitButtonWithProgressClient'
import ProgramLimitPopupClient from '../../components/ProgramLimitPopupClient'
import DuplicatePublicProgramPopupClient from '../../components/DuplicatePublicProgramPopupClient'
import { ProgramEditorLink } from '../../components/ProgramEditorNavigationClient'

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

const coachProgramPillClass =
  'inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5] disabled:opacity-60'

const coachDashboardCardClass = '!ring-[var(--brand)]/35'

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

  const { data: publicPrograms } = await supabaseUntyped
    .from('programs')
    .select('id,title')
    .eq('is_published', true)
    .eq('is_template', false)
    .order('created_at', { ascending: false })

  const publicProgramsTyped = (publicPrograms ?? []) as unknown as { id: string; title: string | null }[]

  const muscuPreviewProgram =
    publicProgramsTyped.find((p) => (p.title ?? '').trim().toLowerCase() === 'muscu') ??
    publicProgramsTyped.find((p) => (p.title ?? '').trim().toLowerCase().includes('muscu')) ??
    publicProgramsTyped[0] ??
    null

  const duoPhoneUrl = supabase.storage.from('home_page').getPublicUrl('duo_phone.png').data.publicUrl

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
    <main className="min-h-screen bg-transparent">
      <Container className="py-10">
        <div className="grid gap-6 min-[820px]:grid-cols-[minmax(0,1fr)_420px] min-[820px]:items-start min-[820px]:gap-8">
          <div className="grid gap-4">
            {showProgramLimitError ? (
              <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-[#341c44] ring-1 ring-black/10">
                Limite atteinte : tu ne peux avoir qu’un seul programme.
              </div>
            ) : null}

            <Card className={`${coachDashboardCardClass} p-0`}>
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="grid gap-2">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#341c44] ring-1 ring-black/10">
                      <span className="inline-flex h-2 w-2 rounded-full bg-[#341c44]" aria-hidden />
                      Dashboard coach
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44] sm:text-3xl">
                      Voici une démo qui te permet de créer tes programmes, gérer tes clients et accélérer ton business.
                    </h1>
                    <p className="max-w-2xl text-sm text-black/60">
                      Si tu veux le même système à ton nom (site + programmes + paiement + espace client), on le construit
                      sur-mesure.
                    </p>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <Link
                      href="/contact"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#341c44] px-5 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
                    >
                      Commander mon app
                    </Link>
                    {muscuPreviewProgram?.id ? (
                      <Link
                        href={`/dashboard/preview/${muscuPreviewProgram.id}`}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                      >
                        Rendu programme
                      </Link>
                    ) : (
                      <div className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 opacity-60">
                        Rendu programme
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
                    <div className="text-xs font-bold text-black/50">Outils personnalisables</div>
                    <div className="mt-1 text-sm font-extrabold leading-snug text-[#341c44]">
                      Planning • Nutrition • Chat • Bibliothèque d&apos;exercices • Program builder
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
                    <div className="text-xs font-bold text-black/50">Objectif</div>
                    <div className="mt-1 text-sm font-extrabold leading-snug text-[#341c44]">
                      Professionnalise
                      <br />
                      ton business
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="@container/programs">
              <div className="grid grid-cols-1 gap-4 @[34rem]:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
              <Card className={`${coachDashboardCardClass} min-w-0`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-extrabold text-[#341c44]">Programmes publics</h2>
                  <div className="text-xs font-semibold text-black/50">Consulte en aperçu ou duplique un exemple.</div>
                </div>

                <div className="mt-3 grid gap-2">
                  {publicProgramsTyped.length > 0 ? (
                    publicProgramsTyped.map((p) => (
                      <div key={p.id} className="flex min-w-0 items-center gap-2">
                        <Link
                          href={`/dashboard/preview/${p.id}`}
                          className={`${coachProgramPillClass} min-w-0 flex-1 overflow-hidden`}
                          title={p.title || 'Programme public'}
                        >
                          <span className="block truncate">{p.title || 'Programme public'}</span>
                        </Link>

                        <div className="shrink-0">
                          {myProgramsTyped.length >= 1 ? (
                          <ProgramLimitPopupClient
                            title="Limite atteinte"
                            message="Tu ne peux pas dupliquer un programme si tu en as déjà un en édition."
                            triggerClassName="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#341c44] text-white opacity-60"
                            triggerAriaLabel="Dupliquer"
                            triggerTitle="Dupliquer"
                            trigger={
                              <svg
                                viewBox="0 0 24 24"
                                width={20}
                                height={20}
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
                            <input type="hidden" name="program_id" value={p.id} />
                            <SubmitButtonWithProgressClient
                              label="Dupliquer"
                              iconOnly
                              icon={
                                <svg
                                  viewBox="0 0 24 24"
                                  width={20}
                                  height={20}
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
                                width: 40,
                                height: 40,
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
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-black/60">Aucun programme public.</div>
                  )}
                </div>
              </Card>

              <Card className={`${coachDashboardCardClass} min-w-0`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate text-sm font-extrabold text-[#341c44]">Mes programmes</h2>
                  <div className="shrink-0">
                  {myProgramsTyped.length >= 1 ? (
                    <ProgramLimitPopupClient
                      title="Limite atteinte"
                      message="Tu ne peux pas créer un nouveau programme tant que tu en as déjà un."
                      triggerClassName="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5f5f5] text-[#341c44] ring-1 ring-black/10 opacity-60"
                      triggerAriaLabel="Créer un nouveau programme"
                      triggerTitle="Créer un nouveau programme"
                      trigger={
                        <svg
                          viewBox="0 0 24 24"
                          width={18}
                          height={18}
                          aria-hidden
                          style={{ display: 'block' }}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>
                      }
                    />
                  ) : (
                    <Link
                      href="/dashboard/programs/new"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5f5f5] text-[#341c44] ring-1 ring-black/10 hover:bg-white"
                      aria-label="Créer un nouveau programme"
                      title="Créer un nouveau programme"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width={18}
                        height={18}
                        aria-hidden
                        style={{ display: 'block' }}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </Link>
                  )}
                  </div>
                </div>

                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                  {myProgramsTyped.length > 0 ? (
                    myProgramsTyped.map((p) => (
                      <ProgramEditorLink
                        key={p.id}
                        href={`/dashboard/programs/${p.id}`}
                        className={`${coachProgramPillClass} max-w-full truncate`}
                      >
                        {p.title || 'Programme'}
                      </ProgramEditorLink>
                    ))
                  ) : (
                    <div className="text-sm text-black/60">Aucun programme.</div>
                  )}
                </div>
              </Card>
              </div>
            </div>

            <Card className={coachDashboardCardClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-extrabold text-[#341c44]">Actions rapides</h2>
                <div className="text-xs font-semibold text-black/50">Tout ce dont tu as besoin, au même endroit.</div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Link href="/dashboard/chat" className="block" aria-label="Ouvrir le chat client">
                  <div className="grid gap-2 rounded-2xl bg-[#f5f5f5] p-4 ring-1 ring-black/10 transition hover:bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="text-sm font-extrabold text-[#341c44]">Chat client</div>
                        <div className="text-xs font-semibold text-black/50">Centralise les retours, améliore la rétention.</div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10">
                        →
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/dashboard/exercises" className="block" aria-label="Ouvrir la bibliothèque d'exercices">
                  <div className="grid gap-2 rounded-2xl bg-[#f5f5f5] p-4 ring-1 ring-black/10 transition hover:bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="text-sm font-extrabold text-[#341c44]">Bibliothèque d’exercices</div>
                        <div className="text-xs font-semibold text-black/50">Tags, variantes, médias, organisation.</div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10">
                        →
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/dashboard/nutrition" className="block" aria-label="Ouvrir le plan nutritionnel">
                  <div className="grid gap-2 rounded-2xl bg-[#f5f5f5] p-4 ring-1 ring-black/10 transition hover:bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="text-sm font-extrabold text-[#341c44]">Nutrition</div>
                        <div className="text-xs font-semibold text-black/50">Plans & recettes pour tes clients.</div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10">
                        →
                      </div>
                    </div>
                  </div>
                </Link>

                <Link href="/dashboard/calendar" className="block" aria-label="Ouvrir le calendrier">
                  <div className="grid gap-2 rounded-2xl bg-[#f5f5f5] p-4 ring-1 ring-black/10 transition hover:bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="text-sm font-extrabold text-[#341c44]">Calendrier</div>
                        <div className="text-xs font-semibold text-black/50">Séances, bilans, rendez-vous.</div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10">
                        →
                      </div>
                    </div>
                  </div>
                </Link>
              </div>

              <div className="mt-3">
                <div className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-black/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid gap-1">
                      <div className="text-sm font-extrabold text-[#341c44]">Créer un programme</div>
                      <div className="text-xs font-semibold text-black/50">Structure, semaines, séances, exercices.</div>
                    </div>
                    {myProgramsTyped.length >= 1 ? (
                      <ProgramLimitPopupClient
                        title="Limite atteinte"
                        message="Tu ne peux pas créer un nouveau programme tant que tu en as déjà un."
                        triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#341c44] text-lg font-black text-white opacity-60"
                        triggerAriaLabel="Créer un nouveau programme"
                        triggerTitle="Créer un nouveau programme"
                        trigger={<span aria-hidden>+</span>}
                      />
                    ) : (
                      <Link
                        href="/dashboard/programs/new"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#341c44] text-lg font-black text-white shadow-sm hover:opacity-90"
                        aria-label="Créer un nouveau programme"
                        title="Créer un nouveau programme"
                      >
                        +
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex justify-center pt-1 min-[820px]:hidden">
              <Link
                href="/contact"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#341c44] px-6 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
              >
                Commander mon app
              </Link>
            </div>
          </div>

          <aside className="hidden min-[820px]:block">
            <div className="sticky top-24 grid gap-4">
              <Card className={`${coachDashboardCardClass} overflow-hidden p-0`}>
                <div className="p-5 sm:p-6">
                  <div className="text-sm font-extrabold text-[#341c44]">Ton app à ton nom</div>
                  <div className="mt-1 text-sm text-black/60">
                    Je te livre le même système, brandé pour toi, prêt à vendre tes programmes.
                  </div>
                  <div className="mt-4 grid gap-2">
                    <Link
                      href="/contact"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#341c44] px-5 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
                    >
                      Commander mon app
                    </Link>
                    <Link
                      href="/mon-app"
                      className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                    >
                      Voir ce que ça inclut
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-2xl bg-[#f5f5f5] p-4 ring-1 ring-black/10">
                    <div className="text-xs font-extrabold text-[#341c44]">Inclus</div>
                    <div className="grid gap-1 text-xs font-semibold text-black/60">
                      <div>• Site vitrine premium</div>
                      <div>• Dashboard coach + espace client</div>
                      <div>• Programmes, nutrition, planning, chat</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-black/5">
                  {duoPhoneUrl ? (
                    <img src={duoPhoneUrl} alt="" className="h-auto w-full" loading="lazy" />
                  ) : (
                    <div className="grid aspect-[4/5] place-items-center bg-[#f5f5f5] text-sm font-semibold text-black/60">
                      Image indisponible
                    </div>
                  )}
                </div>
              </Card>

              <Card className={coachDashboardCardClass}>
                <div className="text-sm font-extrabold text-[#341c44]">Conseil rapide</div>
                <div className="mt-2 text-sm text-black/60">
                  Tu peux soit dupliquer un programme public, soit partir de zéro et construire ton programme étape par étape.
                </div>
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      {myProgramsTyped.length >= 1 ? (
                        <ProgramLimitPopupClient
                          title="Limite atteinte"
                          message="Tu ne peux pas dupliquer un programme si tu en as déjà un en édition."
                          triggerClassName="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 opacity-60"
                          triggerAriaLabel="Dupliquer"
                          triggerTitle="Dupliquer"
                          trigger={<span aria-hidden>Dupliquer</span>}
                        />
                      ) : (
                        <DuplicatePublicProgramPopupClient
                          publicPrograms={publicProgramsTyped}
                          canDuplicate={myProgramsTyped.length < 1}
                          forkPublicProgram={forkPublicProgram}
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      {myProgramsTyped.length >= 1 ? (
                        <ProgramLimitPopupClient
                          title="Limite atteinte"
                          message="Tu ne peux pas créer un nouveau programme tant que tu en as déjà un."
                          triggerClassName="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 opacity-60"
                          triggerAriaLabel="Nouveau programme"
                          triggerTitle="Nouveau programme"
                          trigger={<span aria-hidden>Nouveau programme</span>}
                        />
                      ) : (
                        <Link
                          href="/dashboard/programs/new"
                          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                        >
                          Nouveau programme
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </aside>
        </div>
      </Container>
    </main>
  )
}
