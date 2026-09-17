'use client'

import { useState } from 'react'

import { Button } from '@/src/components/ui'
import { createPromoCodeAction } from '../../app/clients/codes/actions'
import { formatPriceCents } from '../../lib/prestations/modules'
import { selectFieldClass, selectFieldStyle } from '../../lib/ui/selectField'

type Presta = { id: string; name: string; price_cents: number }
type ClientOpt = { id: string; label: string }
type GroupOpt = { id: string; name: string }

const PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]

export function CreatePromoCodeForm({
  prestations,
  clients,
  groups,
}: {
  prestations: Presta[]
  clients: ClientOpt[]
  groups: GroupOpt[]
}) {
  const [audience, setAudience] = useState('public')

  return (
    <form action={createPromoCodeAction} className="mt-4 grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Code (optionnel)</span>
        <input
          name="code"
          placeholder="Auto si vide · ex. BIENVENUE20"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Remise %</span>
        <select name="percent_off" required defaultValue="20" className={selectFieldClass} style={selectFieldStyle}>
          {PERCENTS.map((p) => (
            <option key={p} value={p}>
              −{p} %
            </option>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Prestations concernées *</legend>
        <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          {prestations.length === 0 ? (
            <p className="text-xs text-[color:var(--muted)]">Aucune prestation active.</p>
          ) : (
            prestations.map((p) => (
              <label key={p.id} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="prestation_ids" value={p.id} className="rounded" />
                <span>
                  {p.name} · {formatPriceCents(p.price_cents)}
                </span>
              </label>
            ))
          )}
        </div>
      </fieldset>

      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Audience</span>
        <select
          name="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className={selectFieldClass}
          style={selectFieldStyle}
        >
          <option value="public">Public (tout le monde)</option>
          <option value="client">1 client</option>
          <option value="group">Groupe manuel</option>
          <option value="presta_clients">Clients d’une prestation</option>
        </select>
      </label>

      {audience === 'client' ? (
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Client *</span>
          <select name="audience_client_id" required className={selectFieldClass} style={selectFieldStyle}>
            <option value="">Choisir…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {audience === 'group' ? (
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Groupe *</span>
          <select name="audience_group_id" required className={selectFieldClass} style={selectFieldStyle}>
            <option value="">Choisir…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {audience === 'presta_clients' ? (
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Prestation (audience) *</span>
          <select
            name="audience_prestation_id"
            required
            className={selectFieldClass}
            style={selectFieldStyle}
          >
            <option value="">Choisir…</option>
            {prestations.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Durée</span>
          <select name="duration" defaultValue="7d" className={selectFieldClass} style={selectFieldStyle}>
            <option value="24h">24 heures</option>
            <option value="48h">48 heures</option>
            <option value="7d">7 jours</option>
            <option value="14d">14 jours</option>
            <option value="30d">1 mois</option>
            <option value="none">Aucune (max uses seul)</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Max utilisations</span>
          <input
            type="number"
            name="max_uses"
            min={1}
            placeholder="Optionnel"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
      </div>
      <p className="text-xs text-[color:var(--muted)]">
        Validité = durée et/ou max uses (AND) : le premier seuil atteint désactive le code.
      </p>

      <Button type="submit" className="w-fit !rounded-lg !px-4 !py-2 text-sm">
        Créer le code promo
      </Button>
    </form>
  )
}
