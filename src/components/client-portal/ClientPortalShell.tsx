'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import {
  contrastBrandFg,
  deriveSecondaryColor,
  type ClientBgStyle,
  type ClientThemeMode,
} from '@/src/lib/coach/clientBrandTheme'
import { IconDumbbell, IconHome, IconList, IconUser, IconUsers } from '@/src/components/ui/icons'

import { BrandingLiveSync } from './BrandingLiveSync'

const TABS = [
  { href: 'profil', label: 'Profil', Icon: IconUser, ready: true },
  { href: 'historique', label: 'Historique', Icon: IconList, ready: true },
  { href: 'home', label: 'Accueil', Icon: IconHome, ready: true },
  { href: 'seance', label: 'Séance', Icon: IconDumbbell, ready: true },
  { href: 'coach', label: 'Coach', Icon: IconUsers, ready: true },
] as const

export function ClientPortalShell({
  slug,
  appName,
  primaryColor,
  secondaryColor,
  themeMode = 'dark',
  bgStyle = 'carbon',
  logoUrl,
  brandingUpdatedAt = null,
  hideBottomNav = false,
  chatLayout = false,
  children,
  profilBadgeCount,
}: {
  slug: string
  appName: string
  primaryColor: string
  secondaryColor?: string | null
  themeMode?: ClientThemeMode
  bgStyle?: ClientBgStyle
  logoUrl?: string | null
  brandingUpdatedAt?: string | null
  /** Fil messages : plein écran sans tab bar portail. */
  hideBottomNav?: boolean
  /** Messages : fond uni + zone chat pleine hauteur (pas de carbone qui dépasse). */
  chatLayout?: boolean
  children: ReactNode
  /** Nombre de bilans non ouverts (pastille onglet Profil). */
  profilBadgeCount?: number
}) {
  const pathname = usePathname() || ''
  const base = `/c/${slug}`
  const [badge, setBadge] = useState(profilBadgeCount ?? 0)

  const secondary = useMemo(
    () => secondaryColor?.trim() || deriveSecondaryColor(primaryColor),
    [secondaryColor, primaryColor]
  )
  const brandFg = useMemo(() => contrastBrandFg(primaryColor), [primaryColor])

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

  const shellStyle = {
    ['--brand']: primaryColor,
    ['--brand-secondary']: secondary,
    ['--brand-fg']: brandFg,
  } as CSSProperties

  const mutedNav = themeMode === 'dark' ? 'rgba(236,236,240,0.45)' : 'rgba(0,0,0,0.4)'

  const pageBg = chatLayout
    ? 'bg-[var(--surface)]'
    : bgStyle !== 'carbon'
      ? 'bg-[var(--page-bg)]'
      : 'bg-da-canvas'

  return (
    <div
      data-theme={themeMode}
      className={`flex flex-col text-[color:var(--fg)] ${pageBg} ${
        chatLayout ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-dvh'
      }`}
      style={shellStyle}
    >
      <BrandingLiveSync slug={slug} initialUpdatedAt={brandingUpdatedAt} />
      {/* z-[2] : au-dessus du flou carbon light (::before / ::after) */}
      <header className="relative z-[2] shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-9 rounded-xl border border-[var(--border)] object-cover"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-[var(--brand-fg)]"
              style={{ background: primaryColor }}
            >
              {appName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Portail
            </p>
            <p className="text-sm font-extrabold" style={{ color: primaryColor }}>
              {appName}
            </p>
          </div>
        </div>
      </header>

      <main
        className={
          chatLayout
            ? 'relative z-[2] flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--surface)]'
            : `relative z-[2] mx-auto w-full max-w-lg flex-1 px-4 py-5 ${
                hideBottomNav ? 'pb-4' : 'pb-24'
              }`
        }
      >
        {children}
      </main>

      {!hideBottomNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-[2] border-t border-[var(--border)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
          <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1.5 pb-1">
            {TABS.map((tab) => {
              const href = `${base}/${tab.href}`
              const active = pathname === href || pathname.startsWith(href + '/')
              const Icon = tab.Icon
              if (!tab.ready) {
                return (
                  <li key={tab.href} className="flex-1">
                    <span className="flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-semibold text-[color:var(--muted)] opacity-50">
                      <Icon size={22} />
                      {tab.label}
                    </span>
                  </li>
                )
              }
              return (
                <li key={tab.href} className="flex-1">
                  <Link
                    href={href}
                    className="relative flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-bold"
                    style={{ color: active ? primaryColor : mutedNav }}
                  >
                    <span className="relative inline-flex">
                      <Icon size={22} />
                      {tab.href === 'profil' && badge > 0 ? (
                        <span
                          className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-[var(--brand-fg)]"
                          style={{ backgroundColor: 'var(--brand-secondary)' }}
                        >
                          {badge > 9 ? '9+' : badge}
                        </span>
                      ) : null}
                    </span>
                    {tab.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
