'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const TABS = [
  {
    href: '/profile',
    label: 'Showroom',
    match: (p: string) => p === '/profile',
  },
  {
    href: '/profile/prestations',
    label: 'Prestations',
    match: (p: string) => p.startsWith('/profile/prestations'),
  },
  {
    href: '/profile/liens',
    label: 'Liens',
    match: (p: string) => p.startsWith('/profile/liens'),
  },
  {
    href: '/profile/codes',
    label: 'Codes',
    match: (p: string) => p.startsWith('/profile/codes'),
  },
  {
    href: '/profile/mon-app',
    label: 'Mon app',
    match: (p: string) => p.startsWith('/profile/mon-app'),
  },
] as const

function tabClass(active: boolean) {
  return active
    ? 'shrink-0 whitespace-nowrap rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--brand)] shadow-da-sm sm:px-3 sm:text-sm'
    : 'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)] sm:px-3 sm:text-sm'
}

/** Même fluidité que ProgramsPrimaryNav — pas de beginNav / skeleton page. */
export function ProfileSubnav({ savUnread = 0 }: { savUnread?: number }) {
  const pathname = usePathname() || '/profile'
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  void savUnread

  return (
    <nav
      className={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-[var(--accent)] p-1 ${
        pending ? 'opacity-70' : ''
      }`}
      aria-label="Section Profil"
      data-builder-chrome
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={tabClass(active)}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              if (active) return
              startTransition(() => router.push(tab.href))
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
