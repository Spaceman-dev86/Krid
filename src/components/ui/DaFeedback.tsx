import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type Tone = 'success' | 'warning' | 'danger'

const TONE: Record<Tone, string> = {
  success:
    'rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]',
  warning:
    'rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]',
  danger:
    'rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]',
}

/** Bannières feedback DA (/admin/design). */
export function DaBanner({
  tone,
  children,
  className,
}: {
  tone: Tone
  children: ReactNode
  className?: string
}) {
  return <div className={cn(TONE[tone], className)}>{children}</div>
}

/** Champ formulaire thème-aware. */
export const daFieldClass =
  'rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm font-normal text-[color:var(--fg)] outline-none focus:ring-2 focus:ring-[var(--brand)]'

/**
 * Select : flèche custom inset (pas la flèche OS collée au bord).
 * Chevron SVG en data-URI, padding-right généreux.
 */
export const daSelectClass = [
  daFieldClass,
  'w-full appearance-none',
  'bg-[length:1rem_1rem] bg-[right_0.85rem_center] bg-no-repeat',
  "bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%23a3a3a8%27 stroke-width=%272%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 d=%27M19 9l-7 7-7-7%27/%3E%3C/svg%3E')]",
  'pr-11',
].join(' ')
