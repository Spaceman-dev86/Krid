'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { useSidebarCollapsed } from '@/src/components/shell/useSidebarCollapsed'
import {
  IconBook,
  IconFolder,
  IconHome,
  IconKey,
  IconList,
  IconNote,
  IconPalette,
  IconPanelLeft,
  IconSettings,
  IconStats,
  IconUsers,
} from '@/src/components/ui'

const NAV = [
  { href: '/admin', label: 'Ops', exact: true, Icon: IconHome },
  { href: '/admin/coaches', label: 'Coaches', exact: false, Icon: IconUsers },
  { href: '/admin/catalog', label: 'Catalogue', exact: false, Icon: IconList },
  { href: '/admin/drive-packs', label: 'Drive', exact: false, Icon: IconFolder },
  { href: '/admin/formation', label: 'Formation', exact: false, Icon: IconBook },
  { href: '/admin/sav', label: 'SAV', exact: false, Icon: IconNote },
  { href: '/admin/billing', label: 'Compta', exact: false, Icon: IconStats },
  { href: '/admin/access', label: 'Accès', exact: false, Icon: IconKey },
  { href: '/admin/spec', label: 'Spec', exact: false, Icon: IconNote },
  { href: '/admin/design', label: 'Design', exact: false, Icon: IconPalette },
] as const

export function AdminAppShell({
  children,
  email,
  title,
  savBadge = 0,
}: {
  children: ReactNode
  email?: string | null
  title?: string
  savBadge?: number
}) {
  const pathname = usePathname() || '/admin'
  const hidePageChrome =
    pathname.startsWith('/admin/spec') ||
    /^\/admin\/programs\/[^/]+/.test(pathname)
  const settingsActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/')
  const { collapsed, toggle } = useSidebarCollapsed('trainly.admin.sidebar.collapsed')

  return (
    <div className="bg-da-canvas min-h-screen text-[color:var(--fg)]">
      <div className="relative z-[2] flex min-h-screen">
        <aside
          data-collapsed={collapsed ? 'true' : 'false'}
          className={`app-shell-aside sticky top-0 hidden h-screen shrink-0 flex-col self-start overflow-y-auto md:flex ${
            collapsed ? 'w-[4.25rem]' : 'w-60'
          }`}
        >
          <div className={`border-b border-[var(--border)] ${collapsed ? 'px-2 py-3' : 'px-4 py-5'}`}>
            <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}>
              {!collapsed ? (
                <>
                  <div className="app-shell-brand-mark h-9 w-9 shrink-0 rounded-[var(--radius-sm)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-muted)]">
                      Trainly
                    </p>
                    <p className="truncate text-sm font-extrabold tracking-tight text-[var(--shell-fg)]">Admin</p>
                  </div>
                </>
              ) : (
                <div className="app-shell-brand-mark h-8 w-8 shrink-0 rounded-[var(--radius-sm)]" aria-hidden />
              )}
              <button
                type="button"
                onClick={toggle}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--shell-muted)] transition hover:bg-white/5 hover:text-[var(--shell-fg)]"
                aria-label={collapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
                title={collapsed ? 'Déplier' : 'Replier'}
              >
                <IconPanelLeft size={18} />
              </button>
            </div>
            {!collapsed && email ? (
              <>
                <p className="mt-3 truncate rounded-[var(--radius-sm)] bg-black/25 px-2.5 py-1.5 text-[11px] text-[var(--shell-muted)] ring-1 ring-white/10 da-only-dark">
                  {email}
                </p>
                <p className="mt-3 truncate rounded-[var(--radius-sm)] bg-black/[0.04] px-2.5 py-1.5 text-[11px] text-[var(--shell-muted)] ring-1 ring-black/10 da-only-light">
                  {email}
                </p>
              </>
            ) : null}
          </div>

          <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? 'p-2' : 'p-3'}`}>
            {!collapsed ? (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">
                Plateforme
              </p>
            ) : null}
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/')
              const ItemIcon = item.Icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active ? 'true' : 'false'}
                  title={item.label}
                  className={`app-shell-nav-link relative ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <ItemIcon size={18} className="shrink-0 opacity-90" />
                  {!collapsed ? (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.href === '/admin/sav' && savBadge > 0 ? (
                        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-[var(--brand-fg)]">
                          {savBadge > 9 ? '9+' : savBadge}
                        </span>
                      ) : null}
                    </>
                  ) : item.href === '/admin/sav' && savBadge > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {!hidePageChrome ? (
            <header className="sticky top-0 z-10 flex h-10 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)]/90 px-3 backdrop-blur md:px-4">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)] md:hidden">
                  Admin
                </p>
                {title ? (
                  <h1 className="truncate text-sm font-bold tracking-tight text-[var(--brand)]">
                    {title}
                  </h1>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <nav className="flex flex-wrap gap-1 md:hidden">
                  {NAV.slice(0, 4).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-soft)] ring-1 ring-[var(--border)]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <span className="relative inline-flex">
                  <Link
                    href="/admin/settings"
                    aria-label="Settings"
                    title="Settings"
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] transition ${
                      settingsActive
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                        : 'text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]'
                    }`}
                  >
                    <IconSettings size={15} />
                  </Link>
                  {savBadge > 0 ? (
                    <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--brand)] px-0.5 text-[8px] font-bold text-[var(--brand-fg)]">
                      {savBadge > 9 ? '9+' : savBadge}
                    </span>
                  ) : null}
                </span>
              </div>
            </header>
          ) : null}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
