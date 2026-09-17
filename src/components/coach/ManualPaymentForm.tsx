'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/src/components/ui'
import { createManualPaymentAction } from '../../app/payments/actions'
import { formatPriceCents } from '../../lib/prestations/modules'
import { selectFieldClass, selectFieldStyle } from '../../lib/ui/selectField'

export type ManualPaymentPrestation = {
  id: string
  name: string
  price_cents: number
  pricing_type: 'unique' | 'renewable' | string
}

export type ManualPaymentClient = {
  id: string
  label: string
}

export type PaidKey = {
  client_id: string
  prestation_id: string
  period_ym: string | null
}

type Props = {
  clients: ManualPaymentClient[]
  prestations: ManualPaymentPrestation[]
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

export function ManualPaymentForm({ clients, prestations, alreadyPaid }: Props) {
  const [clientId, setClientId] = useState('')
  const [prestationId, setPrestationId] = useState('')
  const [periodYm, setPeriodYm] = useState(currentPeriodYm())
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState('paid')

  const selected = useMemo(
    () => prestations.find((p) => p.id === prestationId) ?? null,
    [prestations, prestationId]
  )

  const isRenewable = selected?.pricing_type === 'renewable'

  const alreadyPaidUnique =
    clientId &&
    selected &&
    selected.pricing_type === 'unique' &&
    alreadyPaid.some(
      (p) => p.client_id === clientId && p.prestation_id === selected.id && !p.period_ym
    )

  const alreadyPaidMonth =
    clientId &&
    selected &&
    isRenewable &&
    alreadyPaid.some(
      (p) =>
        p.client_id === clientId &&
        p.prestation_id === selected.id &&
        p.period_ym === periodYm
    )

  const blockPaid =
    status === 'paid' && Boolean(alreadyPaidUnique || alreadyPaidMonth)

  function onPrestationChange(id: string) {
    setPrestationId(id)
    const p = prestations.find((x) => x.id === id)
    if (p) setAmount((p.price_cents / 100).toFixed(2))
  }

  return (
    <form action={createManualPaymentAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Client *</span>
        <select
          name="client_id"
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={selectFieldClass}
          style={selectFieldStyle}
        >
          <option value="">Choisir…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Prestation *</span>
        <select
          name="prestation_id"
          required
          value={prestationId}
          onChange={(e) => onPrestationChange(e.target.value)}
          className={selectFieldClass}
          style={selectFieldStyle}
        >
          <option value="">Choisir…</option>
          {prestations.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({formatPriceCents(p.price_cents)}) ·{' '}
              {p.pricing_type === 'renewable' ? 'mensuel' : 'unique'}
            </option>
          ))}
        </select>
      </label>
      {selected && isRenewable ? (
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-semibold">Mois couvert *</span>
          <input
            type="month"
            name="period_ym"
            required
            value={periodYm}
            onChange={(e) => setPeriodYm(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Montant (€) *</span>
        <input
          name="amount_euros"
          type="number"
          min="0"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Statut</span>
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectFieldClass}
          style={selectFieldStyle}
        >
          <option value="paid">Payé (accorde l’accès)</option>
          <option value="pending">En attente</option>
        </select>
      </label>

      {alreadyPaidUnique ? (
        <p className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Cette prestation <strong>unique</strong> a déjà été payée pour ce client.
        </p>
      ) : null}
      {alreadyPaidMonth ? (
        <p className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Ce mois ({formatPeriodYm(periodYm)}) est <strong>déjà payé</strong> pour cette presta.
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={blockPaid} className="!rounded-lg !px-4 !py-2 text-sm">
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
