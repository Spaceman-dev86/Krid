'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { createAccessCodeAction } from '@/src/app/profile/codes/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconButton, IconClose, daFieldClass, daSelectClass } from '@/src/components/ui'
import { formatPriceCents } from '@/src/lib/prestations/modules'

export type AccessPrestationOption = {
  id: string
  name: string
  price_cents: number
  pricing_type: string
}

function SubmitBtn({ disabled }: { disabled?: boolean }) {
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
          …
        </span>
      ) : (
        'Générer'
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

export function CreateAccessCodeDialog({ prestations }: { prestations: AccessPrestationOption[] }) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [prestationId, setPrestationId] = useState('')
  const [amountEuros, setAmountEuros] = useState('')

  const selected = useMemo(
    () => prestations.find((p) => p.id === prestationId) ?? null,
    [prestations, prestationId],
  )

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function openDialog() {
    setPrestationId(prestations[0]?.id ?? '')
    const first = prestations[0]
    setAmountEuros(first ? (first.price_cents / 100).toFixed(2) : '')
    setOpen(true)
  }

  function onPrestaChange(id: string) {
    setPrestationId(id)
    const p = prestations.find((x) => x.id === id)
    if (p) setAmountEuros((p.price_cents / 100).toFixed(2))
  }

  const amountCents = Math.round(Number.parseFloat(amountEuros.replace(',', '.')) * 100)
  const amountValid = Number.isFinite(amountCents) && amountCents >= 0

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={openDialog}
        disabled={!prestations.length}
        className="!rounded-lg !px-3 !py-2 text-sm font-bold"
      >
        Accès app
      </Button>

      {open ? (
        <ModalShell title="Code d’accès app" titleId={titleId} onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-[color:var(--muted)]">
            Envoie un code à ton client pour qu’il accède à l’app. Indique le montant perçu pour
            le suivre en compta. 1 usage · 24 h.
          </p>
          {!prestations.length ? (
            <p className="text-sm text-[color:var(--muted)]">Aucune presta active.</p>
          ) : (
            <form action={createAccessCodeAction} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[color:var(--fg)]">Prestation</span>
                <select
                  name="prestation_id"
                  required
                  value={prestationId}
                  onChange={(e) => onPrestaChange(e.target.value)}
                  className={daSelectClass}
                >
                  {prestations.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatPriceCents(p.price_cents)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[color:var(--fg)]">Montant reçu (€)</span>
                <input
                  type="number"
                  name="amount_euros"
                  min={0}
                  step="0.01"
                  required
                  value={amountEuros}
                  onChange={(e) => setAmountEuros(e.target.value)}
                  className={daFieldClass}
                />
                {selected ? (
                  <span className="text-[11px] text-[color:var(--muted)]">
                    Catalogue : {formatPriceCents(selected.price_cents)} · 0 € = offert
                  </span>
                ) : null}
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="!rounded-lg !px-3 !py-1.5 text-xs"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </Button>
                <SubmitBtn disabled={!amountValid} />
              </div>
            </form>
          )}
        </ModalShell>
      ) : null}
    </>
  )
}
