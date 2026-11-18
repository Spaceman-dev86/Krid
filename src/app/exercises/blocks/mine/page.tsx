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
import { isSchemaCacheError } from '../../../../lib/supabase/errors'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; deleted?: string; q?: string; sport?: string; type?: string }>
    | { error?: string; deleted?: string; q?: string; sport?: string; type?: string }
}

export default async function BlocksMinePage({ searchParams }: Props) {
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
    items = await listCoachBlocks(supabase, user.id, 'published')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur'
    loadError = isSchemaCacheError(msg) ? null : msg
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
            deleted: { tone: 'success', message: 'Bloc archivé' },
          }}
        />
      </Suspense>

      <ExercisesHubHeader
        title="Blocs"
        subtitle={
          <>
            {filtered.length}
            {filtered.length !== items.length ? ` / ${items.length}` : ''} publié
            {filtered.length > 1 ? 's' : ''} · prêts pour tes programmes
          </>
        }
      />

      <ExercisesZoneBar
        kind="blocks"
        basePath="/exercises/blocks/mine"
        sportOptions={sportOptions}
        typeOptions={typeOptions}
      />

      {loadError ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
      ) : null}

      <BlocksList
        items={withUsage}
        mode="mine"
        returnTo="/exercises/blocks/mine"
        emptyHint={
          items.length
            ? 'Aucun bloc ne correspond aux filtres.'
            : 'Ta biblio de blocs est vide — crée un bloc (+) ou Ajoute depuis Catalogue Krid.'
        }
      />
    </div>
  )
}
