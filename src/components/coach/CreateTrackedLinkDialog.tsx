'use client'

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { createTrackedLinkAction } from '@/src/app/profile/liens/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import {
  Button,
  IconButton,
  IconClose,
  IconPlus,
  daFieldClass,
  daSelectClass,
} from '@/src/components/ui'

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
        'Créer le lien'
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

type Presta = { id: string; name: string }
type PromoOpt = {
  id: string
  code: string
  percent_off: number | null
  prestation_ids: string[]
}

export function CreateTrackedLinkDialog({
  prestations,
  promos = [],
  defaultOpen = false,
}: {
  prestations: Presta[]
  promos?: PromoOpt[]
  defaultOpen?: boolean
}) {
  const titleId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [targetKind, setTargetKind] = useState<'showroom' | 'prestation'>('showroom')
  const [prestationId, setPrestationId] = useState('')
  const [promoId, setPromoId] = useState('')

  const prestaNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of prestations) map.set(p.id, p.name)
    return map
  }, [prestations])

  const filteredPromos = useMemo(() => {
    if (targetKind !== 'prestation' || !prestationId) return promos
    return promos.filter((p) => (p.prestation_ids ?? []).includes(prestationId))
  }, [promos, targetKind, prestationId])

  const selectedPromo = useMemo(
    () => filteredPromos.find((p) => p.id === promoId) ?? null,
    [filteredPromos, promoId],
  )

  const selectedPromoPrestaLabels = useMemo(() => {
    if (!selectedPromo) return []
    const ids = selectedPromo.prestation_ids ?? []
    if (!ids.length) return []
    if (ids.length >= prestations.length && prestations.every((p) => ids.includes(p.id))) {
      return ['Toutes les prestations']
    }
    return ids.map((id) => prestaNameById.get(id) ?? 'Presta').filter(Boolean)
  }, [selectedPromo, prestations, prestaNameById])

  useEffect(() => {
    if (promoId && !filteredPromos.some((p) => p.id === promoId)) setPromoId('')
  }, [filteredPromos, promoId])

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
      <IconButton
        type="button"
        label="Nouveau lien"
        tone="solid"
        size="md"
        onClick={() => setOpen(true)}
      >
        <IconPlus size={20} />
      </IconButton>

      {open ? (
        <ModalShell title="Nouvelle campagne" titleId={titleId} onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-[color:var(--muted)]">
            Lien à coller où tu veux. Le prospect laisse ses infos via « Je suis intéressé » →
            Prospects.
          </p>
          <form action={createTrackedLinkAction} className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">1 · Libellé *</span>
              <input
                name="label"
                required
                placeholder="Ex. Story Instagram mars"
                className={daFieldClass}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">2 · Cible</span>
              <select
                name="target_kind"
                value={targetKind}
                onChange={(e) => {
                  setTargetKind(e.target.value as 'showroom' | 'prestation')
                  if (e.target.value === 'showroom') setPrestationId('')
                }}
                className={daSelectClass}
              >
                <option value="showroom">Showroom (liste des offres)</option>
                <option value="prestation">Fiche d’une prestation</option>
              </select>
              <span className="text-[11px] text-[color:var(--muted)]">
                Fiche = page checkout de l’offre (pas une popup).
              </span>
            </label>

            {targetKind === 'prestation' ? (
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[color:var(--fg)]">Prestation *</span>
                <select
                  name="prestation_id"
                  required
                  value={prestationId}
                  onChange={(e) => setPrestationId(e.target.value)}
                  className={daSelectClass}
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

            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">3 · Promo liée (optionnel)</span>
              <select
                name="promo_code_id"
                value={promoId}
                onChange={(e) => setPromoId(e.target.value)}
                className={daSelectClass}
              >
                <option value="">Aucune</option>
                {filteredPromos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                    {p.percent_off != null ? ` · −${p.percent_off} %` : ''}
                  </option>
                ))}
              </select>
              {selectedPromoPrestaLabels.length ? (
                <p className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/40 px-2.5 py-1.5 text-[11px] text-[color:var(--fg)]">
                  <span className="font-semibold text-[color:var(--muted)]">Liée à · </span>
                  {selectedPromoPrestaLabels.join(' · ')}
                </p>
              ) : null}
              <span className="text-[11px] text-[color:var(--muted)]">
                Préremplie sur la fiche — le prospect n’a rien à retaper.{' '}
                <a
                  href="/profile/codes?promo=1"
                  className="font-semibold text-[color:var(--brand)] underline"
                >
                  Créer un code promo
                </a>
                {!promos.length ? ' (aucune promo active pour l’instant).' : '.'}
              </span>
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
              <SubmitCreate />
            </div>
          </form>
        </ModalShell>
      ) : null}
    </>
  )
}
