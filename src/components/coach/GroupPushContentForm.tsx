'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { pushContentFromGroupAction } from '@/src/app/clients/groupes/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconButton, IconClose, daSelectClass } from '@/src/components/ui'

type Opt = { id: string; title: string }

function SubmitBtn({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className="!rounded-lg !px-4 !py-2 text-sm font-bold disabled:opacity-40"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          Envoi…
        </span>
      ) : (
        label
      )}
    </Button>
  )
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
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-md sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
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
  groupId: string
  kind: 'fitness' | 'nutrition'
  options: Opt[]
  canPush: boolean
  submitLabel: string
  emptyLabel: string
}

export function GroupPushContentForm({
  groupId,
  kind,
  options,
  canPush,
  submitLabel,
  emptyLabel,
}: Props) {
  const titleId = useId()
  const [contentId, setContentId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const selected = options.find((o) => o.id === contentId) ?? null
  const kindLabel = kind === 'fitness' ? 'programme sport' : 'plan nutrition'

  useEffect(() => {
    if (!confirmOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  return (
    <>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-[color:var(--fg)]">
            {kind === 'fitness' ? 'Programme' : 'Plan nutrition'}
          </span>
          <select
            value={contentId}
            onChange={(e) => setContentId(e.target.value)}
            className={daSelectClass}
          >
            <option value="">Choisir…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>

        {!options.length ? (
          <p className="text-xs text-[color:var(--muted)]">{emptyLabel}</p>
        ) : null}

        <Button
          type="button"
          disabled={!canPush || !options.length || !contentId}
          className="w-fit !rounded-lg !px-4 !py-2 text-sm font-bold disabled:opacity-40"
          onClick={() => setConfirmOpen(true)}
        >
          {submitLabel}
        </Button>
        {!canPush ? (
          <p className="text-xs text-[color:var(--muted)]">Aucun destinataire pour l’instant.</p>
        ) : null}
      </div>

      {confirmOpen && selected ? (
        <ModalShell
          title={`Envoyer le ${kindLabel} ?`}
          titleId={titleId}
          onClose={() => setConfirmOpen(false)}
        >
          <div className="space-y-2 text-sm text-[color:var(--muted)]">
            <p className="text-[color:var(--fg)]">
              Tu vas envoyer <strong>{selected.title}</strong> aux membres du groupe.
            </p>
            <p>
              Chaque client reçoit une copie sur son compte. S’il l’a déjà, rien ne change pour
              lui.
            </p>
            <p>
              <strong>Toute nouvelle personne</strong> ajoutée au groupe recevra aussi ce{' '}
              {kindLabel} automatiquement.
            </p>
            <p className="text-[11px]">
              « Retirer » plus tard termine le {kindLabel} chez les membres et coupe
              l’auto-envoi aux futurs membres.
            </p>
          </div>
          <form action={pushContentFromGroupAction} className="mt-4 flex flex-wrap justify-end gap-2">
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="return_to" value={`/clients/groupes/${groupId}/prestation`} />
            <input type="hidden" name="mode" value="add" />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="content_id" value={selected.id} />
            <Button
              type="button"
              variant="secondary"
              className="!rounded-lg !px-3 !py-1.5 text-xs"
              onClick={() => setConfirmOpen(false)}
            >
              Annuler
            </Button>
            <SubmitBtn label="Confirmer l’envoi" />
          </form>
        </ModalShell>
      ) : null}
    </>
  )
}
