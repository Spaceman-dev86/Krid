'use client'

import { memo, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import ProgramCoverImagePicker from './ProgramCoverImagePicker'

type Props = {
  open: boolean
  title: string
  description: ReactNode
  inputId: string
  currentImageUrl?: string | null
  submitLabel: string
  pendingLabel: string
  onClose: () => void
  onSubmit: (file: File) => Promise<{ error?: string; success?: boolean } | null | void>
}

function ProgramCoverDialogInner({
  open,
  title,
  description,
  inputId,
  currentImageUrl,
  submitLabel,
  pendingLabel,
  onClose,
  onSubmit,
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedFile(null)
    setLocalError(null)
    setPending(false)
  }, [open])

  if (!open || typeof document === 'undefined') return null

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending || !selectedFile) return

    setPending(true)
    setLocalError(null)

    try {
      const result = await onSubmit(selectedFile)
      if (result && 'error' in result && result.error) {
        setLocalError(result.error)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) return
      setLocalError(err instanceof Error ? err.message : 'Échec de l’enregistrement.')
    } finally {
      setPending(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer" onClick={onClose} />
      <div
        className="absolute left-1/2 top-1/2 z-10 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
          <div
            id={`${inputId}-title`}
            className="border-b border-black/10 px-5 py-3 text-sm font-extrabold text-[var(--brand)]"
          >
            {title}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="p-5">
            <div className="text-sm text-gray-700">{description}</div>

            <ProgramCoverImagePicker
              inputId={inputId}
              currentImageUrl={currentImageUrl}
              onFileChange={setSelectedFile}
              onValidationError={setLocalError}
            />

            {localError ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                {localError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900"
                onClick={onClose}
                disabled={pending}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!selectedFile || pending}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? pendingLabel : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default memo(ProgramCoverDialogInner)
