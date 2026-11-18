'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

import { KridMark, KridWordmark } from '@/src/components/brand/KridLogo'
import { ShellNavProgress } from '@/src/components/shell/ShellNavProgress'
import { useShellNavFeedback } from '@/src/components/shell/useShellNavFeedback'
import { useSidebarCollapsed } from '@/src/components/shell/useSidebarCollapsed'
import { useSoftKeyboardLayout } from '@/src/lib/useSoftKeyboardLayout'
import {
  IconBook,
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
  { href: '/admin/documentation', label: 'Documentation', exact: false, Icon: IconBook },
  { href: '/admin/sav', label: 'SAV', exact: false, Icon: IconNote },
  { href: '/admin/billing', label: 'Compta', exact: false, Icon: IconStats },
  { href: '/admin/access', label: 'Accès', exact: false, Icon: IconKey },
  { href: '/admin/spec', label: 'Spec', exact: false, Icon: IconNote },
  { href: '/admin/design', label: 'Design', exact: false, Icon: IconPalette },
] as const

function navIsActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

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
  const { pathname, routePending, beginNav, prefetchNav, warmNav } = useShellNavFeedback()
  const hidePageChrome =
    pathname.startsWith('/admin/spec') || /^\/admin\/programs\/[^/]+/.test(pathname)
  const settingsActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/')
  const { collapsed, toggle } = useSidebarCollapsed('trainly.admin.sidebar.collapsed')
  const [hoverExpand, setHoverExpand] = useState(false)
  const visuallyExpanded = !collapsed || hoverExpand
  useSoftKeyboardLayout()

  useEffect(() => {
    warmNav([...NAV.map((n) => n.href), '/admin/settings'])
  }, [warmNav])

  useEffect(() => {
    if (!collapsed) setHoverExpand(false)
  }, [collapsed])

  function onToggleSidebar() {
    setHoverExpand(false)
    toggle()
  }

  return (
    <div className="bg-da-canvas min-h-screen text-[color:var(--fg)]">
      <div className="relative z-[2] flex min-h-screen">
        <div
          className={`sticky top-0 z-40 hidden h-screen shrink-0 md:block ${
            collapsed ? 'w-16' : 'w-60'
          }`}
          onMouseEnter={() => {
            if (collapsed) setHoverExpand(true)
          }}
          onMouseLeave={() => setHoverExpand(false)}
        >
          <aside
            data-collapsed={visuallyExpanded ? 'false' : 'true'}
            className={`app-shell-aside flex h-full flex-col overflow-y-auto transition-[width,box-shadow] duration-200 ease-out ${
              collapsed && hoverExpand
                ? 'absolute inset-y-0 left-0 z-40 w-60 shadow-da-md'
                : 'relative w-full'
            }`}
          >
            <div className="flex h-14 shrink-0 items-center border-b border-[var(--border)] px-[var(--shell-pad-x)]">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 px-[var(--shell-row-px)]">
                <Link
                  href="/admin"
                  onClick={() => beginNav('/admin')}
                  onPointerEnter={() => prefetchNav('/admin')}
                  className="app-shell-nav-icon rounded-[var(--radius-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  aria-label="KRID Admin — Ops"
                  title={visuallyExpanded ? undefined : 'KRID'}
                >
                  <KridMark size="sm" />
                </Link>
                {visuallyExpanded ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <KridWordmark />
                      <p className="truncate text-[11px] font-semibold text-[var(--shell-muted)]">
                        Admin
                      </p>
                      {email ? (
                        <p className="mt-0.5 truncate text-[10px] text-[var(--shell-muted)] opacity-80">
                          {email}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={onToggleSidebar}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--shell-muted)] transition hover:bg-white/5 hover:text-[var(--shell-fg)]"
                      aria-label={collapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
                      title={collapsed ? 'Déplier (fixe)' : 'Replier'}
                    >
                      <IconPanelLeft size={18} />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-[var(--shell-pad-x)] py-2">
              {NAV.map((item) => {
                const active = navIsActive(pathname, item.href, item.exact)
                const ItemIcon = item.Icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={active ? 'true' : 'false'}
                    title={item.label}
                    onClick={() => beginNav(item.href)}
                    onPointerEnter={() => prefetchNav(item.href)}
                    className="app-shell-nav-link relative"
                  >
                    <span className="app-shell-nav-icon">
                      <ItemIcon size={18} className="opacity-90" />
                    </span>
                    {visuallyExpanded ? (
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
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {!hidePageChrome ? (
            <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)]/90 px-3 backdrop-blur md:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <KridMark size="sm" className="md:hidden" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)] md:hidden">
                    KRID
                  </p>
                  {title ? (
                    <h1 className="truncate text-sm font-bold tracking-tight text-[var(--brand)]">{title}</h1>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <nav className="da-scrollbar flex max-w-[min(100%,14.5rem)] min-w-0 gap-1 overflow-x-auto overscroll-x-contain md:hidden">
                  {NAV.slice(0, 4).map((item) => {
                    const active = navIsActive(pathname, item.href, item.exact)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => beginNav(item.href)}
                        onPointerEnter={() => prefetchNav(item.href)}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition ${
                          active
                            ? 'bg-[var(--brand)] text-[var(--brand-fg)] ring-[var(--brand)]'
                            : 'bg-[var(--accent)] text-[var(--brand-soft)] ring-[var(--border)]'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>
                <span className="relative inline-flex">
                  <Link
                    href="/admin/settings"
                    aria-label="Settings"
                    title="Settings"
                    onClick={() => beginNav('/admin/settings')}
                    onPointerEnter={() => prefetchNav('/admin/settings')}
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
          <div className="relative min-w-0 flex-1">
            <ShellNavProgress pending={routePending} />
            <div className={`min-h-0 ${routePending ? 'shell-route-pending' : ''}`}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
