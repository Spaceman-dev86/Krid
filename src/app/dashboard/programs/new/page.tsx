import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import { IconBack } from '../../../../components/ui/icons'

type UntypedQueryResult = { data: unknown; error: { message: string } | null }

type UntypedPostgrestBuilder = {
  select: (columns: string) => UntypedPostgrestBuilder
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => UntypedPostgrestBuilder
  update: (values: Record<string, unknown>) => UntypedPostgrestBuilder
  delete: () => UntypedPostgrestBuilder
  eq: (column: string, value: string | number | boolean | null) => UntypedPostgrestBuilder
  in: (column: string, values: string[]) => UntypedPostgrestBuilder
  order: (column: string, opts?: { ascending?: boolean }) => UntypedPostgrestBuilder
  limit: (count: number) => UntypedPostgrestBuilder
  maybeSingle: () => Promise<UntypedQueryResult>
}

type UntypedSupabaseClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
  }
  from: (table: string) => UntypedPostgrestBuilder
}

async function createUntypedClient() {
  return (await createClient()) as unknown as UntypedSupabaseClient
}

function PaletteStatic({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2">
      <div className="text-sm font-semibold text-[var(--brand)]">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-gray-500">{meta}</div>
    </div>
  )
}

export default async function NewProgramPage({
  searchParams,
}: {
  searchParams?: { scope?: string | string[] }
}) {
  const supabaseForPage = await createUntypedClient()
  const {
    data: { user: userForPage },
  } = await supabaseForPage.auth.getUser()

  if (!userForPage) {
    redirect('/login')
  }

  const { data: profileForPage } = await supabaseForPage
    .from('profiles')
    .select('role')
    .eq('id', userForPage.id)
    .maybeSingle()

  const typedProfileForPage = profileForPage as unknown as { role: string | null } | null
  const isAdminForPage = typedProfileForPage?.role === 'admin'
  const backHrefForPage = isAdminForPage ? '/admin' : '/dashboard'

  if (!isAdminForPage) {
    const { data: existingProgramsForPage } = (await (
      supabaseForPage.from('programs').select('id').eq('coach_id', userForPage.id).limit(2) as unknown as Promise<UntypedQueryResult>
    )) as UntypedQueryResult

    const typedExistingProgramsForPage = (existingProgramsForPage ?? []) as unknown as { id: string }[]
    if (typedExistingProgramsForPage.length >= 1) {
      redirect('/dashboard/programs?error=program_limit')
    }
  }

  const { data: exerciseLibraryData } = (await (supabaseForPage
    .from('exercise_library')
    .select('id,name,muscle_group')
    .order('name', { ascending: true })
    .limit(80) as unknown as Promise<UntypedQueryResult>)) as UntypedQueryResult

  const typedExerciseLibrary = (exerciseLibraryData ?? []) as unknown as {
    id: string
    name: string | null
    muscle_group: string | null
  }[]

  const uniqueMuscles: string[] = Array.from(
    new Set(typedExerciseLibrary.map((r) => r.muscle_group).filter((m): m is string => !!m))
  )

  async function createProgram(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
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
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    if (!isAdmin) {
      const { data: existingPrograms } = (await (
        supabase.from('programs').select('id').eq('coach_id', user.id).limit(2) as unknown as Promise<UntypedQueryResult>
      )) as UntypedQueryResult

      const typedExistingPrograms = (existingPrograms ?? []) as unknown as { id: string }[]
      if (typedExistingPrograms.length >= 1) {
        redirect(`${basePath}?error=program_limit`)
      }
    }

    const title = String(formData.get('title') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const goal = String(formData.get('goal') ?? '').trim()
    const level = String(formData.get('level') ?? '').trim()
    const duration = String(formData.get('duration') ?? '').trim()

    const rawScope = searchParams?.scope
    const scopeValue = Array.isArray(rawScope) ? rawScope[0] : rawScope
    const scope = scopeValue === 'public' || scopeValue === 'private' || scopeValue === 'template' ? scopeValue : undefined

    if (!title) {
      redirect(scope ? `${basePath}/new?scope=${encodeURIComponent(scope)}` : `${basePath}/new`)
    }

    const { data: insertedProgramData, error: insertError } = await supabase
      .from('programs')
      .insert({
        coach_id: user.id,
        title,
        description: description || null,
        goal: goal || null,
        level: level || null,
        duration: duration || null,
        is_template: scope === 'template',
        is_published: scope === 'public',
      })
      .select('id')
      .maybeSingle()

    const insertedProgram = insertedProgramData as unknown as { id: string } | null

    if (insertError || !insertedProgram?.id) {
      const base = scope ? `${basePath}/new?scope=${encodeURIComponent(scope)}` : `${basePath}/new`
      redirect(`${base}&error=${encodeURIComponent(insertError?.message ?? 'insert_failed')}`)
    }

    const programId = insertedProgram.id as string

    const weeksToInsert = Array.from({ length: 4 }).map((_, i) => ({
      program_id: programId,
      week_order: i,
      title: `Semaine ${i + 1}`,
    }))

    const { data: insertedWeeks, error: weeksError } = (await (
      supabase.from('program_weeks').insert(weeksToInsert).select('id,week_order') as unknown as Promise<UntypedQueryResult>
    )) as UntypedQueryResult

    if (weeksError) {
      redirect(`${basePath}/new?error=${encodeURIComponent(weeksError.message)}`)
    }

    const typedWeeks = ((insertedWeeks ?? []) as unknown as { id: string; week_order: number }[]).slice()
    typedWeeks.sort((a, b) => a.week_order - b.week_order)

    const sessionsToInsert: { week_id: string; session_order: number; title: string; description: string | null }[] = []
    for (const w of typedWeeks) {
      for (let i = 0; i < 4; i++) {
        sessionsToInsert.push({
          week_id: w.id,
          session_order: i,
          title: `Séance ${i + 1}`,
          description: null,
        })
      }
    }

    const { data: insertedSessions, error: sessionsError } = (await (
      supabase.from('sessions').insert(sessionsToInsert).select('id') as unknown as Promise<UntypedQueryResult>
    )) as UntypedQueryResult

    if (sessionsError) {
      redirect(`${basePath}/new?error=${encodeURIComponent(sessionsError.message)}`)
    }

    const typedSessions = (insertedSessions ?? []) as unknown as { id: string }[]
    const blocksToInsert = typedSessions.map((s) => ({
      program_session_id: s.id,
      position: 0,
      type: 'strength',
      title: null,
      notes: null,
    }))

    if (blocksToInsert.length) {
      const { error: blocksError } = (await (
        supabase.from('session_blocks').insert(blocksToInsert) as unknown as Promise<UntypedQueryResult>
      )) as UntypedQueryResult
      if (blocksError) {
        redirect(`${basePath}/new?error=${encodeURIComponent(blocksError.message)}`)
      }
    }

    redirect(`${basePath}/${programId}`)
  }

  const previewWeeks = Array.from({ length: 4 }).map((_, w) => ({
    id: `w${w + 1}`,
    title: `Semaine ${w + 1}`,
    sessions: Array.from({ length: 4 }).map((__, s) => ({
      id: `w${w + 1}-s${s + 1}`,
      title: `Training ${s + 1}`,
      description: '',
    })),
  }))

  const stickyTopClass = 'md:top-[136px]'

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-12 md:px-8">
      <header className="sticky top-16 z-30 -mx-4 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[var(--brand)]">Program Builder</div>
            <h1 className="mt-1 truncate text-lg font-extrabold text-gray-900 md:text-xl">Nouveau programme</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={backHrefForPage}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-900"
              aria-label="Retour"
            >
              <IconBack className="h-5 w-5" />
            </Link>

            <button
              form="create-program-form"
              type="submit"
              className="inline-flex h-10 items-center rounded-xl bg-[var(--brand)] px-4 text-sm font-extrabold text-white"
            >
              Créer
            </button>
          </div>
        </div>
      </header>

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="text-xs font-extrabold text-[var(--brand)]">Infos générales</div>
        <div className="mt-1 text-sm font-semibold text-gray-900">Ces infos apparaîtront en haut de la page programme.</div>

        <form id="create-program-form" action={createProgram} className="mt-3 grid gap-3">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1.5 md:col-span-1">
              <span className="text-sm font-semibold text-gray-800">Titre</span>
              <input
                name="title"
                required
                className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                placeholder="Ex: 8 semaines"
              />
            </label>

            <label className="grid gap-1.5 md:col-span-1">
              <span className="text-sm font-semibold text-gray-800">Niveau</span>
              <select name="level" defaultValue="" className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm">
                <option value="">Sélectionner…</option>
                <option value="Débutant">Débutant</option>
                <option value="Intermédiaire">Intermédiaire</option>
                <option value="Confirmé">Confirmé</option>
              </select>
            </label>

            <label className="grid gap-1.5 md:col-span-1">
              <span className="text-sm font-semibold text-gray-800">Durée</span>
              <input name="duration" className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm" placeholder="8 semaines" />
            </label>

            <label className="grid gap-1.5 md:col-span-1">
              <span className="text-sm font-semibold text-gray-800">Objectif</span>
              <input name="goal" className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm" placeholder="Hypertrophie" />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-gray-800">Description</span>
            <textarea
              name="description"
              rows={2}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Contexte, matériel, fréquence..."
            />
          </label>

          <div className="text-xs font-semibold text-gray-500">
            Note: l’éditeur complet (drag & drop + modifier/dupliquer/supprimer) sera disponible après création.
          </div>
        </form>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-[minmax(320px,1fr)_2fr_minmax(360px,1fr)]">
        <div className={`md:sticky ${stickyTopClass} md:h-[calc(100vh-120px)]`}>
          <div className="h-full overflow-auto">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] p-3">
              <div className="text-xs font-extrabold tracking-wide text-[var(--brand)]">Blocs</div>
              <div className="mt-1 text-sm font-extrabold tracking-tight text-[var(--text)]">Palette</div>
              <div className="mt-3 grid gap-2">
                <PaletteStatic label="Warm-up" meta="Bloc" />
                <PaletteStatic label="CrossFit" meta="Bloc" />
                <PaletteStatic label="Superset" meta="Bloc" />
              </div>
            </div>
          </div>
        </div>

        <div className={`md:sticky ${stickyTopClass}`}>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-[var(--brand)]">Structure</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">Semaines & entraînements (aperçu)</div>
              </div>

              <button
                type="button"
                disabled
                className="inline-flex h-9 items-center rounded-xl bg-gray-100 px-3 text-xs font-extrabold text-gray-500 opacity-60"
              >
                + Semaine
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              {previewWeeks.map((w) => (
                <details key={w.id} className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-gray-900">{w.title}</div>
                        <div className="mt-0.5 text-xs font-semibold text-gray-500">{w.sessions.length} trainings</div>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 opacity-60"
                        title="Ajouter une séance"
                      >
                        +
                      </button>
                    </div>
                  </summary>

                  <div className="mt-3 grid gap-2">
                    {w.sessions.map((s) => (
                      <div key={s.id} className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold text-gray-900">{s.title}</div>
                            <div className="mt-1 line-clamp-1 text-xs font-semibold text-gray-500">{s.description}</div>
                          </div>
                          <button
                            type="button"
                            disabled
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 opacity-60"
                            title="Ouvrir"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>

        <div className={`md:sticky ${stickyTopClass} md:h-[calc(100vh-120px)]`}>
          <div className="h-full overflow-auto">
            <div className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-[rgb(245,245,245)]">
              <div className="sticky top-0 z-10 rounded-t-2xl bg-[rgb(245,245,245)] px-3 pb-3 pt-3">
                <div className="text-xs font-extrabold text-[var(--brand)]">Exercices</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">Bibliothèque (drag &amp; drop)</div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    value=""
                    disabled
                    placeholder="Rechercher…"
                    className="h-10 w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-60"
                  />
                  <select
                    value=""
                    disabled
                    className="h-10 w-[120px] flex-none rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm disabled:opacity-60"
                  >
                    <option value="">Muscle</option>
                    {uniqueMuscles.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {typedExerciseLibrary.length ? (
                <div className="relative mt-3 px-3 pb-3 pr-1">
                  <div className="grid gap-2">
                    {typedExerciseLibrary.slice(0, 50).map((ex) => (
                      <div
                        key={ex.id}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm font-semibold text-gray-900"
                      >
                        <div className="truncate">{String(ex.name ?? '').trim() || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 px-3 pb-3 text-sm text-gray-600">Aucun exercice.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
