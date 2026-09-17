'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  {
    href: '/payments',
    label: 'Paiements',
    match: (p: string) => p === '/payments' || p.startsWith('/payments?'),
  },
  {
    href: '/payments/suivi-clients',
    label: 'Suivi clients',
    match: (p: string) => p.startsWith('/payments/suivi-clients'),
  },
  {
    href: '/payments/factures',
    label: 'Factures',
    match: (p: string) => p.startsWith('/payments/factures'),
  },
  {
    href: '/payments/prestations',
    label: 'Prestations',
    match: (p: string) =>
      p.startsWith('/payments/prestations') || /^\/payments\/[^/]+$/.test(p),
  },
  {
    href: '/payments/stats',
    label: 'Stats',
    match: (p: string) => p.startsWith('/payments/stats'),
  },
] as const

export function PaymentsSubnav() {
  const pathname = usePathname() || '/payments'

  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent)] p-1">
      {TABS.map((tab) => {
        const active =
          tab.href === '/payments'
            ? pathname === '/payments'
            : tab.match(pathname)
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
