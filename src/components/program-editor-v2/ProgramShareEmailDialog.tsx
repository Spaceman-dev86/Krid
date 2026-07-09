'use client'

import { memo, useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { shareProgramPreviewByEmail } from '../../app/admin/programs/[id]/share/actions'

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

  useEffect(() => {
    if (!open) return
    setTo('')
    setMessage('')
    setPending(false)
    setLocalError(null)
    setSent(false)
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
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return
      setLocalError(err instanceof Error ? err.message : 'Échec de l’envoi.')
    } finally {
      setPending(false)
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
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
          <div
            id="program-share-title"
            className="border-b border-black/10 px-5 py-3 text-sm font-extrabold text-[var(--brand)]"
          >
            Envoyer le programme
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="p-5">
            <p className="text-sm text-gray-700">
              Envoie un lien d’aperçu pour <span className="font-semibold">{programTitle}</span>.
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#341c44]">Email</span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  type="email"
                  placeholder="client@email.com"
                  autoComplete="email"
                  className="h-11 rounded-xl bg-white px-4 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#341c44]">Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ajoute un message…"
                  className="min-h-28 rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]"
                />
              </label>
            </div>

            {sent ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                Email envoyé.
              </div>
            ) : null}

            {localError ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                {localError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-extrabold ring-1 ring-[#d6c4e8] bg-clip-text text-transparent bg-gradient-to-r from-[#9b6bb8] to-[#341c44] transition hover:bg-[#faf7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44] focus-visible:ring-offset-2"
                onClick={onClose}
                disabled={pending}
              >
                {sent ? 'Fermer' : 'Annuler'}
              </button>
              {!sent ? (
                <button
                  type="submit"
                  disabled={!canSend}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] px-4 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(52,28,68,0.2)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? 'Envoi…' : 'Envoyer'}
                </button>
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

