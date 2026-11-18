import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CoachExerciseFicheForm } from '../../../components/exercises/CoachExerciseFicheForm'
import { CoachQueryFlash } from '../../../components/coach/CoachQueryFlash'
import { DaBanner, Muted, PageTitle } from '@/src/components/ui'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachFicheOptions } from '../../../lib/exercises/loadCoachFicheOptions'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewExercisePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { types, sports, candidates } = await loadCoachFicheOptions(supabase, user.id)

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Suspense fallback={null}>
        <CoachQueryFlash />
      </Suspense>
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link href="/exercises/mine" className="font-semibold text-[var(--brand)] hover:underline">
            ← Ma biblio
          </Link>
        </p>
        <PageTitle className="mt-2">Nouvel exercice</PageTitle>
        <Muted className="mt-1">
          Crée ta fiche, ajoute un média si besoin, puis publie — ou garde en brouillon.
        </Muted>
      </div>

      {!types.length ? (
        <DaBanner tone="warning">
          Aucun type catalogue disponible. Contacte le support Krid si le problème persiste.
        </DaBanner>
      ) : null}
      {!sports.length ? (
        <DaBanner tone="warning">Aucun sport catalogue disponible.</DaBanner>
      ) : null}

      <CoachExerciseFicheForm
        mode="new"
        coachId={user.id}
        types={types}
        sports={sports}
        candidates={candidates}
      />
    </div>
  )
}
