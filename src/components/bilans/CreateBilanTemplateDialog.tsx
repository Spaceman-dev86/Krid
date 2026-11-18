'use client'

import { useEffect, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { createTemplateAction, saveDraftTemplateAction } from '@/src/app/clients/bilans/actions'
import { Button, IconButton, IconClose, IconPlus } from '@/src/components/ui'
import { BilanTemplateFormFields } from './BilanTemplateFormFields'

function PendingLabel({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return <>{pending ? busy : idle}</>
}

type Props = {
  defaultOpen?: boolean
  /** Après création ready → redirect ici + ouvre envoi (fiche client). */
  returnTo?: string
  trigger?: 'icon' | 'button'
  triggerLabel?: string
}

export function CreateBilanTemplateDialog({
  defaultOpen = false,
  returnTo,
  trigger = 'icon',
  triggerLabel = 'Créer un bilan',
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(defaultOpen)

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
      {trigger === 'button' ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(true)}
          className="!rounded-lg !px-3 !py-2 text-sm font-bold"
        >
          {triggerLabel}
        </Button>
      ) : (
        <IconButton type="button" label={triggerLabel} tone="solid" size="md" onClick={() => setOpen(true)}>
          <IconPlus size={20} />
        </IconButton>
      )}

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
          <div className="relative z-[1] flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:max-h-[85vh] sm:rounded-[1.25rem]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                Nouveau bilan
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
            <form
              action={createTemplateAction}
              className="flex min-h-0 flex-1 flex-col"
            >
              {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <BilanTemplateFormFields titleRequired />
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  className="!rounded-lg !px-4 !py-2 text-sm"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  formAction={saveDraftTemplateAction}
                  formNoValidate
                  variant="secondary"
                  className="!rounded-lg !px-4 !py-2 text-sm"
                >
                  <PendingLabel idle="Brouillon" busy="…" />
                </Button>
                <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">
                  <PendingLabel idle="Créer" busy="Création…" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
