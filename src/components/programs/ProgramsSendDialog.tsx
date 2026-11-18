'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import {
  assignProgramToClientsAction,
  assignProgramToGroupAction,
  linkProgramTemplateToPrestationAction,
} from '@/src/app/programs/actions'
import { Button, IconButton, IconClose, PendingFormButton, daSelectClass } from '@/src/components/ui'
import type { ProgramsHubSendOption } from '@/src/lib/programs/loadProgramsHub'

export type SendTargetKind = 'client' | 'group' | 'presta'

/** Ferme la popup quand le submit du form parent se termine (spinner visible pendant l’envoi). */
function CloseWhenSettled({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus()
  const wasPending = useRef(false)
  useEffect(() => {
    if (pending) wasPending.current = true
    else if (wasPending.current) {
      wasPending.current = false
      onClose()
    }
  }, [pending, onClose])
  return null
}

function ModalShell({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string
  titleId: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-md sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-extrabold text-[color:var(--fg)]">
            {title}
          </h2>
          <IconButton type="button" label="Fermer" tone="soft" size="sm" onClick={onClose}>
            <IconClose size={16} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  )
}

type Props = {
  open: boolean
  programId: string
  programTitle: string
  clients: ProgramsHubSendOption[]
  groups: ProgramsHubSendOption[]
  prestas: ProgramsHubSendOption[]
  onClose: () => void
}

export function ProgramsSendDialog({
  open,
  programId,
  programTitle,
  clients,
  groups,
  prestas,
  onClose,
}: Props) {
  const titleId = useId()
  const [kind, setKind] = useState<SendTargetKind>('client')
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [groupId, setGroupId] = useState('')
  const [prestaId, setPrestaId] = useState('')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setKind('client')
    setSelectedClients([])
    setGroupId(groups[0]?.id ?? '')
    setPrestaId(prestas[0]?.id ?? '')
  }, [open, groups, prestas])

  if (!open) return null

  function switchKind(next: SendTargetKind) {
    setKind(next)
  }

  function toggleClient(id: string) {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function toggleAllClients() {
    if (selectedClients.length === clients.length) {
      setSelectedClients([])
    } else {
      setSelectedClients(clients.map((c) => c.id))
    }
  }

  const canSubmitClient = Boolean(programId) && selectedClients.length > 0
  const canSubmitGroup = Boolean(programId) && Boolean(groupId) && groups.length > 0
  const canSubmitPresta = Boolean(programId) && Boolean(prestaId) && prestas.length > 0

  const hint =
    kind === 'client'
      ? 'Coche un ou plusieurs clients — chacun reçoit sa copie.'
      : kind === 'group'
        ? 'Tous les membres du groupe reçoivent une copie.'
        : 'Lie le template à l’offre — livré à l’achat / grant.'

  return (
    <ModalShell title="Envoyer le programme" titleId={titleId} onClose={onClose}>
      <p className="mb-4 text-sm text-[color:var(--muted)]">
        <span className="font-semibold text-[color:var(--fg)]">{programTitle}</span>
        {' — '}
        {hint}
      </p>

      <div
        className="mb-4 grid grid-cols-3 gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--page-bg)] p-1"
        role="tablist"
        aria-label="Type de destination"
      >
        {(
          [
            { id: 'client' as const, label: 'Clients' },
            { id: 'group' as const, label: 'Groupe' },
            { id: 'presta' as const, label: 'Presta' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            className={[
              'rounded-md px-2 py-2 text-sm font-bold transition-colors',
              kind === tab.id
                ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-da-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--fg)]',
            ].join(' ')}
            onClick={() => switchKind(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {kind === 'client' ? (
        !clients.length ? (
          <p className="mb-5 text-sm text-[color:var(--muted)]">Aucun client disponible.</p>
        ) : (
          <div className="mb-5 grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[color:var(--fg)]">
                Clients ({selectedClients.length}/{clients.length})
              </span>
              <button
                type="button"
                className="text-xs font-bold text-[color:var(--brand)] underline-offset-2 hover:underline"
                onClick={toggleAllClients}
              >
                {selectedClients.length === clients.length
                  ? 'Tout décocher'
                  : 'Tout cocher'}
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--page-bg)] p-2">
              <ul className="grid gap-1">
                {clients.map((c) => {
                  const checked = selectedClients.includes(c.id)
                  return (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleClient(c.id)}
                          className="size-4 accent-[var(--brand)]"
                        />
                        <span className="min-w-0 truncate text-[color:var(--fg)]">
                          {c.label}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )
      ) : null}

      {kind === 'group' ? (
        !groups.length ? (
          <p className="mb-5 text-sm text-[color:var(--muted)]">Aucun groupe.</p>
        ) : (
          <label className="mb-5 grid gap-1 text-sm">
            <span className="font-semibold text-[color:var(--fg)]">Groupe</span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={daSelectClass}
            >
              {groups.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )
      ) : null}

      {kind === 'presta' ? (
        !prestas.length ? (
          <p className="mb-5 text-sm text-[color:var(--muted)]">Aucune presta active.</p>
        ) : (
          <label className="mb-5 grid gap-1 text-sm">
            <span className="font-semibold text-[color:var(--fg)]">Prestation</span>
            <select
              value={prestaId}
              onChange={(e) => setPrestaId(e.target.value)}
              className={daSelectClass}
            >
              {prestas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[color:var(--muted)]">
              Ne crée pas d’envoi immédiat — le programme est livré quand le client achète /
              reçoit la presta.
            </span>
          </label>
        )
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        {kind === 'client' ? (
          <form action={assignProgramToClientsAction}>
            <CloseWhenSettled onClose={onClose} />
            <input type="hidden" name="program_id" value={programId} />
            <input type="hidden" name="return_to" value="/programs/encours" />
            {selectedClients.map((id) => (
              <input key={id} type="hidden" name="client_ids" value={id} />
            ))}
            <PendingFormButton size="sm" disabled={!canSubmitClient} pendingLabel="Envoi…">
              Envoyer
              {selectedClients.length > 1 ? ` (${selectedClients.length})` : ''}
            </PendingFormButton>
          </form>
        ) : null}
        {kind === 'group' ? (
          <form action={assignProgramToGroupAction}>
            <CloseWhenSettled onClose={onClose} />
            <input type="hidden" name="program_id" value={programId} />
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="return_to" value="/programs/encours" />
            <PendingFormButton size="sm" disabled={!canSubmitGroup} pendingLabel="Envoi…">
              Envoyer au groupe
            </PendingFormButton>
          </form>
        ) : null}
        {kind === 'presta' ? (
          <form action={linkProgramTemplateToPrestationAction}>
            <CloseWhenSettled onClose={onClose} />
            <input type="hidden" name="program_id" value={programId} />
            <input type="hidden" name="prestation_id" value={prestaId} />
            <input type="hidden" name="return_to" value="/programs/templates" />
            <PendingFormButton size="sm" disabled={!canSubmitPresta} pendingLabel="Liaison…">
              Lier à la presta
            </PendingFormButton>
          </form>
        ) : null}
      </div>
    </ModalShell>
  )
}
