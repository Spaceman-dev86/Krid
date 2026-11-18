import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { ExercisesHubHeader } from '../../../components/exercises/ExercisesHubHeader'
import { ExercisesList } from '../../../components/exercises/ExercisesList'
import { ExercisesZoneBar } from '../../../components/exercises/ExercisesZoneBar'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import {
  collectExerciseFilterOptions,
  filterExerciseRows,
} from '../../../lib/exercises/filterExercises'
import {
  listCoachForkedKridSourceIds,
  listTrainlyExercises,
  withExerciseMediaUrls,
} from '../../../lib/exercises/library'
import { isSchemaCacheError } from '../../../lib/supabase/errors'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; q?: string; type?: string; sport?: string }>
    | { error?: string; q?: string; type?: string; sport?: string }
}

/** Catalogue Krid exercices. */
export default async function ExercisesKridCataloguePage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  let items: Awaited<ReturnType<typeof listTrainlyExercises>> = []
  let forkedIds: string[] = []
  let loadError: string | null = null
  try {
    items = await listTrainlyExercises(supabase)
    const forked = await listCoachForkedKridSourceIds(supabase, user.id)
    forkedIds = [...forked]
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur'
    loadError = isSchemaCacheError(msg) ? null : msg
  }

  const { typeOptions, sportOptions } = collectExerciseFilterOptions(items)
  const filtered = await withExerciseMediaUrls(
    supabase,
    filterExerciseRows(items, {
      q: params.q,
      type: params.type,
      sport: params.sport,
    }),
  )

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            forked: { tone: 'success', message: 'Copié en brouillon' },
            deleted: { tone: 'success', message: 'Exercice archivé' },
          }}
        />
      </Suspense>

      <ExercisesHubHeader
        title="Exercices"
        subtitle="Catalogue Krid · déjà dispo dans ton builder · Ajouter = copie perso à personnaliser"
      />

      <ExercisesZoneBar
        kind="exercises"
        basePath="/exercises/catalogue"
        typeOptions={typeOptions}
        sportOptions={sportOptions}
      />

      {loadError ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
      ) : null}

      <ExercisesList
        items={filtered}
        mode="krid"
        forkedSourceIds={forkedIds}
        emptyHint={
          items.length
            ? 'Aucun exercice ne correspond aux filtres.'
            : 'Le catalogue Krid est encore vide.'
        }
      />
    </div>
  )
}
