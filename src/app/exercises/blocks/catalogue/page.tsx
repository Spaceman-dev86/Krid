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
  listCoachForkedKridBlockSourceIds,
  listKridBlocks,
} from '../../../../lib/blocks/library'
import { isSchemaCacheError } from '../../../../lib/supabase/errors'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; q?: string; sport?: string; type?: string }>
    | { error?: string; q?: string; sport?: string; type?: string }
}

/** Catalogue Krid blocs. */
export default async function BlocksKridCataloguePage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  let items: Awaited<ReturnType<typeof listKridBlocks>> = []
  let forkedIds: string[] = []
  let loadError: string | null = null
  try {
    items = await listKridBlocks(supabase)
    forkedIds = [...(await listCoachForkedKridBlockSourceIds(supabase, user.id))]
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

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            forked: { tone: 'success', message: 'Bloc copié en brouillon' },
            deleted: { tone: 'success', message: 'Bloc archivé' },
          }}
        />
      </Suspense>

      <ExercisesHubHeader
        title="Blocs"
        subtitle="Catalogue Krid · déjà dispo dans ton builder · Ajouter = copie perso à personnaliser"
      />

      <ExercisesZoneBar
        kind="blocks"
        basePath="/exercises/blocks/catalogue"
        sportOptions={sportOptions}
        typeOptions={typeOptions}
      />

      {loadError ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{loadError}</p>
      ) : null}

      <BlocksList
        items={filtered}
        mode="krid"
        forkedSourceIds={forkedIds}
        emptyHint={
          items.length
            ? 'Aucun bloc ne correspond aux filtres.'
            : 'Aucun bloc Krid publié pour l’instant.'
        }
      />
    </div>
  )
}
