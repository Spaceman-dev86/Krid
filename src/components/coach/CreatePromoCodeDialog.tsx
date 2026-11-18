'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { createPromoCodeAction } from '@/src/app/profile/codes/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconButton, IconClose, daFieldClass, daSelectClass } from '@/src/components/ui'
import { formatPriceCents } from '@/src/lib/prestations/modules'

type Presta = { id: string; name: string; price_cents: number }
type ClientOpt = { id: string; label: string }
type GroupOpt = { id: string; name: string }

const PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100]

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          …
        </span>
      ) : (
        'Créer'
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

export function CreatePromoCodeDialog({
  prestations,
  clients,
  groups,
  defaultOpen = false,
}: {
  prestations: Presta[]
  clients: ClientOpt[]
  groups: GroupOpt[]
  defaultOpen?: boolean
}) {
  const titleId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [audience, setAudience] = useState('public')
  const [selectedPrestaIds, setSelectedPrestaIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const allSelected =
    prestations.length > 0 && selectedPrestaIds.length === prestations.length

  function toggleAll() {
    setSelectedPrestaIds(allSelected ? [] : prestations.map((p) => p.id))
  }

  function toggleOne(id: string) {
    setSelectedPrestaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setAudience('public')
          setSelectedPrestaIds(prestations.map((p) => p.id))
          setOpen(true)
        }}
        disabled={!prestations.length}
        className="!rounded-lg !px-3 !py-2 text-sm font-bold"
      >
        Promo
      </Button>

      {open ? (
        <ModalShell title="Code promo" titleId={titleId} onClose={() => setOpen(false)}>
          <form action={createPromoCodeAction} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Code</span>
              <input
                name="code"
                placeholder="Auto si vide"
                className={daFieldClass}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Remise</span>
              <select name="percent_off" required defaultValue="20" className={daSelectClass}>
                {PERCENTS.map((p) => (
                  <option key={p} value={p}>
                    −{p} %
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="grid gap-1.5">
              <legend className="text-sm font-semibold text-[color:var(--fg)]">Prestations</legend>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[color:var(--muted)]">
                  {selectedPrestaIds.length}/{prestations.length} sélectionnée
                  {selectedPrestaIds.length > 1 ? 's' : ''}
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[11px] font-semibold text-[color:var(--brand)] hover:underline"
                >
                  {allSelected ? 'Tout désélectionner' : 'Toutes les presta'}
                </button>
              </div>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {prestations.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]"
                  >
                    <input
                      type="checkbox"
                      name="prestation_ids"
                      value={p.id}
                      checked={selectedPrestaIds.includes(p.id)}
                      onChange={() => toggleOne(p.id)}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span className="min-w-0 truncate text-[color:var(--fg)]">
                      {p.name}
                      <span className="text-[color:var(--muted)]"> · {formatPriceCents(p.price_cents)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Pour qui</span>
              <select
                name="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={daSelectClass}
              >
                <option value="public">Tout le monde</option>
                <option value="client">1 client</option>
                <option value="group">Un groupe</option>
                <option value="presta_clients">Clients d’une presta</option>
              </select>
            </label>

            {audience === 'client' ? (
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[color:var(--fg)]">Client</span>
                <select name="audience_client_id" required className={daSelectClass}>
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
                <span className="font-semibold text-[color:var(--fg)]">Groupe</span>
                <select name="audience_group_id" required className={daSelectClass}>
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
                <span className="font-semibold text-[color:var(--fg)]">Prestation</span>
                <select name="audience_prestation_id" required className={daSelectClass}>
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
                <span className="font-semibold text-[color:var(--fg)]">Durée</span>
                <select name="duration" defaultValue="7d" className={daSelectClass}>
                  <option value="24h">24 h</option>
                  <option value="48h">48 h</option>
                  <option value="7d">7 jours</option>
                  <option value="14d">14 jours</option>
                  <option value="30d">30 jours</option>
                  <option value="none">Sans limite</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[color:var(--fg)]">Max uses</span>
                <input
                  type="number"
                  name="max_uses"
                  min={1}
                  placeholder="Illimité"
                  className={daFieldClass}
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="!rounded-lg !px-3 !py-1.5 text-xs"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <SubmitBtn />
            </div>
          </form>
        </ModalShell>
      ) : null}
    </>
  )
}
