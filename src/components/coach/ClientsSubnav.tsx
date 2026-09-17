'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/clients', label: 'Liste', match: (p: string) => p === '/clients' || /^\/clients\/[^/]+$/.test(p) },
  {
    href: '/clients/groupes',
    label: 'Groupes',
    match: (p: string) => p === '/clients/groupes' || p.startsWith('/clients/groupes/'),
  },
  {
    href: '/clients/bilans',
    label: 'Bilans',
    match: (p: string) => p === '/clients/bilans' || p.startsWith('/clients/bilans'),
  },
  {
    href: '/clients/codes',
    label: 'Codes',
    match: (p: string) => p === '/clients/codes' || p.startsWith('/clients/codes/'),
  },
  {
    href: '/clients/notifications',
    label: 'Notifications',
    match: (p: string) => p.startsWith('/clients/notifications'),
    disabled: true,
  },
] as const

export function ClientsSubnav() {
  const pathname = usePathname() || '/clients'

  return (
    <div className="flex gap-1 rounded-xl bg-[var(--accent)] p-1">
      {TABS.map((tab) => {
        const disabled = 'disabled' in tab && tab.disabled
        const active = tab.match(pathname)
        if (disabled) {
          return (
            <span
              key={tab.href}
              title="Hors V1"
              className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)]"
            >
              {tab.label}
            </span>
          )
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
    </div>
  )
}
