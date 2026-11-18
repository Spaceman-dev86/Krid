'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type MouseEvent } from 'react'

import { Button, ConfirmSubmitButton, IconClose } from '@/src/components/ui'
import type { CoachBlockRow } from '../../lib/blocks/library'
import { blockOriginLabel } from '../../lib/blocks/library'
import type { BlockUsageBundle } from '../../lib/blocks/templateUsage'
import {
  forkKridBlockToDraftAction,
  moveCoachBlockToDraftAction,
  publishCoachBlockAction,
  softDeleteCoachBlockAction,
} from '../../app/exercises/blocks/actions'
import { BlockUsageDialog } from './BlockUsageDialog'

type Mode = 'krid' | 'mine' | 'brouillon'

export type BlocksListItem = CoachBlockRow & {
  usage?: BlockUsageBundle
  template_usage_count?: number
}

type Props = {
  items: BlocksListItem[]
  mode: Mode
  emptyHint: string
  forkedSourceIds?: string[]
  returnTo?: string
}

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

function emptyUsage(): BlockUsageBundle {
  return { templates: [], programs: [] }
}

export function BlocksList({
  items,
  mode,
  emptyHint,
  forkedSourceIds = [],
  returnTo,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const forked = new Set(forkedSourceIds)
  const [usageOpen, setUsageOpen] = useState<{ name: string; usage: BlockUsageBundle } | null>(
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
                {showUsage ? (
                  <th className="px-3 py-2.5 text-center font-extrabold">Utilisé</th>
                ) : (
                  <>
                    <th className="px-3 py-2.5 text-center font-extrabold">Sport</th>
                    <th className="px-3 py-2.5 text-center font-extrabold">Exos</th>
                  </>
                )}
                {mode === 'mine' ? (
                  <th className="px-3 py-2.5 text-center font-extrabold">Origine</th>
                ) : null}
                <th className="px-4 py-2.5 text-right font-extrabold sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((b) => {
                if (mode === 'krid') {
                  const hasCopy = forked.has(b.id)
                  const detailHref = `/exercises/blocks/view/${b.id}`
                  return (
                    <tr
                      key={b.id}
                      className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                      onClick={() => router.push(detailHref)}
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <span className="block truncate font-semibold text-[color:var(--brand)]">
                          {b.name}
                        </span>
                        {hasCopy ? (
                          <span className="mt-0.5 inline-block text-[10px] font-bold text-[color:var(--muted)]">
                            Déjà une version perso
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        <span className="line-clamp-2 mx-auto max-w-[10rem]">
                          {b.type_labels.length ? b.type_labels.join(' · ') : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {b.sport_label || '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {b.exercise_count}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                        <form action={forkKridBlockToDraftAction} className="inline">
                          <input type="hidden" name="id" value={b.id} />
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
                  mode === 'mine'
                    ? `/exercises/blocks/mine/${b.id}`
                    : `/exercises/blocks/brouillon/${b.id}`
                const templateCount = b.template_usage_count ?? b.usage?.templates.length ?? 0
                const usage = b.usage ?? emptyUsage()
                const canDelete = templateCount === 0

                return (
                  <tr
                    key={b.id}
                    className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                    onClick={() => router.push(editHref)}
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <span className="block truncate font-semibold text-[color:var(--brand)]">
                        {b.name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                      <span className="line-clamp-2 mx-auto max-w-[10rem]">
                        {b.type_labels.length ? b.type_labels.join(' · ') : '—'}
                      </span>
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
                        onClick={() => setUsageOpen({ name: b.name, usage })}
                      >
                        {templateCount}
                      </button>
                    </td>
                    {mode === 'mine' ? (
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--fg)]">
                          {blockOriginLabel(b.source_kind)}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        {mode === 'mine' ? (
                          <>
                            <form action={moveCoachBlockToDraftAction}>
                              <input type="hidden" name="id" value={b.id} />
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
                              <form action={softDeleteCoachBlockAction}>
                                <input type="hidden" name="id" value={b.id} />
                                <input type="hidden" name="from" value="mine" />
                                <ConfirmSubmitButton
                                  confirmMessage={`Supprimer « ${b.name} » ? Cette action archive le bloc.`}
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
                                title="Utilisé dans des séances modèles — ouvre Utilisé"
                                disabled
                              >
                                <IconClose size={14} />
                                <span className="sr-only">Supprimer bloqué</span>
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <form action={publishCoachBlockAction}>
                              <input type="hidden" name="id" value={b.id} />
                              <Button
                                type="submit"
                                size="sm"
                                className="!rounded-lg !px-2.5 !py-1 text-xs"
                              >
                                Publier
                              </Button>
                            </form>
                            {canDelete ? (
                              <form action={softDeleteCoachBlockAction}>
                                <input type="hidden" name="id" value={b.id} />
                                <input type="hidden" name="from" value="brouillon" />
                                <ConfirmSubmitButton
                                  confirmMessage={`Archiver « ${b.name} » ?`}
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
                                title="Utilisé dans des séances modèles — ouvre Utilisé"
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
        <BlockUsageDialog
          blockName={usageOpen.name}
          usage={usageOpen.usage}
          returnTo={returnTo}
          onClose={() => setUsageOpen(null)}
        />
      ) : null}
    </>
  )
}
