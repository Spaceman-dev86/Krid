'use client'

import { useEffect, useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { sendBilanRelanceAction } from '@/src/app/clients/bilans/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, daFieldClass } from '@/src/components/ui'
import { bilanRelanceDraft, bilanRelanceMessage } from '@/src/lib/bilans/relance'

type Props = {
  clientId: string
  instanceId: string
  bilanTitle: string
  bilanUrl: string
  label?: string
  className?: string
}

/** Popup preview message éditable → envoi chat sans quitter les bilans. */
export function RelanceBilanDialog({
  clientId,
  instanceId,
  bilanTitle,
  bilanUrl,
  label = 'Relancer',
  className,
}: Props) {
  const titleId = useId()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(() => bilanRelanceDraft(bilanTitle))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setBody(bilanRelanceDraft(bilanTitle))
    setError(null)
    setCopied(false)
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

  function send() {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('client_id', clientId)
      fd.set('instance_id', instanceId)
      fd.set('body', bilanRelanceMessage(body, bilanUrl))
      const res = await sendBilanRelanceAction(fd)
      if (!res.ok) {
        setError(res.error || 'Envoi impossible')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  async function copyLink() {
    if (!bilanUrl) return
    try {
      await navigator.clipboard.writeText(bilanUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
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
              <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                Relancer
              </p>
              <button
                type="button"
                className="text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                onClick={() => setOpen(false)}
              >
                Fermer
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <p className="text-xs text-[color:var(--muted)]">
                Message chat · le lien vers le bilan est ajouté automatiquement.
              </p>
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
              {bilanUrl ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                      Lien inclus
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="text-[10px] font-bold text-[color:var(--brand)] hover:underline"
                    >
                      {copied ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                  <p className="mt-1 break-all text-xs font-semibold text-[color:var(--brand)]">
                    {bilanUrl}
                  </p>
                  <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                    « {bilanTitle} »
                  </p>
                </div>
              ) : (
                <p className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
                  Pas de lien client (slug app manquant) — le message partira sans URL.
                </p>
              )}
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
                disabled={pending || !body.trim()}
                onClick={send}
                className="inline-flex items-center gap-2 !rounded-lg !px-4 !py-2 text-sm font-bold"
              >
                {pending ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
                {pending ? 'Envoi…' : 'Envoyer'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
