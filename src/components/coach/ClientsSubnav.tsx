'use client'

import Link from 'next/link'
import { Suspense, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isClientFichePath(p: string) {
  if (p === '/clients') return true
  if (!p.startsWith('/clients/')) return false
  const seg = p.split('/')[2] ?? ''
  return !['groupes', 'bilans', 'codes'].includes(seg)
}

/** Détail d’une instance bilan (pas hub / batch / templates). */
function isBilanInstancePath(p: string) {
  const parts = p.split('/').filter(Boolean)
  return parts.length === 3 && parts[0] === 'clients' && parts[1] === 'bilans' && UUID_RE.test(parts[2])
}

function tabClass(active: boolean) {
  return active
    ? 'shrink-0 whitespace-nowrap rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-xs font-bold text-[color:var(--brand)] shadow-da-sm sm:px-3 sm:text-sm'
    : 'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)] sm:px-3 sm:text-sm'
}

function ClientsSubnavInner() {
  const pathname = usePathname() || '/clients'
  const fromHub = useSearchParams().get('from') === 'hub'
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const listeActive = isClientFichePath(pathname) || (isBilanInstancePath(pathname) && !fromHub)
  const bilansActive =
    pathname === '/clients/bilans' ||
    pathname.startsWith('/clients/bilans/batch') ||
    pathname.startsWith('/clients/bilans/templates') ||
    (isBilanInstancePath(pathname) && fromHub)

  const tabs: Array<{ href: string; label: string; active: boolean }> = [
    { href: '/clients', label: 'Clients', active: listeActive },
    {
      href: '/clients/groupes',
      label: 'Groupes',
      active: pathname === '/clients/groupes' || pathname.startsWith('/clients/groupes/'),
    },
    { href: '/clients/bilans', label: 'Bilans', active: bilansActive },
  ]

  return (
    <nav
      className={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-[var(--accent)] p-1 ${
        pending ? 'opacity-70' : ''
      }`}
      aria-label="Section Clients"
      data-builder-chrome
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          prefetch
          className={tabClass(tab.active)}
          aria-current={tab.active ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault()
            if (tab.active) return
            startTransition(() => router.push(tab.href))
          }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

function ClientsSubnavFallback() {
  return (
    <nav
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-[var(--accent)] p-1"
      aria-label="Section Clients"
    >
      {['Clients', 'Groupes', 'Bilans'].map((label) => (
        <span
          key={label}
          className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[color:var(--muted)] sm:px-3 sm:text-sm"
        >
          {label}
        </span>
      ))}
    </nav>
  )
}

/** Même fluidité que ProgramsPrimaryNav — pas de beginNav / skeleton page. */
export function ClientsSubnav() {
  return (
    <Suspense fallback={<ClientsSubnavFallback />}>
      <ClientsSubnavInner />
    </Suspense>
  )
}
