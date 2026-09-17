import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

/** Titre de page — 3xl extrabold brand */
export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn('text-3xl font-extrabold tracking-tight text-[var(--brand)]', className)}>
      {children}
    </h1>
  )
}

/** Titre de section — xl extrabold brand */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('text-xl font-extrabold tracking-tight text-[var(--brand)]', className)}>
      {children}
    </h2>
  )
}

/** Corps */
export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-sm leading-relaxed text-[color:var(--fg)]', className)}>{children}</p>
}

/** Secondaire */
export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-sm leading-relaxed text-[color:var(--muted)]', className)}>{children}</p>
  )
}

/** Eyebrow uppercase */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]',
        className,
      )}
    >
      {children}
    </p>
  )
}
