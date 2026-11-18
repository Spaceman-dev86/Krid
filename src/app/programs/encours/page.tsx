import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { ProgramsEncoursList } from '@/src/components/programs/ProgramsEncoursList'
import { ProgramsHubHeader } from '@/src/components/programs/ProgramsHubHeader'
import { ProgramsZoneBar } from '@/src/components/programs/ProgramsZoneBar'
import { loadProgramsEncours } from '@/src/lib/programs/loadProgramsHub'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProgramsEncoursPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let rows: Awaited<ReturnType<typeof loadProgramsEncours>> = []
  let loadError: string | null = null
  try {
    rows = await loadProgramsEncours(supabase, user.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <ProgramsHubHeader
        title="Programmes"
        subtitle={`${rows.length} programme${rows.length === 1 ? '' : 's'} · déplie pour les clients`}
      />
      <ProgramsZoneBar kind="programs" basePath="/programs/encours" />
      {loadError ? (
        <p className="text-sm text-[color:var(--muted)]">{loadError}</p>
      ) : (
        <ProgramsEncoursList rows={rows} />
      )}
    </div>
  )
}
