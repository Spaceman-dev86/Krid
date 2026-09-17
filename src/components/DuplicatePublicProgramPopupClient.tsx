'use client'

import { createPortal } from 'react-dom'
import { useMemo, useState } from 'react'

import { Button } from '@/src/components/ui'

type PublicProgram = { id: string; title: string | null }

type Props = {
  publicPrograms: PublicProgram[]
  canDuplicate: boolean
  forkPublicProgram: (formData: FormData) => Promise<void>
}

export default function DuplicatePublicProgramPopupClient({ publicPrograms, canDuplicate, forkPublicProgram }: Props) {
  const [open, setOpen] = useState(false)
  const canUseDom = useMemo(() => typeof document !== 'undefined', [])

  if (!canDuplicate) {
    return (
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[color:var(--brand)] ring-1 ring-black/10 opacity-60"
        aria-label="Dupliquer"
        title="Dupliquer"
        disabled
      >
        Dupliquer
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-white px-5 text-sm font-extrabold text-[color:var(--brand)] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
        aria-label="Dupliquer"
        title="Dupliquer"
        onClick={() => setOpen(true)}
      >
        Dupliquer
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

              <div className="absolute left-1/2 top-24 z-10 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2">
                <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
                  <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                    <div className="text-sm font-extrabold text-[var(--brand)]">Dupliquer un programme public</div>
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
                    <div className="text-sm font-semibold text-gray-900">Choisis un programme à copier dans “Mes programmes”.</div>

                    <div className="mt-4 grid gap-2">
                      {publicPrograms.length > 0 ? (
                        publicPrograms.map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f5f5f5] p-3 ring-1 ring-black/10"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-[color:var(--brand)]">{p.title || 'Programme'}</div>
                              <div className="mt-1 text-xs font-semibold text-black/50">Programme public</div>
                            </div>

                            <form action={forkPublicProgram}>
                              <input type="hidden" name="program_id" value={p.id} />
                              <Button type="submit" size="sm" className="!h-10 !rounded-2xl !px-4 text-xs">
                                Dupliquer
                              </Button>
                            </form>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl bg-[#f5f5f5] p-3 text-sm font-semibold text-black/60 ring-1 ring-black/10">
                          Aucun programme public.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10"
                        onClick={() => setOpen(false)}
                      >
                        Fermer
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

