'use client'

import { Fragment, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

import {
  archiveClientFitnessPlanAction,
  archiveProgramEncoursPlansAction,
} from '@/src/app/programs/actions'
import { ConfirmSubmitButton, IconClose } from '@/src/components/ui'
import type { ProgramsHubEncoursRow } from '@/src/lib/programs/loadProgramsHub'

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

function statusLabel(status: string) {
  if (status === 'started') return 'En cours'
  if (status === 'waiting') return 'En attente'
  if (status === 'paused') return 'En pause'
  return status
}

export function ProgramsEncoursList({ rows }: { rows: ProgramsHubEncoursRow[] }) {
  const router = useRouter()
  /** Fermé par défaut (comme Templates). */
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (!rows.length) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
        Aucun programme en cours.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              <th className="px-4 py-2.5 font-extrabold sm:px-5">Nom</th>
              <th className="px-3 py-2.5 text-center font-extrabold">En cours</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Accompli</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Clients</th>
              <th className="px-3 py-2.5 text-center font-extrabold">En ligne</th>
              <th className="px-4 py-2.5 text-right font-extrabold sm:px-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((parent) => {
              const expanded = open[parent.id] ?? false
              return (
                <Fragment key={parent.id}>
                  <tr className="hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]">
                    <td className="px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        className="flex min-w-0 max-w-full items-center gap-2 text-left"
                        aria-expanded={expanded}
                        onClick={() => setOpen((s) => ({ ...s, [parent.id]: !expanded }))}
                      >
                        <span className="w-4 shrink-0 text-[color:var(--muted)]" aria-hidden>
                          {expanded ? '▾' : '▸'}
                        </span>
                        <span className="truncate font-semibold text-[color:var(--brand)]">
                          {parent.title}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                      {parent.startedCount}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                      {parent.avgProgress}%
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                      {parent.clientCount}
                    </td>
                    <td className="px-3 py-3 text-center text-[11px] text-[color:var(--muted)]">
                      {parent.onlineAt}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                      <form action={archiveProgramEncoursPlansAction}>
                        <input type="hidden" name="program_id" value={parent.programId} />
                        <ConfirmSubmitButton
                          confirmMessage={`Archiver tous les plans de « ${parent.title} » ?`}
                          variant="secondary"
                          size="sm"
                          className="!rounded-lg !px-2 !py-1"
                          pendingLabel="Archivage…"
                        >
                          <IconClose size={14} />
                          <span className="sr-only">Archiver</span>
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>

                  {expanded
                    ? parent.clients.map((c) => (
                        <tr
                          key={c.planId}
                          className="cursor-pointer bg-[var(--page-bg)]/40 hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                          onClick={() => router.push(`/programs/plans/${c.planId}`)}
                        >
                          <td className="px-4 py-3 sm:px-5">
                            <span className="block truncate pl-6 font-semibold text-[color:var(--brand)]">
                              {c.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-[11px] text-[color:var(--muted)]">
                            {statusLabel(c.status)}
                          </td>
                          <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                            {c.progress}%
                          </td>
                          <td className="px-3 py-3 text-center text-[color:var(--muted)]">—</td>
                          <td className="px-3 py-3 text-center text-[11px] text-[color:var(--muted)]">
                            {c.start}
                          </td>
                          <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                            <form action={archiveClientFitnessPlanAction}>
                              <input type="hidden" name="plan_id" value={c.planId} />
                              <ConfirmSubmitButton
                                confirmMessage={`Archiver le plan de ${c.label} ?`}
                                variant="secondary"
                                size="sm"
                                className="!rounded-lg !px-2 !py-1"
                                pendingLabel="Archivage…"
                              >
                                <IconClose size={14} />
                                <span className="sr-only">Archiver</span>
                              </ConfirmSubmitButton>
                            </form>
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
  )
}
