'use client'

import type { ReactNode } from 'react'

import { PendingFormButton } from './PendingFormButton'
import type { ButtonSize, ButtonVariant } from './Button'

type Props = {
  children: ReactNode
  confirmMessage: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  formAction?: (formData: FormData) => void | Promise<void>
  pendingLabel?: string
}

/** Bouton submit avec confirmation native avant envoi du formulaire parent. */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  variant,
  size,
  className,
  formAction,
  pendingLabel = 'Enregistrement…',
}: Props) {
  return (
    <PendingFormButton
      variant={variant}
      size={size ?? 'sm'}
      className={className}
      formAction={formAction}
      pendingLabel={pendingLabel}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </PendingFormButton>
  )
}
