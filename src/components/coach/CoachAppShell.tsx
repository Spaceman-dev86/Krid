'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'

import { KridMark, KridWordmark } from '@/src/components/brand/KridLogo'
import { ShellNavProvider } from '@/src/components/shell/ShellNavContext'
import { ShellNavProgress } from '@/src/components/shell/ShellNavProgress'
import { useShellNavFeedback } from '@/src/components/shell/useShellNavFeedback'
import { useSidebarCollapsed } from '@/src/components/shell/useSidebarCollapsed'
import {
  IconBell,
  IconBook,
  IconCalendar,
  IconChat,
  IconClose,
  IconDumbbell,
  IconFolder,
  IconHome,
  IconList,
  IconMenu,
  IconNote,
  IconPanelLeft,
  IconSettings,
  IconUser,
  IconUsers,
  IconWallet,
  IconButton,
} from '@/src/components/ui'

const NAV = [
  { href: '/home', label: 'Dashboard', ready: true, Icon: IconHome },
  { href: '/clients', label: 'Clients', ready: true, Icon: IconUsers },
  { href: '/chat', label: 'Chat', ready: true, Icon: IconChat },
  { href: '/calendar', label: 'Calendrier', ready: true, Icon: IconCalendar },
  { href: '/programs', label: 'Programme', ready: true, Icon: IconList },
  { href: '/nutrition', label: 'Nutrition', ready: true, Icon: IconNote },
  { href: '/exercises', label: 'Exercices', ready: true, Icon: IconDumbbell },
  { href: '/drive', label: 'Drive', ready: true, Icon: IconFolder },
  { href: '/documentation', label: 'Documentation', ready: true, Icon: IconBook },
  { href: '/reseau', label: 'Réseau', ready: true, Icon: IconUsers },
  { href: '/payments', label: 'Comptabilités', ready: true, Icon: IconWallet },
  { href: '/profile', label: 'Profil public', ready: true, Icon: IconUser },
] as const

/** Hubs / listes sous /programs — pas le day-board `/programs/[id]`. */
const PROGRAMS_SHELL_SEGMENTS = new Set([
  'brouillon',
  'templates',
  'catalogue',
  'encours',
  'sessions',
  'new',
  'plans',
])

function isProgramBuilderPath(pathname: string) {
  // Preview catalogue Krid `/programs/catalogue/[id]` = même plein cadre que le PB
  // (la liste `/programs/catalogue` reste avec top bar).
  if (/^\/programs\/catalogue\/[^/]+/.test(pathname)) return true
  const m = pathname.match(/^\/programs\/([^/]+)/)
  if (!m) return false
  return !PROGRAMS_SHELL_SEGMENTS.has(m[1])
}

function UnreadBadge({ count, collapsed }: { count: number; collapsed?: boolean }) {
  if (count <= 0) return null
  const label = count > 9 ? '9+' : String(count)
  if (collapsed) {
    return (
      <span className="pointer-events-none absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[9px] font-bold text-[var(--brand-fg)]">
        {label}
      </span>
    )
  }
  return (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-[var(--brand-fg)]">
      {label}
    </span>
  )
}

export function CoachAppShell({
  children,
  appName,
  trialLabel,
  title = 'Accueil',
  savUnread = 0,
  chatUnread = 0,
  notifUnread = 0,
  notifHref = '/chat',
}: {
  children: ReactNode
  appName?: string | null
  trialLabel?: string | null
  title?: string
  savUnread?: number
  /** Messages chat non lus (tous fils) → badge nav Chat */
  chatUnread?: number
  /** Notifs métier (chat / RDV…) → cloche */
  notifUnread?: number
  notifHref?: string
}) {
  const shellNav = useShellNavFeedback()
  const { pathname, routePending, beginNav, prefetchNav, warmNav } = shellNav
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/')
  /** Comme admin `/admin/programs/[id]` : plein builder, sans top bar cloche/settings. */
  const hidePageChrome = isProgramBuilderPath(pathname)
  const { collapsed, toggle } = useSidebarCollapsed('trainly.coach.sidebar.collapsed')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  /** Hover-expand quand repliée : overlay, sans élargir le rail (pas de décalage page). */
  const [hoverExpand, setHoverExpand] = useState(false)
  const railCollapsed = collapsed
  const visuallyExpanded = !collapsed || hoverExpand

  useEffect(() => {
    warmNav([...NAV.filter((n) => n.ready).map((n) => n.href), '/settings'])
  }, [warmNav])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!collapsed) setHoverExpand(false)
  }, [collapsed])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  function go(href: string) {
    setMobileNavOpen(false)
    beginNav(href)
  }

  function onToggleSidebar() {
    setHoverExpand(false)
    toggle()
  }

  return (
    <ShellNavProvider value={shellNav}>
    <div className="bg-da-canvas min-h-screen text-[color:var(--fg)]">
      <div className="relative z-[2] flex min-h-screen">
        {/* Rail sticky : largeur figée si collapsed ; panel hover en overlay (sans décalage). */}
        <div
          className={`sticky top-0 z-40 hidden h-screen shrink-0 md:block ${
            railCollapsed ? 'w-16' : 'w-60'
          }`}
          onMouseEnter={() => {
            if (railCollapsed) setHoverExpand(true)
          }}
          onMouseLeave={() => setHoverExpand(false)}
        >
          <aside
            data-collapsed={visuallyExpanded ? 'false' : 'true'}
            className={`app-shell-aside flex h-full flex-col overflow-y-auto transition-[width,box-shadow] duration-200 ease-out ${
              railCollapsed && hoverExpand
                ? 'absolute inset-y-0 left-0 z-40 w-60 shadow-da-md'
                : 'relative w-full'
            }`}
          >
            {/* Hauteur = top bar (h-14) → trait aligné. Toggle seulement en version ouverte. */}
            <div className="flex h-14 shrink-0 items-center border-b border-[var(--border)] px-[var(--shell-pad-x)]">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 px-[var(--shell-row-px)]">
                <Link
                  href="/home"
                  onClick={() => beginNav('/home')}
                  onPointerEnter={() => prefetchNav('/home')}
                  className="app-shell-nav-icon rounded-[var(--radius-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  aria-label="KRID — Accueil"
                  title={visuallyExpanded ? undefined : 'KRID'}
                >
                  <KridMark size="sm" />
                </Link>
                {visuallyExpanded ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <KridWordmark />
                      <p className="truncate text-[11px] font-semibold text-[var(--shell-muted)]">
                        {appName?.trim() || 'Mon app coach'}
                      </p>
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
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const ItemIcon = item.Icon
                if (!item.ready) {
                  return (
                    <span
                      key={item.href}
                      className="app-shell-nav-link cursor-not-allowed opacity-35"
                      title="Prochaine tranche"
                    >
                      <span className="app-shell-nav-icon">
                        <ItemIcon size={18} />
                      </span>
                      {visuallyExpanded ? <span className="truncate">{item.label}</span> : null}
                    </span>
                  )
                }
                const showChatBadge = item.href === '/chat' && chatUnread > 0
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
                    {visuallyExpanded ? <span className="truncate">{item.label}</span> : null}
                    {showChatBadge ? (
                      <UnreadBadge count={chatUnread} collapsed={!visuallyExpanded} />
                    ) : null}
                  </Link>
                )
              })}
            </nav>
          </aside>
        </div>

        {/* Drawer mobile (< md) */}
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
              aria-label="Fermer le menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="app-shell-aside absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col shadow-da-md">
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-4">
                <KridMark size="sm" />
                <div className="min-w-0 flex-1">
                  <KridWordmark />
                  <p className="truncate text-[11px] font-semibold text-[var(--shell-muted)]">
                    {appName?.trim() || 'Mon app coach'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--shell-muted)] hover:bg-white/5 hover:text-[var(--shell-fg)]"
                  aria-label="Fermer"
                >
                  <IconClose size={18} />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                {NAV.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  const ItemIcon = item.Icon
                  if (!item.ready) {
                    return (
                      <span
                        key={item.href}
                        className="app-shell-nav-link cursor-not-allowed opacity-35"
                        title="Prochaine tranche"
                      >
                        <ItemIcon size={18} className="shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                    )
                  }
                  const showChatBadge = item.href === '/chat' && chatUnread > 0
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-active={active ? 'true' : 'false'}
                      onClick={() => go(item.href)}
                      onPointerEnter={() => prefetchNav(item.href)}
                      className="app-shell-nav-link"
                    >
                      <ItemIcon size={18} className="shrink-0 opacity-90" />
                      <span className="truncate">{item.label}</span>
                      {showChatBadge ? <UnreadBadge count={chatUnread} /> : null}
                    </Link>
                  )
                })}
                <Link
                  href="/settings"
                  data-active={settingsActive ? 'true' : 'false'}
                  onClick={() => go('/settings')}
                  onPointerEnter={() => prefetchNav('/settings')}
                  className="app-shell-nav-link mt-2"
                >
                  <IconSettings size={18} className="shrink-0 opacity-90" />
                  <span className="truncate">Paramètres</span>
                  {savUnread > 0 ? (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-[var(--brand-fg)]">
                      {savUnread > 9 ? '9+' : savUnread}
                    </span>
                  ) : null}
                </Link>
              </nav>
            </aside>
          </div>
        ) : null}

        <div className="relative z-0 flex min-w-0 flex-1 flex-col">
          {!hidePageChrome ? (
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur md:px-6">
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--fg)] ring-1 ring-[var(--border)] transition hover:bg-[var(--accent)]"
                  aria-label="Ouvrir la navigation"
                  aria-expanded={mobileNavOpen}
                >
                  <IconMenu size={18} />
                </button>
                <KridMark size="sm" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                    KRID
                  </p>
                  <p className="truncate text-sm font-extrabold text-[var(--brand)]">
                    {appName?.trim() || 'Coach'}
                  </p>
                </div>
              </div>
              <p className="hidden text-sm font-extrabold tracking-tight text-[var(--brand)] md:block">
                {title}
              </p>
              <div className="flex items-center gap-2">
                {trialLabel ? (
                  <p
                    className="max-w-[11rem] truncate rounded-[var(--radius-sm)] bg-[var(--warning-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--warning)] ring-1 ring-[var(--warning-border)] sm:max-w-none"
                    title={trialLabel}
                  >
                    {trialLabel}
                  </p>
                ) : null}
                <span className="relative inline-flex">
                  <IconButton
                    href={notifHref}
                    label="Notifications"
                    tone={
                      pathname.startsWith('/calendar') || pathname.startsWith('/chat')
                        ? 'solid'
                        : 'soft'
                    }
                    size="sm"
                  >
                    <IconBell size={18} />
                  </IconButton>
                  {notifUnread > 0 ? (
                    <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-[color:var(--page-bg)]">
                      {notifUnread > 9 ? '9+' : notifUnread}
                    </span>
                  ) : null}
                </span>
                <span className="relative inline-flex">
                  <IconButton
                    href="/settings"
                    label="Paramètres"
                    tone={settingsActive ? 'solid' : 'soft'}
                    size="sm"
                  >
                    <IconSettings size={18} />
                  </IconButton>
                  {savUnread > 0 ? (
                    <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[9px] font-bold text-[var(--brand-fg)]">
                      {savUnread > 9 ? '9+' : savUnread}
                    </span>
                  ) : null}
                </span>
              </div>
            </header>
          ) : null}
          <div className="relative min-w-0 flex-1">
            <ShellNavProgress pending={routePending} />
            {hidePageChrome ? (
              <div className={`min-h-0 ${routePending ? 'shell-route-pending' : ''}`}>{children}</div>
            ) : (
              <main
                className={`flex-1 px-4 py-6 md:px-8 ${routePending ? 'shell-route-pending' : ''}`}
              >
                {children}
              </main>
            )}
          </div>
        </div>
      </div>
    </div>
    </ShellNavProvider>
  )
}
