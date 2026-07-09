import Link from 'next/link'

import BackButtonClient from './BackButtonClient'
import { isPngOrGifMedia } from '../lib/exerciseMedia'

export type ExerciseDetailData = {
  id: string
  name: string
  description: string | null
  muscle_group: string | null
  difficulty: string | null
  video_url: string | null
  common_mistakes: string | null
}

export type ExerciseReplacementData = {
  id: string
  name: string
}

type Props = {
  exercise: ExerciseDetailData
  demoMediaUrl: string | null
  demoMediaPath?: string | null
  replacement: ExerciseReplacementData | null
  replacementMediaUrl: string | null
  replacementMediaPath?: string | null
  backHref: string
  preferBackHref?: boolean
  exerciseBasePath?: string
  replacementReturnTo?: string
  actions?: React.ReactNode
}

function exerciseMediaImageClassName(pathOrUrl: string | null | undefined, size: 'hero' | 'thumb') {
  const padded = isPngOrGifMedia(pathOrUrl)
  if (size === 'hero') {
    return padded
      ? 'mx-auto max-h-80 w-full object-contain p-6'
      : 'h-80 w-full object-cover'
  }
  return padded ? 'h-full w-full object-contain p-2' : 'h-16 w-16 object-cover'
}

export default function ExerciseDetailView({
  exercise,
  demoMediaUrl,
  demoMediaPath,
  replacement,
  replacementMediaUrl,
  replacementMediaPath,
  backHref,
  preferBackHref = false,
  exerciseBasePath = '/dashboard/exercises',
  replacementReturnTo,
  actions,
}: Props) {
  const replacementBackHref =
    replacementReturnTo ??
    (() => {
      const url = new URL(`${exerciseBasePath}/${exercise.id}`, 'http://localhost')
      if (backHref && backHref !== '/dashboard' && backHref !== '/admin') {
        url.searchParams.set('returnTo', backHref)
      }
      return url.pathname + url.search
    })()

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-[var(--brand)]">Exercice</div>
          <div className="mt-1 truncate text-lg font-extrabold text-[var(--brand)]">{exercise.name}</div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <BackButtonClient
            href={backHref}
            preferHref={preferBackHref}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white"
            ariaLabel="Retour"
          >
            ←
          </BackButtonClient>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {demoMediaUrl ? (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
            <img
              src={demoMediaUrl}
              alt={exercise.name}
              className={exerciseMediaImageClassName(demoMediaPath ?? demoMediaUrl, 'hero')}
              loading="lazy"
            />
          </div>
        ) : null}

        {exercise.muscle_group || exercise.difficulty ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
              <div className="text-xs font-extrabold text-[var(--brand)]">Groupe musculaire</div>
              <div className="mt-1 text-sm font-semibold text-black/70">{exercise.muscle_group ?? ''}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
              <div className="text-xs font-extrabold text-[var(--brand)]">Difficulté</div>
              <div className="mt-1 text-sm font-semibold text-black/70">{exercise.difficulty ?? ''}</div>
            </div>
          </div>
        ) : null}

        {exercise.video_url ? (
          <a
            href={exercise.video_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--brand)] ring-1 ring-black/10"
          >
            Ouvrir la vidéo
          </a>
        ) : null}

        {exercise.description ? (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
            <div className="text-xs font-extrabold text-[var(--brand)]">Description</div>
            <div className="mt-1 text-sm text-black/70">{exercise.description}</div>
          </div>
        ) : null}

        {exercise.common_mistakes ? (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
            <div className="text-xs font-extrabold text-[var(--brand)]">Erreurs fréquentes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-black/70">{exercise.common_mistakes}</div>
          </div>
        ) : null}

        {replacement ? (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
            <div className="text-xs font-extrabold text-[var(--brand)]">Exercice de remplacement</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
                {replacementMediaUrl ? (
                  <img
                    src={replacementMediaUrl}
                    alt={replacement.name}
                    className={exerciseMediaImageClassName(replacementMediaPath ?? replacementMediaUrl, 'thumb')}
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold text-[var(--brand)]">{replacement.name}</div>
                <Link
                  href={`${exerciseBasePath}/${replacement.id}?returnTo=${encodeURIComponent(replacementBackHref)}`}
                  className="mt-1 inline-block text-sm text-black/60"
                >
                  Voir la fiche
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
