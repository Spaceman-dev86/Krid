'use client'

import { memo } from 'react'

type IconProps = { size?: number; className?: string }

function base({ size = 16, className = '' }: IconProps) {
  return { width: size, height: size, className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }
}

export const IconChevron = memo(function IconChevron({ size = 16, className = '', open }: IconProps & { open?: boolean }) {
  const p = base({ size, className })
  return (
    <svg {...p}>
      <path d={open ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})

export const IconGrip = memo(function IconGrip({ size = 16, className = '' }: IconProps) {
  const p = base({ size, className: `text-[var(--brand)] ${className}`.trim() })
  return (
    <svg {...p}>
      <circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
})

export const IconEdit = memo(function IconEdit({ size = 14, className = '' }: IconProps) {
  const p = base({ size, className })
  return (
    <svg {...p}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})

export const IconTrash = memo(function IconTrash({ size = 16, className = '' }: IconProps) {
  const p = base({ size, className })
  return (
    <svg {...p}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})

export const IconPlus = memo(function IconPlus({ size = 16, className = '' }: IconProps) {
  const p = base({ size, className })
  return (
    <svg {...p}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
})

export const IconDuplicate = memo(function IconDuplicate({ size = 18, className = '' }: IconProps) {
  const p = base({ size, className })
  return (
    <svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="3" />
      <path d="M7 15H6a2 2 0 01-2-2V6a2 2 0 012-2h7a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})

export const IconMore = memo(function IconMore({ size = 16, className = '' }: IconProps) {
  const p = base({ size, className })
  return (
    <svg {...p}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
})
