import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle } from '@/src/components/ui'
import { CoachAppShell } from '../../../../components/coach/CoachAppShell'
import { ExerciseForm } from '../../../../components/exercises/ExerciseForm'
import { ExercisesSubnav } from '../../../../components/exercises/ExercisesSubnav'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../../lib/coach/loadCoachShellContext'
import { getExercise } from '../../../../lib/exercises/library'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?: Promise<{ error?: string; saved?: string }> | { error?: string; saved?: string }
}

export default async function EditDraftExercisePage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const exercise = await getExercise(supabase, id)

  if (!exercise || exercise.coach_id !== user.id) {
    redirect('/exercises/brouillon?error=' + encodeURIComponent('Exercice introuvable'))
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Brouillon" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div className="flex items-center justify-between gap-2">
          <PageTitle className="text-2xl">{exercise.name}</PageTitle>
          <Link href="/exercises/brouillon" className="text-sm font-semibold text-[color:var(--brand)] underline">
            ← Brouillons
          </Link>
        </div>
        <ExercisesSubnav pathname="/exercises/brouillon" />
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error}
          </div>
        ) : null}
        {q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Enregistré.
          </div>
        ) : null}
        <ExerciseForm mode="brouillon" exercise={exercise} />
      </div>
    </CoachAppShell>
  )
}
