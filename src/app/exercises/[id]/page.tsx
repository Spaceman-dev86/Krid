import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, Muted, PageTitle } from '@/src/components/ui'
import { isPngOrGifMedia, signExerciseMediaUrl } from '@/src/lib/exerciseMedia'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { getExercise } from '../../../lib/exercises/library'
import { createClient } from '../../../lib/supabase/server'
import { forkKridExerciseToDraftAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

/** Détail catalogue Krid — média + CTA Ajouter. */
export default async function KridExerciseDetailPage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const exercise = await getExercise(supabase, id)
  if (!exercise) {
    redirect('/exercises/catalogue?error=' + encodeURIComponent('Exercice introuvable'))
  }

  if (exercise.coach_id === user.id) {
    redirect(exercise.status === 'draft' ? `/exercises/brouillon/${id}` : `/exercises/mine/${id}`)
  }

  if (exercise.coach_id != null) {
    redirect('/exercises/catalogue?error=' + encodeURIComponent('Accès refusé'))
  }

  if (exercise.status !== 'published') {
    redirect('/exercises/catalogue?error=' + encodeURIComponent('Exercice non publié'))
  }

  const demoMediaUrl = await signExerciseMediaUrl(supabase, exercise.demo_media_path)

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link
            href="/exercises/catalogue"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            ← Catalogue Krid
          </Link>
        </p>
        <PageTitle className="mt-2">{exercise.name}</PageTitle>
        <Muted className="mt-1">
          Déjà utilisable dans ton builder. Ajoute une copie seulement si tu veux le personnaliser.
        </Muted>
      </div>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        {demoMediaUrl ? (
          <div className="mb-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={demoMediaUrl}
              alt={exercise.name}
              className={
                isPngOrGifMedia(exercise.demo_media_path ?? demoMediaUrl)
                  ? 'mx-auto max-h-80 w-full object-contain p-2'
                  : 'h-72 w-full object-cover'
              }
              loading="lazy"
            />
          </div>
        ) : (
          <p className="mb-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[color:var(--muted)]">
            Pas de média démo sur cet exercice Krid.
          </p>
        )}

        <p className="text-sm text-[color:var(--muted)]">
          {[exercise.exercise_type, exercise.sport_label, exercise.difficulty]
            .filter(Boolean)
            .join(' · ') || '—'}
        </p>
        {exercise.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-[color:var(--fg)]">
            {exercise.description}
          </p>
        ) : (
          <p className="mt-4 text-sm text-[color:var(--muted)]">Pas de consignes.</p>
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

        <form action={forkKridExerciseToDraftAction} className="mt-6 flex flex-wrap gap-2">
          <input type="hidden" name="id" value={exercise.id} />
          <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">
            Ajouter à ma biblio
          </Button>
        </form>
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Copie dans tes brouillons (l’original Krid reste intact). Publie ensuite pour la ranger
          dans Ma biblio.
        </p>
      </article>
    </div>
  )
}
