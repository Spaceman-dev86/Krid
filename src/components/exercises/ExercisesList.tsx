'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type MouseEvent } from 'react'

import { Button, ConfirmSubmitButton, IconClose } from '@/src/components/ui'
import { isPngOrGifMedia } from '@/src/lib/exerciseMedia'
import type { CoachExerciseRow } from '../../lib/exercises/library'
import { originLabel } from '../../lib/exercises/library'
import type { ExerciseUsageBundle } from '../../lib/exercises/templateUsage'
import {
  forkKridExerciseToDraftAction,
  moveCoachExerciseToDraftAction,
  publishCoachExerciseAction,
  softDeleteCoachExerciseAction,
} from '../../app/exercises/actions'
import { ExerciseUsageDialog } from './ExerciseUsageDialog'

type Mode = 'krid' | 'mine' | 'brouillon'

export type ExercisesListItem = CoachExerciseRow & {
  usage?: ExerciseUsageBundle
  template_usage_count?: number
}

type Props = {
  items: ExercisesListItem[]
  mode: Mode
  emptyHint: string
  /** Catalogue Krid : ids déjà forkés → chip « Version perso » */
  forkedSourceIds?: string[]
  /** Retour après édition d’un usage (ex. /exercises/mine). */
  returnTo?: string
}

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

function ExerciseThumb({ ex }: { ex: CoachExerciseRow }) {
  const url = ex.demo_media_url
  if (!url) {
    return (
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[10px] font-bold text-[color:var(--muted)]"
        aria-hidden
      >
        —
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={
        isPngOrGifMedia(ex.demo_media_path ?? url)
          ? 'h-10 w-10 shrink-0 rounded-lg object-contain bg-[var(--page-bg)] ring-1 ring-[var(--border)]'
          : 'h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)]'
      }
      loading="lazy"
    />
  )
}

function emptyUsage(): ExerciseUsageBundle {
  return { templates: [], programs: [] }
}

export function ExercisesList({
  items,
  mode,
  emptyHint,
  forkedSourceIds = [],
  returnTo,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const forked = new Set(forkedSourceIds)
  const [usageOpen, setUsageOpen] = useState<{ name: string; usage: ExerciseUsageBundle } | null>(
    null,
  )
  const showUsage = mode === 'mine' || mode === 'brouillon'

  if (!items.length) {
    return <p className="px-1 py-6 text-sm text-[color:var(--muted)]">{emptyHint}</p>
  }

  return (
    <>
      <div
        className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm ${
          pending ? 'opacity-70' : ''
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                <th className="px-4 py-2.5 font-extrabold sm:px-5">Nom</th>
                <th className="px-3 py-2.5 text-center font-extrabold">Type</th>
                <th className="px-3 py-2.5 text-center font-extrabold">Sport</th>
                {showUsage ? (
                  <th className="px-3 py-2.5 text-center font-extrabold">Utilisé</th>
                ) : null}
                {mode === 'mine' ? (
                  <th className="px-3 py-2.5 text-center font-extrabold">Origine</th>
                ) : null}
                <th className="px-4 py-2.5 text-right font-extrabold sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((ex) => {
                if (mode === 'krid') {
                  const hasCopy = forked.has(ex.id)
                  const detailHref = `/exercises/${ex.id}`
                  return (
                    <tr
                      key={ex.id}
                      className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                      onClick={() => router.push(detailHref)}
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <ExerciseThumb ex={ex} />
                          <div className="min-w-0">
                            <span className="block truncate font-semibold text-[color:var(--brand)]">
                              {ex.name}
                            </span>
                            {hasCopy ? (
                              <span className="mt-0.5 inline-block text-[10px] font-bold text-[color:var(--muted)]">
                                Déjà une version perso
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {ex.exercise_type || '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {ex.sport_label || '—'}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                        <form action={forkKridExerciseToDraftAction} className="inline">
                          <input type="hidden" name="id" value={ex.id} />
                          <Button
                            type="submit"
                            size="sm"
                            title="Ajouter à mes brouillons"
                            className="!rounded-lg !px-2.5 !py-1 text-xs"
                            disabled={pending}
                            onClick={() => startTransition(() => {})}
                          >
                            Ajouter
                          </Button>
                        </form>
                      </td>
                    </tr>
                  )
                }

                const editHref =
                  mode === 'mine' ? `/exercises/mine/${ex.id}` : `/exercises/brouillon/${ex.id}`
                const templateCount = ex.template_usage_count ?? ex.usage?.templates.length ?? 0
                const usage = ex.usage ?? emptyUsage()
                const canDelete = templateCount === 0

                return (
                  <tr
                    key={ex.id}
                    className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                    onClick={() => router.push(editHref)}
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <ExerciseThumb ex={ex} />
                        <span className="truncate font-semibold text-[color:var(--brand)]">
                          {ex.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                      {ex.exercise_type || '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                      {ex.sport_label || '—'}
                    </td>
                    <td className="px-3 py-3 text-center" onClick={stopRowClick}>
                      <button
                        type="button"
                        className={`inline-flex min-w-[2rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-extrabold tabular-nums ${
                          templateCount > 0
                            ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_22%,transparent)]'
                            : 'text-[color:var(--muted)] hover:bg-[var(--accent)]'
                        }`}
                        title="Voir où c’est utilisé"
                        onClick={() => setUsageOpen({ name: ex.name, usage })}
                      >
                        {templateCount}
                      </button>
                    </td>
                    {mode === 'mine' ? (
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--fg)]">
                          {originLabel(ex.source_kind)}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        {mode === 'mine' ? (
                          <>
                            <form action={moveCoachExerciseToDraftAction}>
                              <input type="hidden" name="id" value={ex.id} />
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                                className="!rounded-lg !px-2.5 !py-1 text-xs"
                              >
                                → Brouillon
                              </Button>
                            </form>
                            {canDelete ? (
                              <form action={softDeleteCoachExerciseAction}>
                                <input type="hidden" name="id" value={ex.id} />
                                <input type="hidden" name="from" value="mine" />
                                <ConfirmSubmitButton
                                  confirmMessage={`Supprimer « ${ex.name} » ? Cette action archive l’exercice.`}
                                  variant="secondary"
                                  size="sm"
                                  className="!rounded-lg !px-2 !py-1"
                                >
                                  <IconClose size={14} />
                                  <span className="sr-only">Supprimer</span>
                                </ConfirmSubmitButton>
                              </form>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="!rounded-lg !px-2 !py-1 opacity-50"
                                title="Utilisé dans des modèles — ouvre Utilisé pour retirer / remplacer"
                                disabled
                              >
                                <IconClose size={14} />
                                <span className="sr-only">Supprimer bloqué</span>
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <form action={publishCoachExerciseAction}>
                              <input type="hidden" name="id" value={ex.id} />
                              <Button
                                type="submit"
                                size="sm"
                                className="!rounded-lg !px-2.5 !py-1 text-xs"
                              >
                                Publier
                              </Button>
                            </form>
                            {canDelete ? (
                              <form action={softDeleteCoachExerciseAction}>
                                <input type="hidden" name="id" value={ex.id} />
                                <input type="hidden" name="from" value="brouillon" />
                                <ConfirmSubmitButton
                                  confirmMessage={`Archiver « ${ex.name} » ?`}
                                  variant="secondary"
                                  size="sm"
                                  className="!rounded-lg !px-2 !py-1"
                                >
                                  <IconClose size={14} />
                                  <span className="sr-only">Archiver</span>
                                </ConfirmSubmitButton>
                              </form>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="!rounded-lg !px-2 !py-1 opacity-50"
                                title="Utilisé dans des modèles — ouvre Utilisé pour retirer / remplacer"
                                disabled
                              >
                                <IconClose size={14} />
                                <span className="sr-only">Archiver bloqué</span>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {usageOpen ? (
        <ExerciseUsageDialog
          exerciseName={usageOpen.name}
          usage={usageOpen.usage}
          returnTo={returnTo}
          onClose={() => setUsageOpen(null)}
        />
      ) : null}
    </>
  )
}
