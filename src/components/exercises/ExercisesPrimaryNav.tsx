'use client'

import Link from 'next/link'
import { Suspense, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

function tabClass(active: boolean) {
  return active
    ? 'shrink-0 whitespace-nowrap rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--brand)] shadow-da-sm sm:px-3 sm:text-sm'
    : 'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)] sm:px-3 sm:text-sm'
}

const TABS = [
  { href: '/exercises', label: 'Exercices', match: (p: string) =>
      p.startsWith('/exercises') &&
      !p.startsWith('/exercises/blocks') &&
      !p.startsWith('/exercises/tags'),
  },
  {
    href: '/exercises/blocks',
    label: 'Blocs',
    match: (p: string) => p.startsWith('/exercises/blocks'),
  },
  {
    href: '/exercises/tags',
    label: 'Tags',
    match: (p: string) => p.startsWith('/exercises/tags'),
  },
] as const

function ExercisesPrimaryNavInner() {
  const pathname = usePathname() || '/exercises'
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <nav
      className={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-[var(--accent)] p-1 ${
        pending ? 'opacity-70' : ''
      }`}
      aria-label="Section Exercices"
      data-builder-chrome
    >
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          prefetch
          className={tabClass(t.match(pathname))}
          onClick={(e) => {
            e.preventDefault()
            startTransition(() => router.push(t.href))
          }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

function Fallback() {
  return (
    <nav
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-[var(--accent)] p-1"
      aria-label="Section Exercices"
    >
      {TABS.map((t) => (
        <span
          key={t.href}
          className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[color:var(--muted)] sm:px-3 sm:text-sm"
        >
          {t.label}
        </span>
      ))}
    </nav>
  )
}

export function ExercisesPrimaryNav() {
  return (
    <Suspense fallback={<Fallback />}>
      <ExercisesPrimaryNavInner />
    </Suspense>
  )
}
