'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'

import Button from './Button'
import type { ButtonSize, ButtonVariant } from './Button'

type Props = {
  children: ReactNode
  /** Affiché pendant le submit de CE bouton (avant redirect). */
  pendingLabel?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  formAction?: (formData: FormData) => void | Promise<void>
  disabled?: boolean
  title?: string
  type?: 'submit' | 'button'
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * CTA form qui redirige : spinner + libellé « Enregistrement… » sur le bouton cliqué.
 * À utiliser pour Publier / Garder brouillon / Enregistrer (pas le pill vert).
 */
export function PendingFormButton({
  children,
  pendingLabel = 'Enregistrement…',
  variant,
  size,
  className,
  formAction,
  disabled,
  title,
  type = 'submit',
  onClick,
}: Props) {
  const { pending } = useFormStatus()
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!pending) setArmed(false)
  }, [pending])

  const busy = pending && armed

  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      className={className}
      formAction={formAction}
      disabled={disabled || pending}
      title={title}
      aria-busy={busy}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        setArmed(true)
      }}
    >
      {busy ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner
            size={12}
            className={variant === 'secondary' || variant === 'ghost' ? undefined : 'text-[var(--brand-fg)]'}
          />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  )
}
