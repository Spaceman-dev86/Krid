import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { BlockFicheEditor } from '@/src/components/admin/BlockFicheEditor'
import { DaBanner, Muted, PageTitle, PendingFormButton } from '@/src/components/ui'
import { CoachQueryFlash } from '../../../../components/coach/CoachQueryFlash'
import {
  createCoachBlockDraftAction,
  createCoachBlockPublishedAction,
} from '../actions'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { loadCoachBlockFicheOptions } from '../../../../lib/blocks/loadCoachBlockFicheOptions'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewCoachBlockPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { sports, units, candidates } = await loadCoachBlockFicheOptions(supabase, user.id)

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <Suspense fallback={null}>
        <CoachQueryFlash />
      </Suspense>
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link
            href="/exercises/blocks/mine"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            ← Ma biblio
          </Link>
        </p>
        <PageTitle className="mt-2">Nouveau bloc</PageTitle>
        <Muted className="mt-1">
          Compose avec tes exos publiés (Krid + Ma biblio) · minuteur libre · publie quand c’est prêt.
        </Muted>
      </div>

      {!sports.length || !units.length ? (
        <DaBanner tone="warning">
          Catalogue sports / unités indisponible. Réessaie plus tard ou contacte le support Krid.
        </DaBanner>
      ) : null}

      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
        <BlockFicheEditor
          candidates={candidates}
          sports={sports}
          units={units}
          showDuplicate={false}
          initial={{}}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <PendingFormButton
            type="submit"
            formAction={createCoachBlockDraftAction}
            variant="secondary"
          >
            Brouillon
          </PendingFormButton>
          <PendingFormButton type="submit" formAction={createCoachBlockPublishedAction}>
            Publier → Ma biblio
          </PendingFormButton>
        </div>
      </form>
    </div>
  )
}
