'use client'

import { Fragment, useState, useTransition, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

import {
  duplicateCoachProgramToDraftAction,
  moveCoachProgramToDraftAction,
  softDeleteProgramAction,
} from '@/src/app/programs/actions'
import {
  Button,
  ConfirmSubmitButton,
  IconClose,
  IconDuplicate,
  PendingFormButton,
} from '@/src/components/ui'
import type {
  ProgramsHubSendOption,
  ProgramsHubTemplateChild,
  ProgramsHubTemplateRow,
} from '@/src/lib/programs/loadProgramsHub'
import { ProgramsSendDialog } from './ProgramsSendDialog'

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

function RowActions({
  id,
  title,
  canSend,
  canMoveToDraft,
  canArchive,
  showDuplicate,
  onSend,
}: {
  id: string
  title: string
  canSend: boolean
  canMoveToDraft: boolean
  /** false = parent avec enfants. */
  canArchive: boolean
  showDuplicate: boolean
  onSend: () => void
}) {
  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
      {canSend ? (
        <Button type="button" size="sm" onClick={onSend}>
          Envoyer
        </Button>
      ) : null}
      {canMoveToDraft ? (
        <form action={moveCoachProgramToDraftAction}>
          <input type="hidden" name="id" value={id} />
          <PendingFormButton
            variant="secondary"
            size="sm"
            className="!rounded-lg !px-2.5 !py-1 text-xs"
            pendingLabel="Déplacement…"
          >
            → Brouillon
          </PendingFormButton>
        </form>
      ) : null}
      {showDuplicate ? (
        <form action={duplicateCoachProgramToDraftAction}>
          <input type="hidden" name="id" value={id} />
          <PendingFormButton
            variant="secondary"
            size="sm"
            className="!rounded-lg !px-2 !py-1"
            pendingLabel="Copie…"
            title="Dupliquer"
          >
            <IconDuplicate size={14} />
            <span className="sr-only">Dupliquer</span>
          </PendingFormButton>
        </form>
      ) : null}
      {canArchive ? (
        <form action={softDeleteProgramAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="from" value="templates" />
          <ConfirmSubmitButton
            confirmMessage={`Archiver « ${title} » ? Possible seulement s’il n’est lié à aucune presta ni plan client actif, et sans versions enfants.`}
            variant="secondary"
            size="sm"
            className="!rounded-lg !px-2 !py-1"
            pendingLabel="Archivage…"
          >
            <IconClose size={14} />
            <span className="sr-only">Archiver</span>
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </div>
  )
}

export function ProgramsTemplatesList({
  rows,
  sendClients,
  sendGroups,
  sendPrestas,
}: {
  rows: ProgramsHubTemplateRow[]
  sendClients: ProgramsHubSendOption[]
  sendGroups: ProgramsHubSendOption[]
  sendPrestas: ProgramsHubSendOption[]
}) {
  const router = useRouter()
  const [pendingNav, startTransition] = useTransition()
  const [sendFor, setSendFor] = useState<{ id: string; title: string } | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})

  function goProgram(id: string) {
    startTransition(() => router.push(`/programs/${id}`))
  }

  if (!rows.length) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
        Aucun template — enregistre un programme depuis les brouillons.
      </p>
    )
  }

  return (
    <>
      <div
        className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm ${
          pendingNav ? 'opacity-70' : ''
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                <th className="px-4 py-2.5 font-extrabold sm:px-5">Nom</th>
                <th className="px-3 py-2.5 text-center font-extrabold">Durée</th>
                <th className="px-3 py-2.5 text-center font-extrabold">Séances</th>
                <th className="px-3 py-2.5 text-center font-extrabold">Niveau</th>
                <th className="px-3 py-2.5 text-center font-extrabold">Clients</th>
                <th className="px-3 py-2.5 text-center font-extrabold">Prestas</th>
                <th className="px-4 py-2.5 text-right font-extrabold sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((parent) => {
                const hasKids = parent.children.length > 0
                const expanded = open[parent.id] ?? hasKids
                return (
                  <Fragment key={parent.id}>
                    <tr
                      className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                      onClick={() => goProgram(parent.id)}
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex min-w-0 items-center gap-2">
                          {hasKids ? (
                            <button
                              type="button"
                              className="w-4 shrink-0 text-[color:var(--muted)]"
                              aria-expanded={expanded}
                              aria-label={expanded ? 'Replier' : 'Déplier'}
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpen((s) => ({ ...s, [parent.id]: !expanded }))
                              }}
                            >
                              {expanded ? '▾' : '▸'}
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" aria-hidden />
                          )}
                          <div className="min-w-0 text-left" title="Ouvrir le modèle">
                            <span className="block min-w-0 truncate font-semibold text-[color:var(--brand)]">
                              {parent.title}
                            </span>
                            {hasKids ? (
                              <span className="text-[11px] font-medium text-[color:var(--muted)]">
                                Modèle · {parent.children.length} version
                                {parent.children.length > 1 ? 's' : ''}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {parent.durationLabel}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                        {parent.sessions}
                      </td>
                      <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                        {parent.level}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                        {parent.clients}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                        {parent.prestas}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                        <RowActions
                          id={parent.id}
                          title={parent.title}
                          canSend={!hasKids}
                          canMoveToDraft={parent.canMoveToDraft}
                          canArchive={parent.canMoveToDraft}
                          showDuplicate
                          onSend={() => setSendFor({ id: parent.id, title: parent.title })}
                        />
                      </td>
                    </tr>

                    {expanded
                      ? parent.children.map((child: ProgramsHubTemplateChild) => (
                          <tr
                            key={child.id}
                            className="cursor-pointer bg-[var(--page-bg)]/40 hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                            onClick={() => goProgram(child.id)}
                          >
                            <td className="px-4 py-3 sm:px-5">
                              <div className="min-w-0 pl-6">
                                <span className="block min-w-0 truncate font-semibold text-[color:var(--brand)]">
                                  {child.title}
                                </span>
                                <span className="text-[11px] font-medium text-[color:var(--muted)]">
                                  Personnalisé
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                              {child.durationLabel}
                            </td>
                            <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                              {child.sessions}
                            </td>
                            <td className="px-3 py-3 text-center text-[color:var(--muted)]">
                              {child.level}
                            </td>
                            <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                              {child.clients}
                            </td>
                            <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                              {child.prestas}
                            </td>
                            <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                              <RowActions
                                id={child.id}
                                title={child.title}
                                canSend
                                canMoveToDraft={child.canMoveToDraft}
                                canArchive={child.canMoveToDraft}
                                showDuplicate
                                onSend={() =>
                                  setSendFor({ id: child.id, title: child.title })
                                }
                              />
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProgramsSendDialog
        open={Boolean(sendFor)}
        programId={sendFor?.id ?? ''}
        programTitle={sendFor?.title ?? ''}
        clients={sendClients}
        groups={sendGroups}
        prestas={sendPrestas}
        onClose={() => setSendFor(null)}
      />
    </>
  )
}
