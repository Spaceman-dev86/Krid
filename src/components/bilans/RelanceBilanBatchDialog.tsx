'use client'

import { useEffect, useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { sendBilanBatchRelanceAction } from '@/src/app/clients/bilans/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, daFieldClass } from '@/src/components/ui'
import { bilanRelanceDraft } from '@/src/lib/bilans/relance'

type PendingMember = {
  clientId: string
  instanceId: string
  label: string
  bilanUrl: string
}

type Props = {
  batchId: string
  bilanTitle: string
  pending: PendingMember[]
  label?: string
  className?: string
}

/** Relance groupée : message commun + lien personnel par client. */
export function RelanceBilanBatchDialog({
  batchId,
  bilanTitle,
  pending,
  label = 'Relancer les non-réponses',
  className,
}: Props) {
  const titleId = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(() => bilanRelanceDraft(bilanTitle))
  const [error, setError] = useState<string | null>(null)
  const [pendingUi, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setBody(bilanRelanceDraft(bilanTitle))
    setError(null)
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
  }, [open, bilanTitle])

  if (!pending.length) return null

  function send() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('batch_id', batchId)
      // {{lien}} remplacé côté action ; on l’ajoute si absent
      const template = body.includes('{{lien}}')
        ? body
        : `${body.trim()}\n\n➡️ {{lien}}`
      fd.set('body_template', template)
      for (const m of pending) {
        fd.append('instance_id', m.instanceId)
        fd.append(`url_${m.instanceId}`, m.bilanUrl)
      }
      const res = await sendBilanBatchRelanceAction(fd)
      if (!res.ok) {
        setError(res.error || 'Envoi impossible')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 !rounded-[var(--radius-sm)] ${className ?? ''}`}
      >
        {label}
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
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
          <div className="relative z-[1] flex max-h-[90vh] w-full max-w-md flex-col rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:rounded-[1.25rem]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <div>
                <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                  Relance groupée
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  {pending.length} personne{pending.length > 1 ? 's' : ''} · lien perso inclus
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                onClick={() => setOpen(false)}
              >
                Fermer
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">
                  Message
                </span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className={daFieldClass}
                />
              </label>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                  Destinataires
                </p>
                <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto text-xs text-[color:var(--fg)]">
                  {pending.map((m) => (
                    <li key={m.instanceId} className="font-semibold">
                      {m.label}
                    </li>
                  ))}
                </ul>
              </div>
              {error ? (
                <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                className="!rounded-lg !px-4 !py-2 text-sm"
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={pendingUi || !body.trim()}
                onClick={send}
                className="inline-flex items-center gap-2 !rounded-lg !px-4 !py-2 text-sm font-bold"
              >
                {pendingUi ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
                {pendingUi ? 'Envoi…' : `Envoyer (${pending.length})`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
