'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import {
  contrastBrandFg,
  deriveSecondaryColor,
  type ClientBgStyle,
  type ClientThemeMode,
} from '@/src/lib/coach/clientBrandTheme'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '@/src/lib/coach/defaultClientPrimaryColor'

type Props = {
  initialThemeMode?: ClientThemeMode | null
  initialBgStyle?: ClientBgStyle | null
  initialPrimaryColor?: string | null
  initialSecondaryColor?: string | null
  appName?: string | null
  logoUrl?: string | null
  /** Champs au-dessus des toggles (nom, slug…). */
  leadingFields?: ReactNode
  /** Champs sous les couleurs (logo, CTA…). */
  trailingFields?: ReactNode
}

export function CoachBrandingThemeFields({
  initialThemeMode,
  initialBgStyle,
  initialPrimaryColor,
  initialSecondaryColor,
  appName,
  logoUrl,
  leadingFields,
  trailingFields,
}: Props) {
  const [themeMode, setThemeMode] = useState<ClientThemeMode>(
    initialThemeMode === 'light' ? 'light' : 'dark',
  )
  const [bgStyle, setBgStyle] = useState<ClientBgStyle>(
    initialBgStyle === 'solid' ? 'solid' : 'carbon',
  )
  const [primary, setPrimary] = useState(
    initialPrimaryColor?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR,
  )
  const [secondary, setSecondary] = useState(
    initialSecondaryColor?.trim() || deriveSecondaryColor(primary),
  )

  const previewSecondary = useMemo(
    () => secondary.trim() || deriveSecondaryColor(primary),
    [secondary, primary],
  )
  const brandFg = useMemo(() => contrastBrandFg(primary), [primary])
  const secondaryFg = useMemo(() => contrastBrandFg(previewSecondary), [previewSecondary])

  const label = appName?.trim() || 'Mon app'
  const letter = label.slice(0, 1).toUpperCase()
  const mutedNav = themeMode === 'dark' ? 'rgba(236,236,240,0.45)' : 'rgba(0,0,0,0.4)'

  const skipBumpRef = useRef(true)
  useEffect(() => {
    if (skipBumpRef.current) {
      skipBumpRef.current = false
      return
    }
    const form = document.getElementById('coach-branding-form') as HTMLFormElement | null
    form?.dispatchEvent(new Event('change', { bubbles: true }))
  }, [themeMode, bgStyle, primary, previewSecondary])

  return (
    <>
      <input type="hidden" name="theme_mode" value={themeMode} />
      <input type="hidden" name="bg_style" value={bgStyle} />

      <div className="grid gap-3 lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[240px] lg:mx-0 lg:self-start">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Aperçu portail
            </p>
            <p className="text-[9px] text-[color:var(--muted)]">
              {themeMode === 'dark' ? 'Dark' : 'Light'} · {bgStyle === 'carbon' ? 'carbon' : 'uni'}
            </p>
          </div>
          <div
            data-theme={themeMode}
            className={`relative flex min-h-[280px] w-full flex-col overflow-hidden rounded-[1.35rem] border-2 border-[var(--border)] shadow-da-md ring-1 ring-black/10 ${
              bgStyle === 'carbon'
                ? 'bg-da-canvas'
                : themeMode === 'dark'
                  ? 'bg-[#0c0c0e]'
                  : 'bg-[#f3f3f5]'
            }`}
            style={
              {
                ['--brand']: primary,
                ['--brand-secondary']: previewSecondary,
                ['--brand-fg']: brandFg,
              } as CSSProperties
            }
          >
            <div className="relative z-[2] flex items-center justify-between px-3 pt-2 text-[8px] font-semibold text-[color:var(--fg)]">
              <span>9:41</span>
              <span className="opacity-70">●●●</span>
            </div>

            <header className="relative z-[2] border-b border-[var(--border)] bg-[var(--surface)]/95 px-2.5 py-2 backdrop-blur">
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-7 w-7 rounded-lg border border-[var(--border)] object-cover"
                  />
                ) : (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold"
                    style={{ background: primary, color: brandFg }}
                  >
                    {letter}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                    Portail
                  </p>
                  <p className="truncate text-[11px] font-extrabold" style={{ color: primary }}>
                    {label}
                  </p>
                </div>
              </div>
            </header>

            <div className="relative z-[2] flex flex-1 flex-col gap-2 px-2.5 py-2.5 pb-12">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-da-sm">
                <p className="text-[9px] font-semibold text-[color:var(--muted)]">Accueil</p>
                <p className="mt-0.5 text-xs font-extrabold text-[color:var(--fg)]">Bonjour 👋</p>
                <p className="mt-0.5 text-[9px] leading-snug text-[color:var(--muted)]">
                  Séance · messages · bilans
                </p>
                <span
                  className="mt-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold"
                  style={{ backgroundColor: previewSecondary, color: secondaryFg }}
                >
                  2
                </span>
              </div>
              <div className="flex gap-1.5">
                <span
                  className="inline-flex flex-1 items-center justify-center rounded-md py-1.5 text-[9px] font-bold"
                  style={{ backgroundColor: primary, color: brandFg }}
                >
                  Primaire
                </span>
                <span
                  className="inline-flex flex-1 items-center justify-center rounded-md py-1.5 text-[9px] font-bold"
                  style={{ backgroundColor: previewSecondary, color: secondaryFg }}
                >
                  Secondaire
                </span>
              </div>
            </div>

            <nav className="absolute inset-x-0 bottom-0 z-[2] border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
              <ul className="flex items-stretch justify-between px-0.5 py-1">
                {['Profil', 'Histo', 'Accueil', 'Séance', 'Coach'].map((tab, i) => (
                  <li key={tab} className="flex-1 text-center">
                    <span
                      className="block text-[7px] font-bold"
                      style={{ color: i === 2 ? primary : mutedNav }}
                    >
                      {tab}
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="grid gap-2.5 content-start">
          {leadingFields}

          <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--accent)]/35 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Apparence
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['dark', 'Dark'],
                  ['light', 'Light'],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setThemeMode(id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition ${
                    themeMode === id
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] ring-[var(--brand)]'
                      : 'text-[color:var(--muted)] ring-[var(--border)] hover:bg-[var(--accent)]'
                  }`}
                >
                  {text}
                </button>
              ))}
              <span className="mx-0.5 self-center text-[color:var(--border)]" aria-hidden>
                ·
              </span>
              {(
                [
                  ['carbon', 'Carbon'],
                  ['solid', 'Uni'],
                ] as const
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBgStyle(id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition ${
                    bgStyle === id
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] ring-[var(--brand)]'
                      : 'text-[color:var(--muted)] ring-[var(--border)] hover:bg-[var(--accent)]'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Couleur principale</span>
              <input
                name="primary_color"
                type="color"
                value={primary}
                onChange={(e) => {
                  const next = e.target.value
                  setPrimary(next)
                  if (
                    !initialSecondaryColor?.trim() &&
                    secondary === deriveSecondaryColor(primary)
                  ) {
                    setSecondary(deriveSecondaryColor(next))
                  }
                }}
                className="h-9 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
              />
            </label>

            <label className="grid gap-0.5 text-sm">
              <span className="text-xs font-semibold text-[color:var(--fg)]">Couleur secondaire</span>
              <input
                name="secondary_color"
                type="color"
                value={previewSecondary}
                onChange={(e) => setSecondary(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
              />
              <span className="text-[10px] text-[color:var(--muted)]">
                Pastilles · badges · accents
              </span>
            </label>
          </div>

          {trailingFields}
        </div>
      </div>
    </>
  )
}
