'use client'

import { useEffect, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { sendBilanAction } from '@/src/app/clients/bilans/actions'
import { Button, daFieldClass, daSelectClass } from '@/src/components/ui'

type TemplateOpt = { id: string; title: string }
type ClientOpt = { id: string; label: string }
type GroupOpt = { id: string; name: string }
type PrestaOpt = { id: string; name: string }

type Props = {
  templates: TemplateOpt[]
  clients: ClientOpt[]
  groups: GroupOpt[]
  /** Audience presta (grants actifs) — sans groupe auto. */
  prestations?: PrestaOpt[]
  /** Préselection groupe (depuis fiche groupe). */
  preselectedGroupId?: string | null
  /** Préselection client (depuis fiche client). */
  preselectedClientId?: string | null
  /** Préselection template (après création depuis fiche). */
  preselectedTemplateId?: string | null
  /** Après envoi (défaut hub bilans). */
  returnTo?: string
  /** Ouvre la popup (ex. ?envoyer=1). Ne pas déduire de preselectedClientId. */
  defaultOpen?: boolean
  triggerLabel?: string
}

function SubmitSend() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? 'Envoi…' : 'Envoyer'}
    </Button>
  )
}

export function SendBilanDialog({
  templates,
  clients,
  groups,
  prestations = [],
  preselectedGroupId,
  preselectedClientId,
  preselectedTemplateId,
  returnTo,
  defaultOpen = false,
  triggerLabel = 'Envoyer',
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!templates.length) {
    return (
      <Button type="button" disabled className="!rounded-lg !px-3 !py-2 text-sm opacity-40">
        {triggerLabel}
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="!rounded-lg !px-3 !py-2 text-sm font-bold"
      >
        {triggerLabel}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[1] flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:max-h-[85vh] sm:rounded-[1.25rem]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                Envoyer un bilan
              </p>
              <button
                type="button"
                className="text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                onClick={() => setOpen(false)}
              >
                Fermer
              </button>
            </div>
            <form action={sendBilanAction} className="flex min-h-0 flex-1 flex-col">
              {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[color:var(--fg)]">Template</span>
                  <select
                    name="template_id"
                    required
                    className={daSelectClass}
                    defaultValue={preselectedTemplateId ?? ''}
                  >
                    <option value="">Choisir…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[color:var(--fg)]">Date d’apparition</span>
                  <input type="datetime-local" name="appears_at" className={daFieldClass} />
                  <span className="text-xs text-[color:var(--muted)]">Vide = maintenant · deadline = +14 j</span>
                </label>
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-[color:var(--fg)]">Clients</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3">
                    {clients.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm text-[color:var(--fg)]">
                        <input
                          type="checkbox"
                          name="client_id"
                          value={c.id}
                          defaultChecked={c.id === preselectedClientId}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
                {groups.length ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-semibold text-[color:var(--fg)]">Groupes</p>
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3">
                      {groups.map((g) => (
                        <label key={g.id} className="flex items-center gap-2 text-sm text-[color:var(--fg)]">
                          <input
                            type="checkbox"
                            name="group_id"
                            value={g.id}
                            defaultChecked={g.id === preselectedGroupId}
                          />
                          {g.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                {prestations.length ? (
                  <div className="grid gap-2">
                    <p className="text-sm font-semibold text-[color:var(--fg)]">Prestations</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      Clients avec grant actif sur la presta (chevauchement OK).
                    </p>
                    <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3">
                      {prestations.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm text-[color:var(--fg)]">
                          <input type="checkbox" name="prestation_id" value={p.id} />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-[color:var(--fg)]">Récurrence (optionnel)</span>
                  <select name="day_of_month" defaultValue="" className={daSelectClass}>
                    <option value="">Une seule fois</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Chaque mois le {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3 sm:px-5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  className="!rounded-lg !px-4 !py-2 text-sm"
                >
                  Annuler
                </Button>
                <SubmitSend />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
