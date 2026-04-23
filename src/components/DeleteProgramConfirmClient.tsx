'use client'

import { createPortal } from 'react-dom'
import { useState, useTransition } from 'react'

import { IconTrash } from './ui/icons'

export default function DeleteProgramConfirmClient({
  formId,
  disabled,
}: {
  formId: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const effectiveDisabled = !!disabled || isPending

  return (
    <>
      <button
        type="button"
        disabled={effectiveDisabled}
        className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-white/60 disabled:opacity-50"
        aria-label="Supprimer"
        title="Supprimer"
        onClick={() => setOpen(true)}
      >
        <IconTrash className="h-5 w-5 text-white" />
      </button>

      {typeof document !== 'undefined' && open
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Fermer"
                onClick={() => (effectiveDisabled ? null : setOpen(false))}
              />
              <div className="absolute left-1/2 top-24 z-10 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
                <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
                  <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                    <div className="text-sm font-extrabold text-[var(--brand)]">Supprimer le programme</div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-gray-700 ring-1 ring-black/10 hover:bg-gray-50"
                      onClick={() => (effectiveDisabled ? null : setOpen(false))}
                      aria-label="Fermer"
                      title="Fermer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="text-sm font-semibold text-gray-900">Êtes-vous sûr de vouloir supprimer ce programme&nbsp;?</div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 disabled:opacity-60"
                        disabled={effectiveDisabled}
                        onClick={() => setOpen(false)}
                      >
                        Non
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10 disabled:opacity-60"
                        disabled={effectiveDisabled}
                        onClick={() => {
                          startTransition(async () => {
                            const form = document.getElementById(formId) as HTMLFormElement | null
                            if (form) form.requestSubmit()
                          })
                        }}
                      >
                        Oui
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
