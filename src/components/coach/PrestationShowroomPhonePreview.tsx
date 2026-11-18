'use client'

import { useMemo, useRef, type CSSProperties } from 'react'

import PhoneMockupFrameClient from '@/src/components/PhoneMockupFrameClient'
import { IosStatusBar } from '@/src/components/client-portal/IosStatusBar'
import {
  contrastBrandFg,
  deriveSecondaryColor,
  normalizeBgStyle,
  normalizeThemeMode,
  type ClientBgStyle,
  type ClientThemeMode,
} from '@/src/lib/coach/clientBrandTheme'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '@/src/lib/coach/defaultClientPrimaryColor'
import type { ShowroomWeekPreview } from '@/src/lib/prestations/loadShowroomWeekPreview'
import type { IncludedContentItem } from '@/src/lib/prestations/showroomPresentation'

import { PrestationShowroomVignette } from './PrestationShowroomVignette'

const RENDU_IPHONE_FRAME = '/mockups/mockup_vide.png'

type Props = {
  /** Header showroom (même source que /profile showroom). */
  publicName?: string | null
  tagline?: string | null
  coachPhotoUrl?: string | null
  coverUrl?: string | null
  headerTags?: string[]
  appName?: string | null
  logoUrl?: string | null
  name: string
  description?: string | null
  showroomDescription?: string | null
  priceCents: number
  pricingType: string
  photoUrl: string | null
  videoUrl?: string | null
  photoIsCover?: boolean
  videoRole?: 'cover' | 'inline' | null
  eyebrow?: string | null
  ctaLabel?: string | null
  tags: string[]
  popupTags?: string[]
  included?: IncludedContentItem[]
  weekPreview?: ShowroomWeekPreview | null
  brandColor?: string | null
  secondaryColor?: string | null
  themeMode?: ClientThemeMode | string | null
  bgStyle?: ClientBgStyle | string | null
}

/** Mockup iPhone = header showroom live + cette offre. */
export function PrestationShowroomPhonePreview({
  publicName,
  tagline,
  coachPhotoUrl,
  coverUrl,
  headerTags = [],
  appName,
  logoUrl,
  brandColor,
  secondaryColor,
  themeMode: themeModeRaw,
  bgStyle: bgStyleRaw,
  ...vignetteProps
}: Props) {
  const sheetHostRef = useRef<HTMLDivElement>(null)
  const brand = brandColor?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
  const secondary = secondaryColor?.trim() || deriveSecondaryColor(brand)
  const brandFg = contrastBrandFg(brand)
  const themeMode = normalizeThemeMode(themeModeRaw)
  const bgStyle = normalizeBgStyle(bgStyleRaw)
  const appLabel = appName?.trim() || 'Krid'
  const coach = publicName?.trim() || appLabel
  const letter = coach.slice(0, 1).toUpperCase()
  const hasCover = Boolean(coverUrl?.trim())
  const taglineText = tagline?.trim() || ''

  const shellStyle = useMemo(
    () =>
      ({
        ['--brand']: brand,
        ['--brand-secondary']: secondary,
        ['--brand-fg']: brandFg,
      }) as CSSProperties,
    [brand, secondary, brandFg],
  )

  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'

  return (
    <PhoneMockupFrameClient
      ariaLabel="Aperçu showroom"
      frameSrc={RENDU_IPHONE_FRAME}
      frameOnTop
      scrollable={false}
      className="pointer-events-none max-w-[280px] sm:max-w-[300px]"
      viewportStyle={{ top: '2.8%', bottom: '2.8%', left: '5.2%', right: '5.2%' }}
      viewportClassName="!bg-transparent !rounded-[12%]"
    >
      <div
        data-theme={themeMode}
        className={`relative h-full min-h-0 overflow-hidden text-[color:var(--fg)] ${pageBg}`}
        style={shellStyle}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[6] pt-[0.58rem] pb-1">
          <IosStatusBar
            light
            className="!pl-[1.35rem] !pr-[1.15rem] !text-[10px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
          />
        </div>

        <div className="no-scrollbar absolute inset-0 z-[2] overflow-y-auto overflow-x-hidden">
          {/* Header = même DA que le showroom (/profile) */}
          <div className="relative h-[6.4rem] overflow-hidden">
            {hasCover ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/75" />
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(160deg, ${brand} 0%, #121218 70%)`,
                }}
              />
            )}
            <div className="relative z-[1] flex h-full items-end gap-2 px-3 pb-2 pt-6">
              {coachPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coachPhotoUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/90"
                />
              ) : (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white/90"
                  style={{ background: brand, color: brandFg }}
                >
                  {letter}
                </div>
              )}
              <div className="min-w-0 text-white">
                <p className="truncate text-[11px] font-bold drop-shadow-sm">{coach}</p>
                {taglineText ? (
                  <p className="truncate text-[9px] text-white/85">{taglineText}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`px-3 py-3 ${pageBg}`}>
            {headerTags.length ? (
              <div className="mb-2.5 flex flex-wrap gap-1">
                {headerTags.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{ background: brand, color: brandFg }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="text-[13px] font-extrabold tracking-tight text-[color:var(--fg)]">
              Mes offres
            </p>
            <div className="pointer-events-auto mx-auto mt-1.5 w-full">
              <PrestationShowroomVignette
                {...vignetteProps}
                appName={appLabel}
                logoUrl={logoUrl}
                brandColor={brand}
                secondaryColor={secondary}
                themeMode={themeMode}
                bgStyle={bgStyle}
                previewMode
                sheetMode="phone"
                sheetContainerRef={sheetHostRef}
                aspectClassName="aspect-[16/10]"
              />
            </div>
          </div>
        </div>

        <div
          ref={sheetHostRef}
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
        />
      </div>
    </PhoneMockupFrameClient>
  )
}
