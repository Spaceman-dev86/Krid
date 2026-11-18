'use client'

import { useFormStatus } from 'react-dom'

import { deleteBilanBatchDeletableAction } from '@/src/app/clients/bilans/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { IconButton, IconTrash } from '@/src/components/ui'

function Submit({ count }: { count: number }) {
  const { pending } = useFormStatus()
  return (
    <IconButton
      type="submit"
      label={`Supprimer ${count} bilan${count > 1 ? 's' : ''} non rempli${count > 1 ? 's' : ''}`}
      tone="soft"
      size="sm"
      disabled={pending}
      className="!text-[var(--danger)]"
    >
      {pending ? (
        <FluidSpinner size={14} className="text-[var(--danger)]" />
      ) : (
        <IconTrash size={16} />
      )}
    </IconButton>
  )
}

type Props = {
  batchId: string
  deletableCount: number
  returnTo: string
  className?: string
}

/** Poubelle lot : supprime tous les bilans encore non remplis du batch. */
export function DeleteBilanBatchButton({
  batchId,
  deletableCount,
  returnTo,
  className,
}: Props) {
  if (deletableCount < 1) return null

  return (
    <form
      action={deleteBilanBatchDeletableAction}
      className={className}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Supprimer ${deletableCount} bilan${deletableCount > 1 ? 's' : ''} non rempli${
              deletableCount > 1 ? 's' : ''
            } de ce lot ? Les bilans déjà remplis sont conservés.`
          )
        ) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="batch_id" value={batchId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <Submit count={deletableCount} />
    </form>
  )
}
