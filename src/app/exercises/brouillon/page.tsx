import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { ExercisesList } from '../../../components/exercises/ExercisesList'
import { ExercisesSubnav } from '../../../components/exercises/ExercisesSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { listCoachExercises } from '../../../lib/exercises/library'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ExercisesBrouillonPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let items: Awaited<ReturnType<typeof listCoachExercises>> = []
  let loadError: string | null = null
  try {
    items = await listCoachExercises(supabase, user.id, 'draft')
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Brouillons" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div>
          <PageTitle className="text-2xl">Brouillons</PageTitle>
          <Muted className="mt-1">Non publiés · absents du program builder</Muted>
        </div>

        <ExercisesSubnav pathname="/exercises/brouillon" />

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {loadError}
          </div>
        ) : null}

        <ExercisesList
          items={items}
          mode="brouillon"
          emptyHint="Aucun brouillon."
        />
      </div>
    </CoachAppShell>
  )
}
