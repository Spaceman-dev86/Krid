'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { createPrestationAction } from '@/src/app/payments/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconButton, IconClose, IconPlus, daFieldClass, daSelectClass } from '@/src/components/ui'

function SubmitCreate() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          Création…
        </span>
      ) : (
        'Créer la prestation'
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
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-md sm:rounded-2xl">
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
  defaultOpen?: boolean
}

export function CreatePrestationDialog({ defaultOpen = false }: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [pricingType, setPricingType] = useState<'unique' | 'renewable'>('unique')

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pricingHint =
    pricingType === 'renewable'
      ? 'Tes clients paient chaque mois pour garder l’accès (abo mensuel).'
      : 'Tes clients paient une fois — l’accès ne se renouvelle pas tout seul.'

  return (
    <>
      <IconButton
        type="button"
        label="Nouvelle prestation"
        tone="solid"
        size="md"
        onClick={() => setOpen(true)}
      >
        <IconPlus size={20} />
      </IconButton>

      {open ? (
        <ModalShell title="Nouvelle prestation" titleId={titleId} onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-[color:var(--muted)]">
            Infos showroom de base. Modules et contenu livré se règlent ensuite sur la fiche.
          </p>
          <form action={createPrestationAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="return_to" value="/profile/prestations" />
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold text-[color:var(--fg)]">Nom *</span>
              <input name="name" required placeholder="Ex. Coaching 3 mois" className={daFieldClass} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold text-[color:var(--fg)]">Description courte</span>
              <textarea
                name="description"
                rows={2}
                placeholder="Ce que le client comprend en 2 lignes"
                className={daFieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Prix (€)</span>
              <input
                name="price_euros"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className={daFieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Facturation</span>
              <select
                name="pricing_type"
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as 'unique' | 'renewable')}
                className={daSelectClass}
              >
                <option value="unique">Paiement unique</option>
                <option value="renewable">Mensuel</option>
              </select>
            </label>
            <p className="sm:col-span-2 text-[11px] text-[color:var(--muted)]">{pricingHint}</p>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Statut</span>
              <select name="status" defaultValue="active" className={daSelectClass}>
                <option value="active">Active</option>
                <option value="draft">Brouillon</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2 self-end text-sm font-semibold text-[color:var(--fg)]">
              <input type="checkbox" name="showroom_visible" defaultChecked className="rounded" />
              Visible sur le showroom
            </label>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="secondary"
                className="!rounded-lg !px-3 !py-1.5 text-xs"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <SubmitCreate />
            </div>
          </form>
        </ModalShell>
      ) : null}
    </>
  )
}
