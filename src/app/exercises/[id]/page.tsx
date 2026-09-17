import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { ExercisesSubnav } from '../../../components/exercises/ExercisesSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { getExercise } from '../../../lib/exercises/library'
import { createClient } from '../../../lib/supabase/server'
import { transferTrainlyExerciseAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

export default async function TrainlyExerciseDetailPage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const exercise = await getExercise(supabase, id)

  if (!exercise) {
    redirect('/exercises?error=' + encodeURIComponent('Exercice introuvable'))
  }

  // Coach-owned → redirect to edit
  if (exercise.coach_id === user.id) {
    redirect(
      exercise.status === 'draft'
        ? `/exercises/brouillon/${id}`
        : `/exercises/mine/${id}`
    )
  }

  if (exercise.coach_id != null) {
    redirect('/exercises?error=' + encodeURIComponent('Accès refusé'))
  }

  if (exercise.status !== 'published') {
    redirect('/exercises?error=' + encodeURIComponent('Exercice non publié'))
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Trainly" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div className="flex items-center justify-between gap-2">
          <PageTitle className="text-2xl">{exercise.name}</PageTitle>
          <Link href="/exercises" className="text-sm font-semibold text-[color:var(--brand)] underline">
            ← Trainly
          </Link>
        </div>
        <ExercisesSubnav pathname="/exercises" />

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">Catalogue Trainly</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {[exercise.exercise_type, exercise.muscle_group, exercise.difficulty]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
          {exercise.description ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-[color:var(--fg)]">{exercise.description}</p>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--muted)]">Pas de description.</p>
          )}
          {exercise.video_url ? (
            <a
              href={exercise.video_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-[color:var(--brand)] underline"
            >
              Voir la vidéo →
            </a>
          ) : null}

          <form action={transferTrainlyExerciseAction} className="mt-6">
            <input type="hidden" name="id" value={exercise.id} />
            <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Transférer dans Ma biblio</Button>
          </form>
        </article>
      </div>
    </CoachAppShell>
  )
}
