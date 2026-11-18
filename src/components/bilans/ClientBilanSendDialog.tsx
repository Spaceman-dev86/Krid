'use client'

import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { sendBilanAction } from '@/src/app/clients/bilans/actions'
import { Button, daFieldClass, daSelectClass } from '@/src/components/ui'

export type ClientBilanRecapItem = {
  id: string
  title: string
  statusLabel: string
  dateLabel: string
}

type TemplateOpt = { id: string; title: string }

type Props = {
  clientId: string
  clientLabel: string
  templates: TemplateOpt[]
  recentBilans: ClientBilanRecapItem[]
  /** Après envoi (whitelist côté action). */
  returnTo: string
  triggerLabel?: string
  triggerSize?: 'sm' | 'md'
  triggerClassName?: string
}

function SubmitSend() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? 'Envoi…' : 'Envoyer'}
    </Button>
  )
}

export function ClientBilanSendDialog({
  clientId,
  clientLabel,
  templates,
  recentBilans,
  returnTo,
  triggerLabel = 'Bilan',
  triggerSize = 'sm',
  triggerClassName,
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)

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
      <Button
        type="button"
        size={triggerSize}
        variant="secondary"
        disabled
        title="Aucun template prêt"
        className={triggerClassName ?? '!rounded-[var(--radius-sm)]'}
      >
        {triggerLabel}
      </Button>
    )
  }

  return (
    <>
      <Button
        type="button"
        size={triggerSize}
        variant="secondary"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? '!rounded-[var(--radius-sm)]'}
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
          <div className="relative z-[1] flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:max-h-[85vh] sm:rounded-[1.25rem]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                  Envoyer un bilan
                </p>
                <p className="truncate text-xs text-[color:var(--muted)]">{clientLabel}</p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                onClick={() => setOpen(false)}
              >
                Fermer
              </button>
            </div>

            <form action={sendBilanAction} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="client_id" value={clientId} />

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--fg)]">Derniers bilans</p>
                    <Link
                      href="/clients/bilans"
                      className="text-xs font-semibold text-[color:var(--brand)] underline-offset-2 hover:underline"
                    >
                      Voir tous les bilans
                    </Link>
                  </div>
                  {!recentBilans.length ? (
                    <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[color:var(--muted)]">
                      Aucun bilan pour ce client.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--page-bg)]">
                      {recentBilans.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[color:var(--fg)]">{b.title}</p>
                            <p className="text-[11px] text-[color:var(--muted)]">{b.dateLabel}</p>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-[color:var(--muted)]">
                            {b.statusLabel}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="space-y-3 border-t border-[var(--border)] pt-4">
                  <p className="text-sm font-semibold text-[color:var(--fg)]">Nouveau</p>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold text-[color:var(--fg)]">Template</span>
                    <select name="template_id" required className={daSelectClass} defaultValue="">
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
                    <span className="text-xs text-[color:var(--muted)]">
                      Vide = maintenant · deadline = +14 j
                    </span>
                  </label>
                </section>
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
