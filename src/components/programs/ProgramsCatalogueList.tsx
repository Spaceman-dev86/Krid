'use client'

import { useRouter } from 'next/navigation'
import { useTransition, type MouseEvent } from 'react'

import { forkKridProgramToDraftAction } from '@/src/app/programs/actions'
import { PendingFormButton } from '@/src/components/ui'
import type { ProgramsHubSimpleRow } from '@/src/lib/programs/loadProgramsHub'

function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

export function ProgramsCatalogueList({
  rows,
  empty,
}: {
  rows: ProgramsHubSimpleRow[]
  empty: string
}) {
  const router = useRouter()
  const [pendingNav, startTransition] = useTransition()

  if (!rows.length) {
    return <p className="px-1 py-6 text-sm text-[color:var(--muted)]">{empty}</p>
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm ${
        pendingNav ? 'opacity-70' : ''
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              <th className="px-4 py-2.5 font-extrabold sm:px-5">Nom</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Durée</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Séances</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Niveau</th>
              <th className="px-4 py-2.5 text-right font-extrabold sm:px-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                onClick={() =>
                  startTransition(() => router.push(`/programs/catalogue/${r.id}`))
                }
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
                <td className="px-4 py-3 text-right sm:px-5" onClick={stopRowClick}>
                  <form
                    action={forkKridProgramToDraftAction}
                    onSubmit={() => startTransition(() => {})}
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <PendingFormButton
                      size="sm"
                      className="!rounded-lg !px-2.5 !py-1 text-xs"
                      pendingLabel="Ajout…"
                      title="Ajouter à mes brouillons"
                    >
                      → Brouillon
                    </PendingFormButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
