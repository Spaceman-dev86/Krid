import Link from 'next/link'

import { Button } from '@/src/components/ui'

const TABS = [
  { href: '/exercises', label: 'Trainly', match: (p: string) => p === '/exercises' || p.startsWith('/exercises?') },
  { href: '/exercises/mine', label: 'Ma biblio', match: (p: string) => p.startsWith('/exercises/mine') },
  {
    href: '/exercises/brouillon',
    label: 'Brouillon',
    match: (p: string) => p.startsWith('/exercises/brouillon'),
  },
] as const

export function ExercisesSubnav({ pathname }: { pathname: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex gap-1 rounded-xl border border-black/10 bg-white p-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                active
                  ? 'bg-[color:var(--brand)] text-[color:var(--icon-solid-fg)]'
                  : 'text-black/50 hover:text-[color:var(--brand)]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      <Button href="/exercises/new" className="!rounded-lg !px-4 !py-2 text-sm">
        + Exercice
      </Button>
    </div>
  )
}
