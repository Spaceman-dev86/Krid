'use client'

import { useEffect, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { createClientAction } from '@/src/app/clients/actions'
import { Button, IconButton, IconClose, IconPlus } from '@/src/components/ui'

function SubmitCreate() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? 'Création…' : 'Créer'}
    </Button>
  )
}

export function AddClientDialog() {
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

  return (
    <>
      <IconButton type="button" label="Ajouter un client" tone="solid" size="md" onClick={() => setOpen(true)}>
        <IconPlus size={20} />
      </IconButton>

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
          <div className="relative z-[1] w-full max-w-md rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md sm:rounded-[1.25rem] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                Ajouter un client
              </p>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              >
                <IconClose size={18} />
              </button>
            </div>

            <form action={createClientAction} className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-semibold">Email *</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="client@email.com"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Prénom</span>
                <input name="first_name" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Nom</span>
                <input name="last_name" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-semibold">Téléphone</span>
                <input name="phone" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  className="!rounded-lg !px-4 !py-2 text-sm"
                >
                  Annuler
                </Button>
                <SubmitCreate />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
