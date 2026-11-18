'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useOptionalShellNav } from '@/src/components/shell/ShellNavContext'

type Props = {
  clientId: string
}

const TABS = [
  { seg: '', label: 'Infos' },
  { seg: 'program', label: 'Programme' },
  { seg: 'nutrition', label: 'Nutrition' },
  { seg: 'prestation', label: 'Prestation' },
  { seg: 'bilan', label: 'Bilans' },
] as const

export function ClientFicheNav({ clientId }: Props) {
  const pathname = usePathname() || ''
  const base = `/clients/${clientId}`
  const shellNav = useOptionalShellNav()

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent)] p-1" aria-label="Sections fiche client">
      {TABS.map((tab) => {
        const href = tab.seg ? `${base}/${tab.seg}` : base
        const active = tab.seg
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base

        return (
          <Link
            key={tab.label}
            href={href}
            prefetch
            onClick={() => shellNav?.beginNav(href)}
            onPointerEnter={() => shellNav?.prefetchNav(href)}
            className={
              active
                ? 'rounded-lg bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[color:var(--brand)] shadow-da-sm'
                : 'rounded-lg px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)]'
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
