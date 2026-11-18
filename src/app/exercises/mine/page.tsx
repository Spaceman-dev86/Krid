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
import { listCoachExercises, withExerciseMediaUrls } from '../../../lib/exercises/library'
import {
  attachExerciseUsages,
  loadExerciseTemplateUsages,
} from '../../../lib/exercises/templateUsage'
import { isSchemaCacheError } from '../../../lib/supabase/errors'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{
        error?: string
        deleted?: string
        saved?: string
        q?: string
        type?: string
        sport?: string
      }>
    | {
        error?: string
        deleted?: string
        saved?: string
        q?: string
        type?: string
        sport?: string
      }
}

export default async function ExercisesMinePage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  let items: Awaited<ReturnType<typeof listCoachExercises>> = []
  let loadError: string | null = null
  try {
    items = await listCoachExercises(supabase, user.id, 'published')
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
  const usages = await loadExerciseTemplateUsages(
    supabase,
    user.id,
    filtered.map((ex) => ex.id),
  )
  const withUsage = attachExerciseUsages(filtered, usages)

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            deleted: { tone: 'success', message: 'Exercice archivé' },
          }}
        />
      </Suspense>

      <ExercisesHubHeader
        title="Exercices"
        subtitle={
          <>
            {filtered.length}
            {filtered.length !== items.length ? ` / ${items.length}` : ''} publié
            {filtered.length > 1 ? 's' : ''} · prêts pour tes programmes
          </>
        }
      />

      <ExercisesZoneBar
        kind="exercises"
        basePath="/exercises/mine"
        typeOptions={typeOptions}
        sportOptions={sportOptions}
      />

      {loadError ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
      ) : null}

      <ExercisesList
        items={withUsage}
        mode="mine"
        returnTo="/exercises/mine"
        emptyHint={
          items.length
            ? 'Aucun exercice ne correspond aux filtres.'
            : 'Ta biblio est vide — crée un exercice (+) ou Ajoute depuis Catalogue Krid.'
        }
      />
    </div>
  )
}
