'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type MouseEvent } from 'react'

import {
  forkKridSessionToDraftAction,
  moveCoachSessionToDraftAction,
  publishCoachSessionFromListAction,
  softDeleteCoachSessionAction,
} from '@/src/app/programs/sessions/actions'
import { Button, ConfirmSubmitButton, IconClose } from '@/src/components/ui'
import {
  sessionOriginLabel,
  type CoachSessionRow,
} from '@/src/lib/sessions/coachSessionLibrary'
import type { SessionUsageBundle } from '@/src/lib/sessions/templateUsage'
import { SessionUsageDialog } from './SessionUsageDialog'

type Mode = 'krid' | 'mine' | 'brouillon'

export type SessionsListItem = CoachSessionRow & {
  usage?: SessionUsageBundle
  template_usage_count?: number
  display_usage_count?: number
}

type Props = {
  items: SessionsListItem[]
  mode: Mode
  emptyHint: string
  forkedSourceIds?: string[]
  returnTo?: string
}

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

function emptyUsage(): SessionUsageBundle {
  return { templates: [], programs: [] }
}

export function SessionsList({
  items,
  mode,
  emptyHint,
  forkedSourceIds = [],
  returnTo,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const forked = new Set(forkedSourceIds)
  const [usageOpen, setUsageOpen] = useState<{ name: string; usage: SessionUsageBundle } | null>(
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
                <th className="px-3 py-2.5 text-center font-extrabold">Types</th>
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
              {items.map((s) => {
                if (mode === 'krid') {
                  const hasCopy = forked.has(s.id)
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <span className="block truncate font-semibold text-[color:var(--brand)]">
                          {s.name}
                        </span>
                        {hasCopy ? (
                          <span className="mt-0.5 inline-block text-[10px] font-bold text-[color:var(--muted)]">
                            Déjà une version perso
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        <span className="mx-auto line-clamp-2 max-w-[10rem]">
                          {s.type_labels.length ? s.type_labels.join(' · ') : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {s.sport_label || '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {s.exercise_count}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                        <form action={forkKridSessionToDraftAction} className="inline">
                          <input type="hidden" name="id" value={s.id} />
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
                    ? `/programs/sessions/mine/${s.id}`
                    : `/programs/sessions/brouillon/${s.id}`
                const usage = s.usage ?? emptyUsage()
                const displayCount =
                  s.display_usage_count ?? usage.templates.length + usage.programs.length

                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                    onClick={() => router.push(editHref)}
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <span className="block truncate font-semibold text-[color:var(--brand)]">
                        {s.name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                      <span className="mx-auto line-clamp-2 max-w-[10rem]">
                        {s.type_labels.length ? s.type_labels.join(' · ') : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center" onClick={stopRowClick}>
                      <button
                        type="button"
                        className={`inline-flex min-w-[2rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-extrabold tabular-nums ${
                          displayCount > 0
                            ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_22%,transparent)]'
                            : 'text-[color:var(--muted)] hover:bg-[var(--accent)]'
                        }`}
                        title="Voir où c’est utilisé"
                        onClick={() => setUsageOpen({ name: s.name, usage })}
                      >
                        {displayCount}
                      </button>
                    </td>
                    {mode === 'mine' ? (
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--fg)]">
                          {sessionOriginLabel(s.source_kind)}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        {mode === 'mine' ? (
                          <>
                            <form action={moveCoachSessionToDraftAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                                className="!rounded-lg !px-2.5 !py-1 text-xs"
                              >
                                → Brouillon
                              </Button>
                            </form>
                            <form action={softDeleteCoachSessionAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="from" value="mine" />
                              <ConfirmSubmitButton
                                confirmMessage={`Supprimer « ${s.name} » ? Les programmes qui l’ont déjà copiée restent intacts.`}
                                variant="secondary"
                                size="sm"
                                className="!rounded-lg !px-2 !py-1"
                              >
                                <IconClose size={14} />
                                <span className="sr-only">Supprimer</span>
                              </ConfirmSubmitButton>
                            </form>
                          </>
                        ) : (
                          <>
                            <form action={publishCoachSessionFromListAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <Button
                                type="submit"
                                size="sm"
                                className="!rounded-lg !px-2.5 !py-1 text-xs"
                              >
                                Publier
                              </Button>
                            </form>
                            <form action={softDeleteCoachSessionAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="from" value="brouillon" />
                              <ConfirmSubmitButton
                                confirmMessage={`Archiver « ${s.name} » ?`}
                                variant="secondary"
                                size="sm"
                                className="!rounded-lg !px-2 !py-1"
                              >
                                <IconClose size={14} />
                                <span className="sr-only">Archiver</span>
                              </ConfirmSubmitButton>
                            </form>
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
        <SessionUsageDialog
          sessionName={usageOpen.name}
          usage={usageOpen.usage}
          returnTo={returnTo}
          onClose={() => setUsageOpen(null)}
        />
      ) : null}
    </>
  )
}
