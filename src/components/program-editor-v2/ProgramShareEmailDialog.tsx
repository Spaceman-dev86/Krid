'use client'

import { memo, useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { shareProgramPreviewByEmail } from '../../app/admin/programs/[id]/share/actions'
import { Button } from '@/src/components/ui'

type Props = {
  open: boolean
  programId: string
  programTitle: string
  onClose: () => void
}

function isValidEmail(email: string): boolean {
  const v = String(email ?? '').trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function ProgramShareEmailDialogInner({ open, programId, programTitle, onClose }: Props) {
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setTo('')
    setMessage('')
    setPending(false)
    setLocalError(null)
    setSent(false)
    setShareUrl(null)
    setCopied(false)
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const canSend = isValidEmail(to) && !pending

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSend) return

    setPending(true)
    setLocalError(null)

    try {
      const formData = new FormData()
      formData.set('programId', programId)
      formData.set('to', to)
      formData.set('message', message)

      const result = await shareProgramPreviewByEmail(null, formData)
      if (result && 'error' in result) {
        setLocalError(result.error)
        return
      }
      if (result && 'success' in result) {
        setSent(true)
        setShareUrl(result.shareUrl)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return
      setLocalError(err instanceof Error ? err.message : 'Échec de l’envoi.')
    } finally {
      setPending(false)
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" onClick={onClose} />

      <div
        className="absolute left-1/2 top-1/2 z-10 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="program-share-title"
      >
        <div className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-lg ring-1 ring-[var(--border)]">
          <div
            id="program-share-title"
            className="border-b border-[var(--border)] px-5 py-3 text-sm font-extrabold text-[color:var(--brand)]"
          >
            Envoyer le programme
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="p-5">
            <p className="text-sm text-[color:var(--fg)]">
              Envoie un lien d’aperçu pour <span className="font-semibold">{programTitle}</span>.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[color:var(--brand)]">Email</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  type="email"
                  placeholder="client@email.com"
                  autoComplete="email"
                  className="h-11 rounded-xl bg-[var(--surface)] px-4 text-sm text-[color:var(--fg)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[color:var(--brand)]">Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ajoute un message…"
                  className="min-h-28 rounded-xl bg-[var(--surface)] px-4 py-3 text-sm text-[color:var(--fg)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </label>
            </div>

            {sent ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  Email envoyé.
                </div>
                {shareUrl ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_8%,var(--surface))] px-4 py-3">
                    <p className="text-xs font-semibold text-[color:var(--brand)]">Lien d’aperçu</p>
                    <p className="mt-1 break-all text-xs text-[color:var(--muted)]">{shareUrl}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void copyShareLink()}
                      className="mt-3 !h-9 !rounded-xl !px-3 !py-0 text-xs"
                    >
                      {copied ? 'Copié !' : 'Copier le lien'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {localError ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                {localError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={pending}
                className="!h-10 !rounded-xl !px-4 !py-0 text-sm"
              >
                {sent ? 'Fermer' : 'Annuler'}
              </Button>
              {!sent ? (
                <Button
                  type="submit"
                  disabled={!canSend}
                  className="!h-10 !rounded-xl !px-4 !py-0 text-sm"
                >
                  {pending ? 'Envoi…' : 'Envoyer'}
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default memo(ProgramShareEmailDialogInner)
