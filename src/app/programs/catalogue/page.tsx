import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { ProgramsCatalogueList } from '@/src/components/programs/ProgramsCatalogueList'
import { ProgramsHubHeader } from '@/src/components/programs/ProgramsHubHeader'
import { ProgramsZoneBar } from '@/src/components/programs/ProgramsZoneBar'
import { loadProgramsCatalogue } from '@/src/lib/programs/loadProgramsHub'
import { isSchemaCacheError } from '@/src/lib/supabase/errors'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProgramsCataloguePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let rows: Awaited<ReturnType<typeof loadProgramsCatalogue>> = []
  let loadError: string | null = null
  try {
    rows = await loadProgramsCatalogue(supabase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur'
    loadError = isSchemaCacheError(msg) ? null : msg
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <ProgramsHubHeader
        title="Programmes"
        subtitle={
          <>
            {rows.length} programme{rows.length > 1 ? 's' : ''} Krid · Ajouter = copie brouillon
          </>
        }
      />
      <ProgramsZoneBar kind="programs" basePath="/programs/catalogue" />
      {loadError ? (
        <p className="text-sm text-[color:var(--muted)]">{loadError}</p>
      ) : (
        <ProgramsCatalogueList rows={rows} empty="Aucun programme Krid." />
      )}
    </div>
  )
}
