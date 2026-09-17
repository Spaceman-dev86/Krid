'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/src/components/ui'
import { grantPrestationToClientAction } from '../../app/payments/actions'
import { formatPriceCents } from '../../lib/prestations/modules'
import { selectFieldClass, selectFieldStyle } from '../../lib/ui/selectField'

export type GrantPrestationOption = {
  id: string
  name: string
  pricing_type: 'unique' | 'renewable' | string
  price_cents: number
}

export type PaidKey = {
  prestation_id: string
  period_ym: string | null
}

type Props = {
  clientId: string
  clientLabel: string
  returnTo: string
  prestations: GrantPrestationOption[]
  alreadyPaid: PaidKey[]
}

function currentPeriodYm() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodYm(ym: string) {
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function GrantPrestationDialog({
  clientId,
  clientLabel,
  returnTo,
  prestations,
  alreadyPaid,
}: Props) {
  const [prestationId, setPrestationId] = useState('')
  const [periodYm, setPeriodYm] = useState(currentPeriodYm())
  const [open, setOpen] = useState(false)
  const [amountEuros, setAmountEuros] = useState('')

  const selected = useMemo(
    () => prestations.find((p) => p.id === prestationId) ?? null,
    [prestations, prestationId]
  )

  const isRenewable = selected?.pricing_type === 'renewable'
  const alreadyPaidUnique =
    selected &&
    selected.pricing_type === 'unique' &&
    alreadyPaid.some((p) => p.prestation_id === selected.id && !p.period_ym)

  const alreadyPaidMonth =
    selected &&
    isRenewable &&
    alreadyPaid.some((p) => p.prestation_id === selected.id && p.period_ym === periodYm)

  const canOpen =
    Boolean(selected) && !alreadyPaidUnique && !(isRenewable && (!periodYm || alreadyPaidMonth))

  function openDialog() {
    if (!selected) return
    setAmountEuros((selected.price_cents / 100).toFixed(2))
    setOpen(true)
  }

  const amountCents = Math.round(Number.parseFloat(amountEuros.replace(',', '.')) * 100)
  const amountValid = Number.isFinite(amountCents) && amountCents >= 0

  return (
    <>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Accorder une prestation</span>
          <select
            value={prestationId}
            onChange={(e) => setPrestationId(e.target.value)}
            className={selectFieldClass}
            style={selectFieldStyle}
          >
            <option value="">Choisir…</option>
            {prestations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatPriceCents(p.price_cents)} ·{' '}
                {p.pricing_type === 'renewable' ? 'mensuel' : 'unique'}
              </option>
            ))}
          </select>
        </label>

        {selected && isRenewable ? (
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Mois couvert *</span>
            <input
              type="month"
              value={periodYm}
              onChange={(e) => setPeriodYm(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
        ) : null}

        {alreadyPaidUnique ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Cette prestation <strong>unique</strong> a déjà été payée pour ce client. Pas de second
            paiement.
          </p>
        ) : null}

        {alreadyPaidMonth ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Ce mois ({formatPeriodYm(periodYm)}) est <strong>déjà payé</strong> pour cette presta.
            Choisis un autre mois.
          </p>
        ) : null}

        <Button type="button" disabled={!canOpen} onClick={openDialog} className="w-fit !rounded-lg !px-4 !py-2 text-sm">
          Accorder…
        </Button>
      </div>

      {open && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
          >
            <h3 className="text-lg font-extrabold text-[color:var(--brand)]">Enregistrer l’accès</h3>
            <p className="mt-2 text-sm text-[color:var(--fg)]">
              Accorder <strong>{selected.name}</strong> à <strong>{clientLabel}</strong>
              {isRenewable ? (
                <>
                  {' '}
                  — mois de <strong>{formatPeriodYm(periodYm)}</strong>
                </>
              ) : null}
              .
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Indique le montant réellement reçu (cash, virement…). 0 € possible si accès offert.
              Cela crée une ligne Payé en Comptabilités et ouvre l’accès.
            </p>

            <form action={grantPrestationToClientAction} className="mt-5 grid gap-3">
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="prestation_id" value={selected.id} />
              <input type="hidden" name="confirm_paid" value="1" />
              <input type="hidden" name="amount_cents" value={amountValid ? String(amountCents) : ''} />
              {isRenewable ? <input type="hidden" name="period_ym" value={periodYm} /> : null}

              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Montant reçu (€)</span>
                <input
                  type="number"
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
                  Confirmer et accorder
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
