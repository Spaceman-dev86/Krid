import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { ProgramsHubHeader } from '@/src/components/programs/ProgramsHubHeader'
import { ProgramsZoneBar } from '@/src/components/programs/ProgramsZoneBar'
import { SessionsList } from '@/src/components/programs/SessionsList'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import {
  collectSessionFilterOptions,
  filterCoachSessions,
  listCoachSessions,
} from '@/src/lib/sessions/coachSessionLibrary'
import {
  attachSessionUsages,
  loadSessionTemplateUsages,
} from '@/src/lib/sessions/templateUsage'
import { isSchemaCacheError } from '@/src/lib/supabase/errors'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ q?: string; type?: string; sport?: string }>
    | { q?: string; type?: string; sport?: string }
}

export default async function SessionMinePage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  let items: Awaited<ReturnType<typeof listCoachSessions>> = []
  let loadError: string | null = null
  try {
    items = await listCoachSessions(supabase, user.id, 'mine')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur'
    loadError = isSchemaCacheError(msg) ? null : msg
  }

  const { sportIds, typeIds } = collectSessionFilterOptions(items)
  const [{ data: sportsRaw }, { data: typesRaw }] = await Promise.all([
    sportIds.length
      ? supabase.from('sports' as never).select('id, label').in('id' as never, sportIds as never)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    typeIds.length
      ? supabase
          .from('exercise_types' as never)
          .select('id, label')
          .in('id' as never, typeIds as never)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ])
  const sportOptions = ((sportsRaw ?? []) as { id: string; label: string }[]).map((s) => ({
    id: s.id,
    label: s.label,
  }))
  const typeOptions = ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => ({
    id: t.id,
    label: t.label,
  }))

  const filtered = filterCoachSessions(items, {
    q: params.q,
    type: params.type,
    sport: params.sport,
  })
  const usages = await loadSessionTemplateUsages(
    supabase,
    user.id,
    filtered.map((s) => s.id),
  )
  const withUsage = attachSessionUsages(filtered, usages)

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <ProgramsHubHeader
        title="Séances"
        subtitle={
          <>
            {filtered.length}
            {filtered.length !== items.length ? ` / ${items.length}` : ''} publiée
            {filtered.length > 1 ? 's' : ''} · prêtes pour tes programmes
          </>
        }
      />
      <ProgramsZoneBar
        kind="sessions"
        basePath="/programs/sessions/mine"
        typeOptions={typeOptions}
        sportOptions={sportOptions}
      />
      {loadError ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
      ) : (
        <SessionsList
          items={withUsage}
          mode="mine"
          returnTo="/programs/sessions/mine"
          emptyHint={
            items.length
              ? 'Aucune séance ne correspond aux filtres.'
              : 'Ta biblio est vide — crée une séance (+) ou Ajoute depuis Catalogue Krid.'
          }
        />
      )}
    </div>
  )
}
