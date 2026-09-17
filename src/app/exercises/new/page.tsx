import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { ExerciseForm } from '../../../components/exercises/ExerciseForm'
import { ExercisesSubnav } from '../../../components/exercises/ExercisesSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}

export default async function NewExercisePage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Nouvel exercice" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div className="flex items-center justify-between gap-2">
          <PageTitle className="text-2xl">Nouvel exercice</PageTitle>
          <Link href="/exercises" className="text-sm font-semibold text-[color:var(--brand)] underline">
            Annuler
          </Link>
        </div>
        <ExercisesSubnav pathname="/exercises/new" />
        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error}
          </div>
        ) : null}
        <ExerciseForm mode="new" />
      </div>
    </CoachAppShell>
  )
}
