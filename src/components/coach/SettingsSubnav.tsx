'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  {
    href: '/settings',
    label: 'Compte',
    match: (p: string) => p === '/settings',
  },
  {
    href: '/settings/billing',
    label: 'Abonnement',
    match: (p: string) => p.startsWith('/settings/billing'),
  },
  {
    href: '/settings/storage',
    label: 'Stockage',
    match: (p: string) => p.startsWith('/settings/storage'),
  },
  {
    href: '/settings/support',
    label: 'Aide',
    match: (p: string) => p.startsWith('/settings/support'),
  },
] as const

export function SettingsSubnav({ savUnread = 0 }: { savUnread?: number }) {
  const pathname = usePathname() || '/settings'

  return (
    <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] bg-[var(--accent)] p-1">
      {TABS.map((tab) => {
        const active = tab.match(pathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? 'rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[var(--brand)] shadow-da-sm'
                : 'rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)] hover:text-[var(--brand)]'
            }
          >
            {tab.label}
            {tab.href === '/settings/support' && savUnread > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-[var(--brand-fg)]">
                {savUnread > 9 ? '9+' : savUnread}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
