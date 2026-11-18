'use client'

import { useRouter } from 'next/navigation'
import { useTransition, type MouseEvent } from 'react'

import {
  publishCoachProgramAsTemplateAction,
  softDeleteProgramAction,
} from '@/src/app/programs/actions'
import {
  ConfirmSubmitButton,
  IconClose,
  PendingFormButton,
} from '@/src/components/ui'
import type { ProgramsHubSimpleRow } from '@/src/lib/programs/loadProgramsHub'

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

/** Liste brouillons programmes — clic ligne = ouvrir · Publier → Templates · ✕ = archiver. */
export function ProgramsSimpleList({
  rows,
  empty,
}: {
  rows: ProgramsHubSimpleRow[]
  empty: string
}) {
  const router = useRouter()
  const [pendingNav, startTransition] = useTransition()

  if (!rows.length) {
    return (
      <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
        {empty}
      </p>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm ${
        pendingNav ? 'opacity-70' : ''
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              <th className="px-4 py-2.5 font-extrabold sm:px-5">Nom</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Durée</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Séances</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Niveau</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Origine</th>
              <th className="px-4 py-2.5 text-right font-extrabold sm:px-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                onClick={() => startTransition(() => router.push(`/programs/${r.id}`))}
              >
                <td className="px-4 py-3 sm:px-5">
                  <span className="block truncate font-semibold text-[color:var(--brand)]">
                    {r.title}
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-[color:var(--muted)]">{r.duration}</td>
                <td className="px-3 py-3 text-center tabular-nums text-[color:var(--muted)]">
                  {r.sessions}
                </td>
                <td className="px-3 py-3 text-center text-[color:var(--muted)]">{r.level}</td>
                <td className="px-3 py-3 text-center">
                  <span className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--fg)]">
                    {r.origin === 'krid' ? 'Krid' : 'Perso'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                  <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <form action={publishCoachProgramAsTemplateAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <PendingFormButton
                        size="sm"
                        className="!rounded-lg !px-2.5 !py-1 text-xs"
                        pendingLabel="Publication…"
                      >
                        → Template
                      </PendingFormButton>
                    </form>
                    <form action={softDeleteProgramAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="from" value="brouillon" />
                      <ConfirmSubmitButton
                        confirmMessage={`Archiver « ${r.title} » ?`}
                        variant="secondary"
                        size="sm"
                        className="!rounded-lg !px-2 !py-1"
                        pendingLabel="Archivage…"
                      >
                        <IconClose size={14} />
                        <span className="sr-only">Archiver</span>
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
