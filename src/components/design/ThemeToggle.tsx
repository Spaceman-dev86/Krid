'use client'

import { useEffect, useState } from 'react'

import { DA_BLACK, DA_WHITE } from '../../lib/design/tokens'
import {
  applyTheme,
  readStoredTheme,
  setStoredTheme,
  THEME_EVENT,
  type AppTheme,
} from '../../lib/design/theme'

function useSyncedTheme() {
  const [theme, setTheme] = useState<AppTheme>('dark')

  useEffect(() => {
    const current = readStoredTheme()
    setTheme(current)
    applyTheme(current)

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AppTheme>).detail
      setTheme(detail === 'light' || detail === 'dark' ? detail : readStoredTheme())
    }
    window.addEventListener(THEME_EVENT, onChange)
    return () => window.removeEventListener(THEME_EVENT, onChange)
  }, [])

  function select(next: AppTheme) {
    setTheme(next)
    setStoredTheme(next)
  }

  return { theme, select }
}

/** Applies persisted theme on mount (avoids FOUC when paired with inline script). */
export function ThemeInit() {
  useEffect(() => {
    applyTheme(readStoredTheme())
  }, [])
  return null
}

export function DesignThemeToggle() {
  const { theme, select } = useSyncedTheme()

  const isLight = theme === 'light'
  const da = isLight ? DA_WHITE : DA_BLACK

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => select('dark')}
          aria-pressed={!isLight}
          className={
            !isLight
              ? 'rounded-full bg-gradient-to-r from-[var(--brand-soft)] via-[var(--brand)] to-[var(--brand-mid)] px-4 py-2 text-sm font-bold text-[var(--brand-fg)] shadow-da-brand'
              : 'rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:text-[color:var(--fg)]'
          }
        >
          Black mode
        </button>
        <button
          type="button"
          onClick={() => select('light')}
          aria-pressed={isLight}
          className={
            isLight
              ? 'rounded-full bg-gradient-to-r from-[var(--brand-soft)] via-[var(--brand)] to-[var(--brand-mid)] px-4 py-2 text-sm font-bold text-[var(--brand-fg)] shadow-da-brand'
              : 'rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:text-[color:var(--fg)]'
          }
        >
          White mode
        </button>
      </div>
      <p className="max-w-sm text-xs leading-relaxed text-[color:var(--muted)]">
        <span className="font-semibold text-[var(--brand)]">{da.label}</span> — brand{' '}
        <code className="text-[color:var(--fg)]">{da.brand.principal}</code>
        {isLight ? ' · traits soft + sidebar gris clair' : ' · carbon + sidebar quasi-noir'}
      </p>
    </div>
  )
}

/** Compact Black / White switch for coach + admin shells */
export function ShellThemeToggle({
  className,
  variant = 'shell',
}: {
  className?: string
  /** shell = sidebar · page = contenu (ex. /home) */
  variant?: 'shell' | 'page'
}) {
  const { theme, select } = useSyncedTheme()

  const isLight = theme === 'light'
  const isPage = variant === 'page'

  return (
    <div
      className={
        className ??
        (isPage
          ? 'grid grid-cols-2 gap-1 rounded-[var(--radius-sm)] bg-[var(--accent)] p-1 ring-1 ring-[var(--border)]'
          : 'grid grid-cols-2 gap-1 rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--shell-fg)_6%,transparent)] p-1')
      }
      role="group"
      aria-label="Thème"
    >
      <button
        type="button"
        onClick={() => select('dark')}
        aria-pressed={!isLight}
        className={
          !isLight
            ? 'rounded-[calc(var(--radius-sm)-2px)] bg-[var(--brand)] px-2 py-1.5 text-[11px] font-bold text-[var(--brand-fg)]'
            : isPage
              ? 'rounded-[calc(var(--radius-sm)-2px)] px-2 py-1.5 text-[11px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]'
              : 'rounded-[calc(var(--radius-sm)-2px)] px-2 py-1.5 text-[11px] font-semibold text-[var(--shell-muted)] hover:text-[var(--shell-fg)]'
        }
      >
        Black
      </button>
      <button
        type="button"
        onClick={() => select('light')}
        aria-pressed={isLight}
        className={
          isLight
            ? 'rounded-[calc(var(--radius-sm)-2px)] bg-[var(--brand)] px-2 py-1.5 text-[11px] font-bold text-[var(--brand-fg)]'
            : isPage
              ? 'rounded-[calc(var(--radius-sm)-2px)] px-2 py-1.5 text-[11px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]'
              : 'rounded-[calc(var(--radius-sm)-2px)] px-2 py-1.5 text-[11px] font-semibold text-[var(--shell-muted)] hover:text-[var(--shell-fg)]'
        }
      >
        White
      </button>
    </div>
  )
}

export function DesignDaSummary() {
  const [theme, setTheme] = useState<AppTheme>('dark')

  useEffect(() => {
    setTheme(readStoredTheme())
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AppTheme>).detail
      setTheme(detail === 'light' ? 'light' : readStoredTheme())
    }
    window.addEventListener(THEME_EVENT, onChange)
    return () => window.removeEventListener(THEME_EVENT, onChange)
  }, [])

  const da = theme === 'light' ? DA_WHITE : DA_BLACK

  return (
    <div className="grid gap-4 rounded-[var(--radius-lg)] bg-[var(--surface)] p-6 ring-1 ring-[var(--border)] md:grid-cols-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          DA active
        </p>
        <h3 className="mt-2 text-lg font-extrabold text-[var(--brand)]">{da.label}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">{da.summary}</p>
      </div>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
          <dt className="text-[color:var(--muted)]">Brand principal</dt>
          <dd className="font-semibold text-[var(--brand)]">{da.brand.principal}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
          <dt className="text-[color:var(--muted)]">Page</dt>
          <dd className="font-medium text-[color:var(--fg)]">{da.surfaces.page}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
          <dt className="text-[color:var(--muted)]">Surface / accent</dt>
          <dd className="font-medium text-[color:var(--fg)]">
            {da.surfaces.surface} / {da.surfaces.accent}
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-1.5">
          <dt className="text-[color:var(--muted)]">Texte</dt>
          <dd className="font-medium text-[color:var(--fg)]">{da.text.text}</dd>
        </div>
      </dl>
    </div>
  )
}
