'use client'

import { memo, type ReactNode } from 'react'

type Props = {
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  danger?: boolean
  active?: boolean
  /** brand = violet (semaine/séance), muted = fond gris + motif violet (bloc/exercice), inverted = fond blanc + motif violet (header semaine ouverte) */
  variant?: 'brand' | 'muted' | 'inverted'
  children: ReactNode
}

function ToolbarIconButtonInner({
  label,
  onClick,
  disabled,
  danger,
  active,
  variant = 'brand',
  children,
}: Props) {
  const tone =
    variant === 'muted'
      ? 'bg-gray-100 text-[var(--brand)] ring-gray-200 hover:bg-gray-200'
      : variant === 'inverted'
        ? 'bg-white text-[var(--brand)] ring-white/40 hover:bg-white/90'
        : 'bg-[var(--brand)] text-white ring-black/10 hover:opacity-90'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-8 w-8 flex-none items-center justify-center rounded-full shadow-sm ring-1 transition',
        tone,
        active ? 'ring-2 ring-[var(--brand)] ring-offset-2' : '',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default memo(ToolbarIconButtonInner)
