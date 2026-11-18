import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CoachQueryFlash } from '../../../../components/coach/CoachQueryFlash'
import { BlocksList } from '../../../../components/exercises/BlocksList'
import { ExercisesHubHeader } from '../../../../components/exercises/ExercisesHubHeader'
import { ExercisesZoneBar } from '../../../../components/exercises/ExercisesZoneBar'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import {
  collectBlockFilterOptions,
  filterBlockRows,
  listCoachBlocks,
} from '../../../../lib/blocks/library'
import {
  attachBlockUsages,
  loadBlockTemplateUsages,
} from '../../../../lib/blocks/templateUsage'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{
        error?: string
        deleted?: string
        forked?: string
        q?: string
        sport?: string
        type?: string
      }>
    | {
        error?: string
        deleted?: string
        forked?: string
        q?: string
        sport?: string
        type?: string
      }
}

export default async function BlocksBrouillonPage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  let items: Awaited<ReturnType<typeof listCoachBlocks>> = []
  let loadError: string | null = null
  try {
    items = await listCoachBlocks(supabase, user.id, 'draft')
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  const { sportOptions, typeOptions } = collectBlockFilterOptions(items)
  const filtered = filterBlockRows(items, {
    q: params.q,
    sport: params.sport,
    type: params.type,
  })
  const usages = await loadBlockTemplateUsages(
    supabase,
    user.id,
    filtered.map((b) => b.id),
  )
  const withUsage = attachBlockUsages(filtered, usages)

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            forked: { tone: 'success', message: 'Copié en brouillon depuis Krid' },
            deleted: { tone: 'success', message: 'Bloc archivé' },
          }}
        />
      </Suspense>

      <ExercisesHubHeader
        title="Blocs"
        subtitle={
          <>
            {filtered.length}
            {filtered.length !== items.length ? ` / ${items.length}` : ''} brouillon
            {filtered.length > 1 ? 's' : ''} · non visibles dans le builder
          </>
        }
      />

      <ExercisesZoneBar
        kind="blocks"
        basePath="/exercises/blocks/brouillon"
        sportOptions={sportOptions}
        typeOptions={typeOptions}
      />

      {loadError ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
      ) : null}

      <BlocksList
        items={withUsage}
        mode="brouillon"
        returnTo="/exercises/blocks/brouillon"
        emptyHint={
          items.length ? 'Aucun brouillon ne correspond aux filtres.' : 'Aucun brouillon.'
        }
      />
    </div>
  )
}
