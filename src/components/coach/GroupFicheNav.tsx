'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useOptionalShellNav } from '@/src/components/shell/ShellNavContext'

type Props = {
  groupId: string
}

const TABS = [
  { seg: '', label: 'Infos' },
  { seg: 'prestation', label: 'Presta' },
  { seg: 'bilan', label: 'Bilans' },
  { seg: 'drive', label: 'Drive' },
] as const

export function GroupFicheNav({ groupId }: Props) {
  const pathname = usePathname() || ''
  const base = `/clients/groupes/${groupId}`
  const shellNav = useOptionalShellNav()

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent)] p-1" aria-label="Sections fiche groupe">
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
