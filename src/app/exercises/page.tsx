import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { ExercisesList } from '../../components/exercises/ExercisesList'
import { ExercisesSubnav } from '../../components/exercises/ExercisesSubnav'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { listTrainlyExercises } from '../../lib/exercises/library'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function ExercisesTrainlyPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let items: Awaited<ReturnType<typeof listTrainlyExercises>> = []
  let loadError: string | null = null
  try {
    items = await listTrainlyExercises(supabase)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Exercices" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div>
          <PageTitle className="text-2xl">Exercices</PageTitle>
          <Muted className="mt-1">Catalogue Trainly (lecture) · transfère une copie dans ta biblio</Muted>
        </div>

        <ExercisesSubnav pathname="/exercises" />

        {q.error || loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || loadError}
          </div>
        ) : null}

        <ExercisesList
          items={items}
          mode="trainly"
          emptyHint="Aucun exercice Trainly (seed 11a manquant ?)."
        />
      </div>
    </CoachAppShell>
  )
}
