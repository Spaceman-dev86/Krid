'use client'

import { createPortal } from 'react-dom'
import { ReactNode, useMemo, useState } from 'react'

type Props = {
  title?: string
  message?: string
  triggerClassName: string
  triggerAriaLabel: string
  triggerTitle: string
  trigger: ReactNode
}

export default function ProgramLimitPopupClient({
  title,
  message,
  triggerClassName,
  triggerAriaLabel,
  triggerTitle,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false)

  const canUseDom = useMemo(() => typeof document !== 'undefined', [])

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </button>

      {canUseDom && open
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              />

              <div className="absolute left-1/2 top-24 z-10 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
                <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
                  <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                    <div className="text-sm font-extrabold text-[var(--brand)]">{title ?? 'Action impossible'}</div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-gray-700 ring-1 ring-black/10 hover:bg-gray-50"
                      onClick={() => setOpen(false)}
                      aria-label="Fermer"
                      title="Fermer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="text-sm font-semibold text-gray-900">
                      {message ?? 'Limite atteinte : tu ne peux avoir qu’un seul programme.'}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10"
                        onClick={() => setOpen(false)}
                      >
                        OK
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
