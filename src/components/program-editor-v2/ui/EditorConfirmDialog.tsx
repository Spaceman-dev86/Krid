'use client'

import { createPortal } from 'react-dom'
import { memo } from 'react'

type Props = {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

function EditorConfirmDialogInner({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
}: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Fermer"
        onClick={onCancel}
      />
      <div
        className="absolute left-1/2 top-1/2 z-10 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-confirm-title"
        aria-describedby="editor-confirm-message"
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
          {title ? (
            <div
              id="editor-confirm-title"
              className="border-b border-black/10 px-5 py-3 text-sm font-extrabold text-[var(--brand)]"
            >
              {title}
            </div>
          ) : null}
          <div className="p-5">
            <p id="editor-confirm-message" className="text-center text-sm font-semibold text-gray-900">
              {message}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900"
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default memo(EditorConfirmDialogInner)
