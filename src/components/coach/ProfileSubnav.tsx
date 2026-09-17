'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  {
    href: '/profile',
    label: 'Profil',
    match: (p: string) => p === '/profile',
  },
  {
    href: '/profile/liens',
    label: 'Liens',
    match: (p: string) => p.startsWith('/profile/liens'),
  },
  {
    href: '/profile/prestations',
    label: 'Prestations',
    match: (p: string) => p.startsWith('/profile/prestations'),
  },
  {
    href: '/profile/mon-app',
    label: 'Mon app',
    match: (p: string) => p.startsWith('/profile/mon-app'),
  },
] as const

export function ProfileSubnav({ savUnread = 0 }: { savUnread?: number }) {
  const pathname = usePathname() || '/profile'
  void savUnread

  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-[var(--accent)] p-1">
      {TABS.map((tab) => {
        const active = tab.match(pathname)
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
