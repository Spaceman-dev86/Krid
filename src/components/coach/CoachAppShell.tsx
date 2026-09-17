'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { useSidebarCollapsed } from '@/src/components/shell/useSidebarCollapsed'
import {
  IconBook,
  IconCalendar,
  IconChat,
  IconDumbbell,
  IconFolder,
  IconHome,
  IconList,
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
  { href: '/formation', label: 'Formation', ready: true, Icon: IconBook },
  { href: '/payments', label: 'Comptabilités', ready: true, Icon: IconWallet },
  { href: '/profile', label: 'Profil public', ready: true, Icon: IconUser },
] as const

export function CoachAppShell({
  children,
  appName,
  trialLabel,
  title = 'Accueil',
  savUnread = 0,
}: {
  children: ReactNode
  appName?: string | null
  trialLabel?: string | null
  title?: string
  savUnread?: number
}) {
  const pathname = usePathname() || '/home'
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/')
  const { collapsed, toggle } = useSidebarCollapsed('trainly.coach.sidebar.collapsed')

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
                    <p className="truncate text-sm font-extrabold tracking-tight text-[var(--shell-fg)]">
                      {appName?.trim() || 'Mon app coach'}
                    </p>
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
            {!collapsed && trialLabel ? (
              <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--warning-bg)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--warning)] ring-1 ring-[var(--warning-border)]">
                {trialLabel}
              </p>
            ) : null}
          </div>

          <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? 'p-2' : 'p-3'}`}>
            {!collapsed ? (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">
                Navigation
              </p>
            ) : null}
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              const ItemIcon = item.Icon
              if (!item.ready) {
                return (
                  <span
                    key={item.href}
                    className={`app-shell-nav-link cursor-not-allowed opacity-35 ${collapsed ? 'justify-center px-0' : ''}`}
                    title="Prochaine tranche"
                  >
                    <ItemIcon size={18} className="shrink-0" />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </span>
                )
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active ? 'true' : 'false'}
                  title={item.label}
                  className={`app-shell-nav-link relative ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <ItemIcon size={18} className="shrink-0 opacity-90" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="md:hidden">
              <p className="text-sm font-extrabold text-[var(--brand)]">{appName?.trim() || 'Coach'}</p>
            </div>
            <p className="hidden text-sm font-extrabold tracking-tight text-[var(--brand)] md:block">{title}</p>
            <div className="flex items-center gap-2">
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
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
