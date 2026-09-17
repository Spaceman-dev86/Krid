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
  /** Notes libres [{title, body}] — source de vérité fiche */
  named_notes?: Array<{ title: string; body: string }> | null
  /** Label type (Trainly / coach) */
  exercise_type_label?: string | null
}

export type ExerciseReplacementData = {
  id: string
  name: string
  demo_media_path?: string | null
}

type Props = {
  exercise: ExerciseDetailData
  demoMediaUrl: string | null
  demoMediaPath?: string | null
  /** @deprecated use replacements */
  replacement?: ExerciseReplacementData | null
  replacementMediaUrl?: string | null
  replacementMediaPath?: string | null
  replacements?: Array<{
    exercise: ExerciseReplacementData
    mediaUrl: string | null
    bridgeTitle?: string | null
    bridgeNote?: string | null
  }>
  backHref: string
  preferBackHref?: boolean
  exerciseBasePath?: string
  replacementReturnTo?: string
  actions?: React.ReactNode
  /** Masquer la flèche retour (ex. admin avec bouton Liste). */
  hideBackButton?: boolean
}

function exerciseMediaImageClassName(pathOrUrl: string | null | undefined, size: 'hero' | 'thumb') {
  const gifLike = isPngOrGifMedia(pathOrUrl)
  if (size === 'hero') {
    return gifLike ? 'mx-auto max-h-80 w-full object-contain' : 'h-80 w-full object-cover'
  }
  return gifLike ? 'h-full w-full object-contain p-1' : 'h-16 w-16 object-cover'
}

export default function ExerciseDetailView({
  exercise,
  demoMediaUrl,
  demoMediaPath,
  replacement = null,
  replacementMediaUrl = null,
  replacementMediaPath = null,
  replacements,
  backHref,
  preferBackHref = false,
  exerciseBasePath = '/dashboard/exercises',
  replacementReturnTo,
  actions,
  hideBackButton = false,
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

  const links =
    replacements && replacements.length
      ? replacements
      : replacement
        ? [{ exercise: replacement, mediaUrl: replacementMediaUrl }]
        : []

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-[var(--brand)]">Exercice</div>
          <div className="mt-1 truncate text-lg font-extrabold text-[color:var(--fg)]">{exercise.name}</div>
          {exercise.exercise_type_label ? (
            <div className="mt-1 text-xs font-semibold text-[color:var(--muted)]">
              Type · {exercise.exercise_type_label}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {!hideBackButton ? (
            <BackButtonClient
              href={backHref}
              preferHref={preferBackHref}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[color:var(--brand-fg)]"
              ariaLabel="Retour"
            >
              ←
            </BackButtonClient>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {demoMediaUrl ? (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
              <div className="text-xs font-extrabold text-[var(--brand)]">Groupe musculaire</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--fg)]">
                {exercise.muscle_group ?? '—'}
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
              <div className="text-xs font-extrabold text-[var(--brand)]">Difficulté</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--fg)]">
                {exercise.difficulty ?? '—'}
              </div>
            </div>
          </div>
        ) : null}

        {exercise.video_url ? (
          <a
            href={exercise.video_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--brand)] ring-1 ring-[var(--border)]"
          >
            Ouvrir la vidéo
          </a>
        ) : null}

        {exercise.description ? (
          <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
            <div className="text-xs font-extrabold text-[var(--brand)]">Consignes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--fg)]">
              {exercise.description}
            </div>
          </div>
        ) : null}

        {exercise.named_notes && exercise.named_notes.length
          ? exercise.named_notes.map((n, i) => (
              <div
                key={`${n.title}-${i}`}
                className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]"
              >
                <div className="text-xs font-extrabold text-[var(--brand)]">{n.title || 'Note'}</div>
                {n.body ? (
                  <div className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--fg)]">{n.body}</div>
                ) : null}
              </div>
            ))
          : null}

        {links.length ? (
          <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
            <div className="text-xs font-extrabold text-[var(--brand)]">
              Exercice{links.length > 1 ? 's' : ''} de remplacement
            </div>
            <ul className="mt-3 grid gap-3">
              {links.map(({ exercise: rep, mediaUrl, bridgeTitle, bridgeNote }) => (
                <li key={rep.id} className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-[var(--border)]">
                    {mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl}
                        alt={rep.name}
                        className={exerciseMediaImageClassName(
                          rep.demo_media_path ?? replacementMediaPath ?? mediaUrl,
                          'thumb',
                        )}
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {bridgeTitle ? (
                      <div className="text-[11px] font-bold text-[var(--brand)]">{bridgeTitle}</div>
                    ) : null}
                    <div className="truncate text-sm font-extrabold text-[color:var(--fg)]">{rep.name}</div>
                    {bridgeNote ? (
                      <p className="mt-0.5 text-xs text-[color:var(--muted)]">{bridgeNote}</p>
                    ) : null}
                    <Link
                      href={`${exerciseBasePath}/${rep.id}?returnTo=${encodeURIComponent(replacementBackHref)}`}
                      className="mt-1 inline-block text-sm text-[color:var(--muted)] hover:text-[var(--brand)]"
                    >
                      Voir la fiche
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </main>
  )
}
