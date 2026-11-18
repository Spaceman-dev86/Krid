'use client'

import { useFormStatus } from 'react-dom'

import { deleteBilanInstanceAction } from '@/src/app/clients/bilans/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { IconButton, IconTrash } from '@/src/components/ui'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <IconButton
      type="submit"
      label="Supprimer"
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
  instanceId: string
  returnTo: string
  className?: string
}

export function DeleteBilanButton({ instanceId, returnTo, className }: Props) {
  return (
    <form
      action={deleteBilanInstanceAction}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm('Supprimer ce bilan ? Le client ne pourra plus y répondre.')) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="instance_id" value={instanceId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <Submit />
    </form>
  )
}
