'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/src/components/ui'
import { createAccessCodeAction } from '../../app/clients/codes/actions'
import { formatPriceCents } from '../../lib/prestations/modules'
import { selectFieldClass, selectFieldStyle } from '../../lib/ui/selectField'

export type AccessPrestationOption = {
  id: string
  name: string
  price_cents: number
  pricing_type: string
}

export function CreateAccessCodeForm({ prestations }: { prestations: AccessPrestationOption[] }) {
  const [prestationId, setPrestationId] = useState('')
  const [amountEuros, setAmountEuros] = useState('')
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => prestations.find((p) => p.id === prestationId) ?? null,
    [prestations, prestationId]
  )

  const amountCents = Math.round(Number.parseFloat(amountEuros.replace(',', '.')) * 100)
  const amountValid = Number.isFinite(amountCents) && amountCents >= 0

  function openDialog() {
    if (!selected) return
    setAmountEuros((selected.price_cents / 100).toFixed(2))
    setOpen(true)
  }

  return (
    <>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Prestation *</span>
          <select
            value={prestationId}
            onChange={(e) => setPrestationId(e.target.value)}
            className={selectFieldClass}
            style={selectFieldStyle}
          >
            <option value="">Choisir…</option>
            {prestations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatPriceCents(p.price_cents)}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          disabled={!selected}
          onClick={openDialog}
          className="w-fit !rounded-lg !px-4 !py-2 text-sm"
        >
          Générer un code (24 h)…
        </Button>
        <p className="text-xs text-[color:var(--muted)]">
          Pour un prospect pas encore lié. Client déjà dans l’app → Accorder sur sa fiche.
        </p>
      </div>

      {open && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
          >
            <h3 className="text-lg font-extrabold text-[color:var(--brand)]">Code d’accès cash</h3>
            <p className="mt-2 text-sm text-[color:var(--fg)]">
              Code 1 usage, expire dans 24 h, lié à <strong>{selected.name}</strong>.
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Indique le montant réellement reçu. 0 € possible si accès offert. Au redeem :
              ligne Payé (cash) + grant.
            </p>

            <form action={createAccessCodeAction} className="mt-5 grid gap-3">
              <input type="hidden" name="prestation_id" value={selected.id} />
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Montant reçu (€)</span>
                <input
                  type="number"
                  name="amount_euros"
                  min={0}
                  step="0.01"
                  required
                  value={amountEuros}
                  onChange={(e) => setAmountEuros(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                />
                <span className="text-xs text-[color:var(--muted)]">
                  Prix catalogue : {formatPriceCents(selected.price_cents)}
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="!rounded-lg !px-4 !py-2 text-sm">
                  Annuler
                </Button>
                <Button type="submit" disabled={!amountValid} className="!rounded-lg !px-4 !py-2 text-sm">
                  Générer le code
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
