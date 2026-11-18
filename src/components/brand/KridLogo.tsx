'use client'

import { useId } from 'react'

import { cn } from '@/src/lib/cn'

type MarkSize = 'sm' | 'md' | 'lg'

const SIZE: Record<MarkSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
}

/**
 * Marque KRID — pastille géométrique + monogramme K (barre + diagonale dynamique).
 * Gradient unique par instance (SSR-safe via useId).
 */
export function KridMark({
  className,
  size = 'md',
}: {
  className?: string
  size?: MarkSize
}) {
  const uid = useId().replace(/:/g, '')
  const gradId = `krid-g-${uid}`
  const shineId = `krid-s-${uid}`

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-[var(--radius-sm)] shadow-da-brand',
        SIZE[size],
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" role="img">
        <defs>
          <linearGradient id={gradId} x1="6" y1="4" x2="36" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--brand-soft)" />
            <stop offset="42%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-mid)" />
          </linearGradient>
          <linearGradient id={shineId} x1="8" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="9" fill={`url(#${gradId})`} />
        <path d="M9 3.5h22a7 7 0 0 1 7 7v6.5H2V10.5a7 7 0 0 1 7-7z" fill={`url(#${shineId})`} />
        {/* Stem */}
        <rect x="11" y="10" width="4.2" height="20" rx="1.2" fill="var(--brand-fg)" />
        {/* Upper arm */}
        <path
          d="M16.4 18.2 25.8 10.4a1.35 1.35 0 0 1 1.9.15l1.35 1.55a1.35 1.35 0 0 1-.2 1.9L18.2 21.2l-1.8-3z"
          fill="var(--brand-fg)"
        />
        {/* Lower arm — légèrement plus large (élan) */}
        <path
          d="M16.4 21.6 28.1 29.6a1.35 1.35 0 0 1 .15 1.9l-1.45 1.45a1.35 1.35 0 0 1-1.9-.1L15.5 24.6l.9-3z"
          fill="var(--brand-fg)"
        />
        {/* Accent node */}
        <circle cx="29.2" cy="12.2" r="1.55" fill="var(--brand-fg)" opacity="0.55" />
      </svg>
    </span>
  )
}

export function KridWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'text-sm font-extrabold tracking-[0.16em] text-[var(--shell-fg)]',
        className,
      )}
    >
      KRID
    </span>
  )
}
