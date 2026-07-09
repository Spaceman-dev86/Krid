import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import { IconBack } from '../../../../components/ui/icons'
import { EDITOR_SHELL_CLASS } from '../../../../components/program-editor-v2/editorLayoutConstants'
import {
  EDITOR_FIELD_BORDER_CLASS,
  EDITOR_PANEL_SHADOW_CLASS,
  EDITOR_TEXT_INPUT_X,
} from '../../../../components/program-editor-v2/ui/editorInputStyles'
import {
  EDITOR_BUILDER_HEADER_CLASS,
  EDITOR_SECTION_TITLE_CLASS,
} from '../../../../components/program-editor-v2/ui/editorSectionTitle'
import NewProgramLockedPreviewClient from './NewProgramLockedPreviewClient'

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
  range: (from: number, to: number) => UntypedPostgrestBuilder
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

async function fetchAllExerciseLibraryForNewProgram(client: UntypedSupabaseClient): Promise<
  { id: string; name: string | null; muscle_group: string | null }[]
> {
  const pageSize = 1000
  const rows: { id: string; name: string | null; muscle_group: string | null }[] = []
  for (let from = 0; ; from += pageSize) {
    const res = (await (client
      .from('exercise_library')
      .select('id,name,muscle_group')
      .order('name', { ascending: true })
      .range(from, from + pageSize - 1) as unknown as Promise<UntypedQueryResult>)) as UntypedQueryResult
    if (res.error) break
    const batch = (res.data ?? []) as { id: string; name: string | null; muscle_group: string | null }[]
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

const INFO_FIELD_CLASS = `rounded-xl bg-white outline-none transition ${EDITOR_FIELD_BORDER_CLASS}`

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

  const typedExerciseLibrary = await fetchAllExerciseLibraryForNewProgram(supabaseForPage)

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
    void typedSessions

    redirect(`${basePath}/${programId}`)
  }

  const previewWeeks = Array.from({ length: 4 }).map((_, w) => ({
    id: `w${w + 1}`,
    title: `Semaine ${w + 1}`,
    sessions: Array.from({ length: 4 }).map((__, s) => ({
      id: `w${w + 1}-s${s + 1}`,
      title: `Séance ${s + 1}`,
    })),
  }))

  const paletteBlocks = ['Bloc neutre', 'Warm-up', 'CrossFit', 'Superset']

  return (
    <main className={EDITOR_SHELL_CLASS}>
      <header className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white/95 px-4 py-2 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className={`min-w-0 truncate ${EDITOR_BUILDER_HEADER_CLASS}`}>Program Builder</div>

          <div className="flex items-center gap-2">
            <Link
              href={backHrefForPage}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-900"
              aria-label="Retour"
              title="Retour"
            >
              <IconBack className="h-5 w-5" />
            </Link>

            <button
              form="create-program-form"
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10"
            >
              Créer
            </button>
          </div>
        </div>
      </header>

      <div className="program-editor-main no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="px-4 py-3 md:px-6">
          <section className={`w-full rounded-2xl bg-white p-4 ${EDITOR_PANEL_SHADOW_CLASS}`}>
            <form id="create-program-form" action={createProgram} className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-sm font-semibold text-gray-800">Titre</span>
                <input
                  name="title"
                  required
                  className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} h-9 text-sm font-semibold text-[var(--brand)]`}
                  placeholder="Ex: 8 semaines"
                />
              </label>

              <div className="text-sm font-semibold text-gray-900">
                Ces infos apparaîtront en haut de la page programme.
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="grid gap-1.5 md:col-span-1">
                  <span className="text-sm font-semibold text-gray-800">Description</span>
                  <textarea
                    name="description"
                    rows={2}
                    className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} py-2 text-sm`}
                    placeholder="Contexte, matériel, fréquence..."
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Objectif</span>
                  <input
                    name="goal"
                    className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} h-9 text-sm`}
                    placeholder="Hypertrophie"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Niveau</span>
                  <select name="level" defaultValue="" className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} h-9 text-sm`}>
                    <option value="">Sélectionner…</option>
                    <option value="Débutant">Débutant</option>
                    <option value="Intermédiaire">Intermédiaire</option>
                    <option value="Confirmé">Confirmé</option>
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Durée</span>
                  <input
                    name="duration"
                    className={`${INFO_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} h-9 text-sm`}
                    placeholder="8 semaines"
                  />
                </label>
              </div>
            </form>
          </section>
        </div>

        <NewProgramLockedPreviewClient
          paletteBlocks={paletteBlocks}
          previewWeeks={previewWeeks}
          exercises={typedExerciseLibrary}
          uniqueMuscles={uniqueMuscles}
        />

        <div aria-hidden className="h-16 shrink-0" />
      </div>
    </main>
  )
}
