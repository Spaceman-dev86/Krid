'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { removeGroupPushedContentAction } from '@/src/app/clients/groupes/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconButton, IconClose } from '@/src/components/ui'

function ConfirmSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="secondary"
      disabled={pending}
      className="!rounded-lg !px-4 !py-2 text-sm font-bold text-[var(--danger)]"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} />
          …
        </span>
      ) : (
        'Retirer pour le groupe'
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
  pushedId: string
  title: string
  kind: 'fitness' | 'nutrition'
}

export function GroupRemovePushedContentButton({ groupId, pushedId, title, kind }: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const kindLabel = kind === 'nutrition' ? 'plan nutrition' : 'programme'

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="text-xs font-semibold text-[var(--danger)] hover:underline"
        onClick={() => setOpen(true)}
      >
        Retirer
      </button>

      {open ? (
        <ModalShell title="Retirer pour le groupe ?" titleId={titleId} onClose={() => setOpen(false)}>
          <div className="space-y-2 text-sm text-[color:var(--muted)]">
            <p className="text-[color:var(--fg)]">
              Tu retires <strong>{title}</strong> pour ce groupe.
            </p>
            <p>
              Le {kindLabel} est <strong>terminé chez tous les membres</strong> concernés — ils
              n’y ont plus accès actif.
            </p>
            <p className="text-[11px]">
              Il disparaît aussi de la liste « contenus envoyés ». Les futurs membres ne le
              recevront plus automatiquement.
            </p>
          </div>
          <form
            action={removeGroupPushedContentAction}
            className="mt-4 flex flex-wrap justify-end gap-2"
          >
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="pushed_id" value={pushedId} />
            <input type="hidden" name="return_to" value={`/clients/groupes/${groupId}/prestation`} />
            <Button
              type="button"
              variant="secondary"
              className="!rounded-lg !px-3 !py-1.5 text-xs"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <ConfirmSubmit />
          </form>
        </ModalShell>
      ) : null}
    </>
  )
}
