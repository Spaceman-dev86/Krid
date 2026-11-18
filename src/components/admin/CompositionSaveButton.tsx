'use client'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button } from '@/src/components/ui'

export function CompositionSaveButton({
  disabled,
  pending,
  dirty,
}: {
  disabled?: boolean
  pending?: boolean
  /** Si false, le bouton est masqué (rien à sauver). */
  dirty?: boolean
}) {
  if (dirty === false && !pending) return null
  const busy = Boolean(disabled || pending)

  return (
    <Button
      type="submit"
      size="sm"
      className="!h-8 !gap-1.5 !rounded-full !px-3 !text-[12px]"
      disabled={busy}
    >
      {pending ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
      {pending ? 'Enregistrement…' : 'Enregistrer composition'}
    </Button>
  )
}
