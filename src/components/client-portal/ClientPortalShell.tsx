'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

const TABS = [
  { href: 'profil', label: 'Profil', ready: true },
  { href: 'historique', label: 'Historique', ready: true },
  { href: 'home', label: 'Accueil', ready: true },
  { href: 'seance', label: 'Séance', ready: true },
  { href: 'coach', label: 'Coach', ready: true },
] as const

export function ClientPortalShell({
  slug,
  appName,
  primaryColor,
  logoUrl,
  children,
  profilBadgeCount,
}: {
  slug: string
  appName: string
  primaryColor: string
  logoUrl?: string | null
  children: ReactNode
  /** Nombre de bilans non ouverts (pastille onglet Profil). */
  profilBadgeCount?: number
}) {
  const pathname = usePathname() || ''
  const base = `/c/${slug}`
  const [badge, setBadge] = useState(profilBadgeCount ?? 0)

  useEffect(() => {
    if (typeof profilBadgeCount === 'number') setBadge(profilBadgeCount)
  }, [profilBadgeCount])

  useEffect(() => {
    let alive = true
    fetch(`/api/c/${slug}/unopened-bilans`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d: { count?: number }) => {
        if (alive && typeof d.count === 'number') setBadge(d.count)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug, pathname])

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f4f8] text-[#1a1220]">
      <header className="border-b border-black/10 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-9 rounded-full border border-black/10 object-cover"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: primaryColor }}
            >
              {appName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">
              Portail
            </p>
            <p className="text-sm font-extrabold" style={{ color: primaryColor }}>
              {appName}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-black/10 bg-white/95 backdrop-blur">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 py-1">
          {TABS.map((tab) => {
            const href = `${base}/${tab.href}`
            const active = pathname === href || pathname.startsWith(href + '/')
            if (!tab.ready) {
              return (
                <li key={tab.href} className="flex-1">
                  <span className="flex flex-col items-center px-1 py-2 text-[10px] font-semibold text-black/25">
                    {tab.label}
                  </span>
                </li>
              )
            }
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={href}
                  className="relative flex flex-col items-center px-1 py-2 text-[10px] font-bold"
                  style={{ color: active ? primaryColor : 'rgba(0,0,0,0.4)' }}
                >
                  <span className="relative inline-flex items-center justify-center">
                    {tab.label}
                    {tab.href === 'profil' && badge > 0 ? (
                      <span className="absolute -right-3.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
