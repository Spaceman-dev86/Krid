import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import {
  createCoachSessionDraftAction,
  createCoachSessionPublishedAction,
} from '@/src/app/programs/sessions/actions'
import { SessionFicheEditor } from '@/src/components/admin/SessionFicheEditor'
import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { DaBanner, Muted, PageTitle, PendingFormButton } from '@/src/components/ui'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { loadCoachSessionFicheOptions } from '@/src/lib/sessions/loadCoachSessionFicheOptions'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function NewCoachSessionPage({ searchParams }: Props) {
  await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { sports, units, blocks, exercises, blockCatalog } = await loadCoachSessionFicheOptions(
    supabase,
    user.id,
  )

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link
            href="/programs/sessions/mine"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            ← Ma biblio
          </Link>
        </p>
        <PageTitle className="mt-2">Nouvelle séance</PageTitle>
        <Muted className="mt-1">
          Compose avec exos/blocs publiés (Krid + Ma biblio) · Publier ou brouillon.
        </Muted>
      </div>

      {!sports.length || !units.length ? (
        <DaBanner tone="warning">
          Catalogue sports / unités indisponible. Réessaie plus tard.
        </DaBanner>
      ) : null}

      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
        <SessionFicheEditor
          coachMode
          blocks={blocks}
          exercises={exercises}
          units={units}
          blockCatalog={blockCatalog}
          returnToForNewBlock="/programs/sessions/new"
          initial={{}}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <PendingFormButton
            type="submit"
            formAction={createCoachSessionDraftAction}
            variant="secondary"
          >
            Brouillon
          </PendingFormButton>
          <PendingFormButton type="submit" formAction={createCoachSessionPublishedAction}>
            Publier → Ma biblio
          </PendingFormButton>
        </div>
      </form>
    </div>
  )
}
