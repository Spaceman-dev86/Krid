'use client'

import type { ReactNode } from 'react'

import Button from './Button'
import type { ButtonSize, ButtonVariant } from './Button'

type Props = {
  children: ReactNode
  confirmMessage: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  formAction?: (formData: FormData) => void | Promise<void>
}

/** Bouton submit avec confirmation native avant envoi du formulaire parent. */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  variant,
  size = 'sm',
  className,
  formAction,
}: Props) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      formAction={formAction}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </Button>
  )
}
